import {test, expect} from "bun:test";
import {triageIssues,readFeedback} from "../scripts/feedback-triage.mjs";
import {readFileSync} from "node:fs";
const now = Date.UTC(2026,9,11);
for (const newline of ["\n", "\r\n"]) test(`public feedback privacy checks survive ${newline === "\n" ? "LF" : "CRLF"} checkouts`,()=>{
  const source=readFileSync(new URL("../.github/ISSUE_TEMPLATE/feedback.yml",import.meta.url),"utf8");
  const form=source.replace(/\r\n/g,"\n").replace(/\n/g,newline).replace(/\r\n/g,"\n");
  expect(form).toContain("GitHub 로그인");
  expect(form).toContain("공개 이슈");
  expect(form.indexOf("공개 이슈")).toBeLessThan(form.indexOf("id: type"));
  expect(form).toContain("id: public-report-consent");
  expect(form).toContain("label: 이 제보가 공개되며 누구나 읽을 수 있음을 확인했습니다.\n          required: true");
  expect(form).toContain("label: 비밀번호·토큰·이메일·프롬프트·코드·민감한 화면이 없는지 확인했습니다.\n          required: true");
  expect(form).toContain("18:30 KST");
});
const issue = (number, labels=[]) => ({number,url:`https://github.com/kendrick-na/tokenjuice/issues/${number}`,
  state:"OPEN",updatedAt:new Date(now-8*86400000).toISOString(),labels:labels.map(name=>({name}))});
test("triage projects only known metadata, prioritizes explicit labels and never exposes private fields",()=>{
  const report=triageIssues([{...issue(2,["area:ux","priority:p1","status:verify","SECRET"]),body:"SECRET",author:"SECRET",title:"SECRET"},
    issue(1,["area:data","priority:p0","status:ready-to-fix"])],now);
  expect(report.issues.map(row=>row.number)).toEqual([1,2]);
  expect(report.needsClassification).toBe(0);expect(report.overdueReview).toEqual([1,2]);
  expect(JSON.stringify(report)).not.toContain("SECRET");expect(report.truncated).toBe(false);
});
test("missing or conflicting labels require human review, not invented severity",()=>{
  const report=triageIssues([issue(1,["priority:p0","priority:p2","area:data","area:ux"]),issue(2)],now);
  expect(report.needsClassification).toBe(2);
  expect(report.issues[0].priority).toBe("review");expect(report.issues[0].area).toBe("unclassified");
  expect(report.limits.join(" ")).toContain("not unique users");
});
test("invalid metadata fails closed instead of showing a successful empty report",()=>{
  for(const value of [null,{},[null],[issue(1),issue(1)],[{...issue(1),url:"https://evil.example"}],
    [{...issue(1),state:"CLOSED"}],[{...issue(1),updatedAt:"bad"}],[{...issue(1),updatedAt:new Date(now+1).toISOString()}],
    Array.from({length:202},(_,i)=>issue(i+1))]) expect(()=>triageIssues(value,now)).toThrow();
});
test("fetch cap is visible and cannot masquerade as complete coverage",()=>{
  const report=triageIssues(Array.from({length:201},(_,i)=>issue(i+1)),now);
  expect(report.truncated).toBe(true);expect(report.issueCount).toBe(200);
  expect(triageIssues([],now).issueCount).toBe(0);
});
test("live reader requests metadata only with fixed repository, cap and timeout",()=>{
  const report=readFeedback((command,args,options)=>{
    expect(command).toBe("gh");expect(args).toEqual(["issue","list","--repo","kendrick-na/tokenjuice","--state","open","--limit","201","--json","number,url,labels,state,updatedAt"]);
    expect(options.timeout).toBe(30000);expect(options.stdio).toEqual(["ignore","pipe","pipe"]);
    return JSON.stringify([issue(1)]);
  },now);
  expect(report.issueCount).toBe(1);
  expect(()=>readFeedback(()=>{throw Error("SECRET");},now)).toThrow();
});
test("CLI misuse fails with generic error, not a fabricated empty report",()=>{
  const result=Bun.spawnSync([process.execPath,"scripts/feedback-triage.mjs","--unknown"],{stdout:"pipe",stderr:"pipe"});
  expect(result.exitCode).toBe(1);expect(result.stdout.toString()).toBe("");
  expect(result.stderr.toString()).toContain("빈 결과로 처리하지 않았습니다");
});
