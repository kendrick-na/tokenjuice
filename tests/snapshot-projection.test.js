import {test, expect} from "bun:test";
import {projectWidgetSnapshot} from "../companion/snapshot.js";
const fixture = () => ({contractVersion:1,generatedAt:1000,transport:"local_export_only",
  claude:[{account:"Alias",state:"fresh",source:"local",lastSuccessAt:900,retryAt:null,
    items:[{name:"5-hour",used:20,resets:2000,state:null,forecast:{kind:"local_pace_estimate",beforeReset:false,exhaustionAt:null,samples:4,usedPerHour:2}}]}],
  codex:{state:"unavailable",items:[]},providers:[],
  sessions:[{platform:"claude",kind:"context",name:"Project",branch:null,id:"test",status:null,model:null,used:100,win:200000,pct:0.05,mtime:900}]});
test("snapshot projection preserves supported metadata exactly without mutating the input",()=>{
  const input=fixture(), before=JSON.stringify(input), output=projectWidgetSnapshot(input);
  expect(output).toEqual(input);expect(JSON.stringify(input)).toBe(before);
  expect(output).not.toBe(input);expect(output.claude[0].items[0]).not.toBe(input.claude[0].items[0]);
});
test("snapshot projection drops unknown fields at every supported nesting level",()=>{
  const input=fixture(), marker="SYNTHETIC_UNKNOWN";
  input.credentials={token:marker};input.claude[0].prompt=marker;input.codex.oauth={token:marker};
  input.claude[0].items[0].messages=[marker];input.claude[0].items[0].forecast.transcript=marker;
  input.providers=[{state:"unavailable",id:"cursor",label:"Cursor",items:[],config:{key:marker}}];
  input.sessions[0].code=marker;
  const projected=projectWidgetSnapshot(input);
  expect(JSON.stringify(projected)).not.toContain(marker);
  expect(projected.generatedAt).toBe(input.generatedAt);expect(projected.sessions[0].mtime).toBe(900);
  expect(projected.providers).toEqual([{id:"cursor",label:"Cursor",state:"unavailable",items:[]}]);
});
test("objects cannot hide private fields inside scalar metadata slots",()=>{
  const input=fixture();input.claude[0].reason={token:"SYNTHETIC_UNKNOWN"};
  input.claude[0].items[0].resets={token:"SYNTHETIC_UNKNOWN"};
  input.sessions[0].used={token:"SYNTHETIC_UNKNOWN"};
  const projected=projectWidgetSnapshot(input);
  expect(JSON.stringify(projected)).not.toContain("SYNTHETIC_UNKNOWN");
  expect(Object.hasOwn(projected.claude[0],"reason")).toBe(false);
  expect(Object.hasOwn(projected.sessions[0],"used")).toBe(false);
});
test("legacy snapshots keep optional providers and sessions absent",()=>{
  const input=fixture();delete input.providers;delete input.sessions;
  expect(projectWidgetSnapshot(input)).toEqual(input);
});
