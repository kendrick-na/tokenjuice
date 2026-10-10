import {test,expect} from "bun:test";
import {normalizeWorktree,reviewedWorktree,worktreeBrief,normalizeCommits,reviewedCommits,commitBrief} from "../companion/work-files.js";
import {draftSummary,workPackage,workHandoff} from "../companion/work-summary.js";
const source=()=>({format:"tokenjuice-worktree-evidence-v1",privacy:"explicit_relative_paths",reviewed:true,
  createdAt:Date.now()-1000,head:"a".repeat(40),branch:"main",excluded:0,
  files:[{path:"src/한글 파일.js",indexStatus:" ",worktreeStatus:"M",body:"SECRET"},{path:"skip.js",indexStatus:"?",worktreeStatus:"?"}],raw:"SECRET"});
test("import projects known metadata, resets review and excludes known sensitive paths",()=>{
  const value=source();value.files.push({path:".env",indexStatus:"?",worktreeStatus:"?"});
  const next=normalizeWorktree(value);expect(next.reviewed).toBe(false);expect(next.excluded).toBe(1);
  expect(next.files).toHaveLength(2);expect(JSON.stringify(next)).not.toContain("SECRET");
});
test("invalid timestamps, paths, status, duplicate and bounds fail closed",()=>{
  for(const value of [null,{...source(),createdAt:Date.now()+60000},{...source(),files:[{path:"../secret",indexStatus:"?",worktreeStatus:"?"}]},
    {...source(),files:[source().files[0],source().files[0]]},{...source(),head:"wrong"},
    {...source(),files:[{path:"x",indexStatus:"MM",worktreeStatus:"M"}]},{...source(),excluded:500}])
    expect(()=>normalizeWorktree(value)).toThrow();
});
test("selected reviewed export cannot include deselected or unknown fields",()=>{
  for(const [indices,confirmed] of [[[],true],[[0],false],[[0,0],true],[[2],true]])
    expect(()=>reviewedWorktree(source(),indices,confirmed)).toThrow();
  const next=reviewedWorktree(source(),[0],true);expect(next.files).toHaveLength(1);
  expect(worktreeBrief(next)).toContain("완료/테스트 증거 아님");expect(worktreeBrief(next)).not.toContain("skip.js");
});
test("combined handoff reopens unreviewed with summary provenance preserved",()=>{
  const draft=draftSummary("작업 목표");const values={goal:"목표",completed:"완료 주장",blocked:"확인 필요",next:"파일 확인"};
  const result=workPackage(draft,values,reviewedWorktree(source(),[0],true));
  const reopened=draftSummary(JSON.stringify(result));expect(reopened.reviewed).toBe(false);expect(reopened.goal).toBe("목표");
  expect(result.worktree.files).toHaveLength(1);expect(JSON.stringify(result)).not.toContain("SECRET");
  expect(()=>workPackage(draft,values,source())).not.toThrow();
  expect(()=>workPackage(draft,values,{...source(),reviewed:false})).toThrow();
});
const commitSource=()=>({format:"tokenjuice-commit-evidence-v1",privacy:"explicit_relative_paths",reviewed:false,
  createdAt:Date.now()-1000,head:"a".repeat(40),branch:"main",scope:"latest_five_first_parent_commits",
  commits:[{hash:"a".repeat(40),excluded:0,files:[{path:"committed.js",status:"M",raw:"SECRET"},{path:".env",status:"A"}]},
    {hash:"b".repeat(40),excluded:0,files:[{path:"unselected.js",status:"D"}]}],author:"SECRET"});
test("commit imports filter private fields, require first-parent source identity and explicit unique selection",()=>{
  const next=normalizeCommits(commitSource());expect(next.reviewed).toBe(false);expect(next.commits[0].excluded).toBe(1);
  expect(JSON.stringify(next)).not.toContain("SECRET");
  for(const value of [{...commitSource(),head:"c".repeat(40)},{...commitSource(),scope:"all"},
    {...commitSource(),createdAt:Date.now()+60000},{...commitSource(),commits:[commitSource().commits[0],commitSource().commits[0]]},
    {...commitSource(),commits:[{hash:"a".repeat(40),excluded:500,files:[{path:"x",status:"A"}]}]}])
    expect(()=>normalizeCommits(value)).toThrow();
  for(const [pairs,checked] of [[[],true],[[[0,0]],false],[[[0,0],[0,0]],true],[[[8,0]],true]])
    expect(()=>reviewedCommits(commitSource(),pairs,checked)).toThrow();
  const selected=reviewedCommits(commitSource(),[[1,0]],true);
  expect(selected.commits).toHaveLength(1);expect(selected.scope).toBe("selected_from_latest_five_first_parent_commits");
  expect(commitBrief(selected)).toContain("현재 미커밋 상태/완료/테스트 증거 아님");
  expect(commitBrief(selected)).not.toContain("committed.js");expect(()=>commitBrief({...selected,reviewed:false})).toThrow();
});
test("v2 combined or commits-only handoff preserves provenance, excludes unselected commits and resets review",()=>{
  const draft=draftSummary("작업 목표"),values={goal:"목표",completed:"완료 주장",blocked:"확인 필요",next:"파일 확인"};
  const commits=reviewedCommits(commitSource(),[[0,0]],true);
  for(const worktree of [null,reviewedWorktree(source(),[0],true)]) {
    const result=workPackage(draft,values,worktree,commits);
    expect(result.format).toBe("tokenjuice-work-handoff-v2");expect(result.commits.commits).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("unselected.js");expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(draftSummary(JSON.stringify(result)).reviewed).toBe(false);
    expect(()=>draftSummary(JSON.stringify({...result,commits:{...result.commits,reviewed:false}}))).toThrow();
  }
  expect(()=>workPackage(draft,values,null,null)).toThrow();
  const pending=reviewedWorktree({...source(),files:Array.from({length:50},(_,i)=>({path:`file-${i}.js`,indexStatus:" ",worktreeStatus:"M"}))},Array.from({length:50},(_,i)=>i),true);
  expect(()=>workPackage(draft,values,pending,commits)).toThrow();
  expect(()=>workHandoff(draft,values,pending,commits)).toThrow();
  const cloud={...draft,method:"cloud_generative"};
  expect(draftSummary(JSON.stringify(workPackage(cloud,values,null,commits))).method).toBe("cloud_generative");
});
