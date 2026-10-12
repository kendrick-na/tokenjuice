import { test, expect } from "bun:test";
import { feedbackDiagnostics, feedbackReport } from "../companion/feedback.js";

test("feedback is bounded, optional diagnostics and known-secret filtering are explicit", () => {
  const context = { get snapshot() { throw Error("must not read when excluded"); } };
  const report = feedbackReport({topic:"data",description:"문제 재현\napi_key=PRIVATE_KEY\n이메일 user@example.com /Users/private/file"},context);
  expect(report).toEqual({format:"tokenjuice-feedback-v1",topic:"data",description:"문제 재현 이메일 [이메일 제외] [주소 제외]"});
  for(const input of [{topic:"unknown",description:"test"},{topic:"data",description:"x".repeat(2001)},
    {topic:"data",description:"api_key=PRIVATE_ONLY"},{topic:"data",description:[]},
    {topic:"data",description:"ok",includeDiagnostics:"yes"}]) expect(()=>feedbackReport(input)).toThrow();
});
test("diagnostics are fixed categories, not account/session/provider raw metadata or live observations", () => {
  const snapshot={generatedAt:1000,claude:[{state:"rate_limited",account:"PRIVATE_ACCOUNT",items:[{used:67}]}],
    codex:{state:"fresh",source:"PRIVATE_SOURCE"},providers:[{state:"PRIVATE_STATE",label:"PRIVATE_LABEL"}],
    sessions:[{name:"PRIVATE_PROJECT",branch:"PRIVATE_BRANCH"}],private:"PRIVATE_RAW"};
  const report=feedbackReport({topic:"display",description:"합성 제보",includeDiagnostics:true},{snapshot},2000);
  expect(report.diagnostics).toEqual({source:"imported_snapshot_not_live",age:"under_30m",providers:[
    {provider:"claude",state:"rate_limited"},{provider:"codex",state:"fresh"},{provider:"other",state:"unknown"}],truncated:false});
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(JSON.stringify(report)).not.toContain("67");
  expect(feedbackDiagnostics({snapshot},1801000).age).toBe("older_than_30m");
  expect(feedbackDiagnostics({snapshot,expired:true},2000).age).toBe("older_than_30m");
  expect(feedbackDiagnostics({snapshot},999).age).toBe("clock_changed");
});
test("empty/demo snapshots do not become real diagnoses, and metadata list stays bounded", () => {
  expect(feedbackDiagnostics()).toEqual({source:"no_snapshot",age:"not_applicable",providers:[]});
  expect(feedbackDiagnostics({snapshot:{private:"SECRET"},demo:true})).toEqual({source:"demo_only",age:"not_applicable",providers:[]});
  const result=feedbackDiagnostics({snapshot:{claude:Array.from({length:30},()=>({state:"stale"}))}});
  expect(result.age).toBe("unknown");expect(result.providers).toHaveLength(20);expect(result.truncated).toBe(true);
});
