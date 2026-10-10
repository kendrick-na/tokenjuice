import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { normalizeHistory, historySegments } from "../companion/history.js";
const now=Date.UTC(2026,9,11), key="0:5-hour";
const payload=rows=>({format:"tokenjuice-forecast-history-v1",observations:rows});
test("history groups and sorts seven-day observations without importing private fields",()=>{
  const value=normalizeHistory({...payload([
    {key,at:now-1000,used:35,secret:"SECRET"}, {key,at:now-2000,used:10},
    {key,at:now-2000,used:10}, {key,at:now-8*86400000,used:1},
  ]),prompt:"SECRET"},now);
  expect(value.excluded).toBe(1);expect(value.series[0].points.map(x=>x.used)).toEqual([10,35]);
  expect(value.series[0].label).toBe("Claude 로컬 슬롯 1 · 5-hour");
  expect(JSON.stringify(value)).not.toContain("SECRET");expect(JSON.stringify(value)).not.toContain('"key"');
  expect(normalizeHistory(payload([]),now).series).toEqual([]);
});
test("malformed, future, oversized and conflicting history is rejected before replacement",()=>{
  for(const bad of [null,{},payload([null]),payload([{key,at:now+1,used:5}]),
    payload([{key,at:now,used:101}]),payload([{key,at:now,used:"5"}]),
    payload([{key:"<script>SECRET</script>",at:now,used:5}]),
    payload([{key,at:now,used:5},{key,at:now,used:6}]),
    payload(Array.from({length:321},()=>({key,at:now,used:5})))])
    expect(()=>normalizeHistory(bad,now)).toThrow();
});
test("Codex opaque period keys remain distinct and never become invented window names",()=>{
  const value=normalizeHistory({format:"tokenjuice-codex-forecast-history-v1",observations:[
    {key:`cw_${"a".repeat(64)}`,at:now-1000,used:10},
    {key:`cw_${"b".repeat(64)}`,at:now,used:80},
  ]},now);
  expect(value.provider).toBe("Codex");expect(value.series).toHaveLength(2);
  expect(value.series[0].label).toContain("창/계정 미식별");expect(JSON.stringify(value)).not.toContain("cw_");
});
test("history never interpolates large gaps or decreasing utilization",()=>{
  const points=[{at:1,used:10},{at:1000,used:20},{at:2000,used:5},{at:4000000,used:30}];
  expect(historySegments(points).map(x=>x.length)).toEqual([2,1,1]);
});
test("real engine history exports interoperate in a synthetic isolated home without opt-in changes",()=>{
  const directory=mkdtempSync(join(tmpdir(),"tokenjuice-history-interop-"));
  try{
    const cache=join(directory,".cache/claude-codex-battery");mkdirSync(cache,{recursive:true});
    for(const [file,flag,historyKey] of [["quota-history.json","--forecast-history",key],
      ["codex-quota-history.json","--codex-forecast-history",`cw_${"a".repeat(64)}`]]){
      writeFileSync(join(cache,file),JSON.stringify({version:1,observations:[{key:historyKey,at:Date.now()-10000,used:42}]}));
      const result=Bun.spawnSync([process.execPath,fileURLToPath(new URL("../claude-codex-battery.5s.js",import.meta.url)),flag],
        {env:{...process.env,HOME:directory,USERPROFILE:directory,CCB_API:"0"},stdout:"pipe",stderr:"pipe"});
      expect(result.stderr.toString()).toBe("");
      expect(result.exitCode).toBe(0);
      expect(normalizeHistory(JSON.parse(result.stdout.toString())).series[0].points[0].used).toBe(42);
    }
  }finally{rmSync(directory,{recursive:true,force:true});}
});
