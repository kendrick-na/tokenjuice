import {test,expect} from "bun:test";
import {normalizeWorktree,reviewedWorktree,worktreeBrief} from "../companion/work-files.js";
import {draftSummary,workPackage} from "../companion/work-summary.js";
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
