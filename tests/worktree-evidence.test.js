import {test,expect} from "bun:test";
import {mkdtempSync,writeFileSync,rmSync,mkdirSync,readFileSync,realpathSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {parseWorktreeStatus,collectWorktreeEvidence,sameRepositoryRoot} from "../scripts/worktree-evidence.mjs";
test("repository root comparison follows Windows separators/case without accepting a child or sibling",()=>{
  expect(sameRepositoryRoot("C:\\Temp\\Repo","c:/temp/repo","win32")).toBe(true);
  expect(sameRepositoryRoot("C:\\Temp\\Repo","C:\\Temp\\Repo\\child","win32")).toBe(false);
  expect(sameRepositoryRoot("C:\\Temp\\Repo","C:\\Temp\\Repo-other","win32")).toBe(false);
  expect(sameRepositoryRoot("/tmp/Repo","/tmp/repo","darwin")).toBe(false);
});
test("NUL status preserves spaces and Unicode, consumes renames and excludes sensitive paths",()=>{
  const result=parseWorktreeStatus(" M 한글 파일.js\0R  new name.js\0old name.js\0?? .env.local\0?? private.key\0?? README.md\0");
  expect(result.files.map(x=>x.path)).toEqual(["한글 파일.js","new name.js","README.md"]);
  expect(result.files[1].indexStatus).toBe("R");expect(result.excluded).toBe(2);
  expect(JSON.stringify(result)).not.toContain("old name");
  expect(parseWorktreeStatus("R  public.js\0secrets.json\0").excluded).toBe(1);
});
test("malformed or ambiguous status fails closed without partial output",()=>{
  for(const raw of [" M x","!! x\0","?? ../x\0","?? /x\0","?? x\nx\0","R  x\0","?? a\0?? a\0",
    Array.from({length:501},(_,i)=>`?? x${i}\0`).join("")]) expect(()=>parseWorktreeStatus(raw)).toThrow();
  expect(parseWorktreeStatus("").files).toEqual([]);
});
test("path opt-in and absolute root are required before Git execution",()=>{
  let called=false;
  for(const args of [{repo:"/tmp",includePaths:false},{repo:".",includePaths:true}])
    expect(()=>collectWorktreeEvidence(args,()=>{called=true;})).toThrow();
  expect(called).toBe(false);
});
test("real isolated Git repository yields modified, staged rename and untracked metadata without writes",()=>{
  const root=mkdtempSync(join(tmpdir(),"tokenjuice-worktree-"));
  const git=args=>execFileSync("git",["-C",root,...args],{encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  try {
    git(["init"]);git(["config","user.email","fixture@example.invalid"]);git(["config","user.name","fixture"]);
    writeFileSync(join(root,"old.txt"),"original\n");writeFileSync(join(root,"changed.txt"),"before\n");
    git(["add","."]);git(["commit","-m","fixture"]);git(["mv","old.txt","new name.txt"]);
    writeFileSync(join(root,"changed.txt"),"PRIVATE_CONTENT\n");writeFileSync(join(root,"fresh.txt"),"PRIVATE_CONTENT\n");
    writeFileSync(join(root,".env"),"PRIVATE_CONTENT\n");
    const status=git(["status","--porcelain=v1","-z"]);const before=readFileSync(join(root,".git/index"));
    const evidence=collectWorktreeEvidence({repo:root,includePaths:true});
    expect(evidence.files.map(x=>x.path)).toEqual(["changed.txt","new name.txt","fresh.txt"]);
    expect(evidence.excluded).toBe(1);expect(evidence.reviewed).toBe(false);
    expect(JSON.stringify(evidence)).not.toContain("PRIVATE_CONTENT");expect(JSON.stringify(evidence)).not.toContain(root);
    expect(readFileSync(join(root,".git/index"))).toEqual(before);expect(git(["status","--porcelain=v1","-z"])).toBe(status);
    mkdirSync(join(root,"nested"));expect(()=>collectWorktreeEvidence({repo:join(root,"nested"),includePaths:true})).toThrow();
  } finally {rmSync(root,{recursive:true,force:true});}
});
test("concurrent HEAD changes reject evidence and Git commands disable optional writes and fsmonitor",()=>{
  const root=realpathSync(mkdtempSync(join(tmpdir(),"tokenjuice-worktree-race-")));let heads=0;
  try {
    const runner=(command,args,options)=>{
      expect(command).toBe("git");expect(args.slice(0,6)).toEqual(["-c","core.fsmonitor=false","-c","core.untrackedCache=false","-C",root]);
      expect(options.env.GIT_OPTIONAL_LOCKS).toBe("0");expect(options.timeout).toBe(15000);
      const action=args.slice(6).join(" ");
      if(action==="rev-parse --show-toplevel") return root+"\n";
      if(action==="rev-parse --verify HEAD") return (++heads===1?"a":"b").repeat(40)+"\n";
      if(action==="rev-parse --abbrev-ref HEAD") return "main\n";
      return "";
    };
    expect(()=>collectWorktreeEvidence({repo:root,includePaths:true},runner)).toThrow("head_changed");
  } finally {rmSync(root,{recursive:true,force:true});}
});
