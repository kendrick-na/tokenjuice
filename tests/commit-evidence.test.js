import {test,expect} from "bun:test";
import {mkdtempSync,writeFileSync,readFileSync,rmSync,realpathSync,mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {parseCommittedPaths,collectCommitEvidence} from "../scripts/commit-evidence.mjs";

test("committed path parser preserves NUL names, filters secrets and rejects ambiguous output",()=>{
  expect(parseCommittedPaths("M\0한글 파일.js\0D\0old.txt\0A\0.env.local\0")).toEqual({
    files:[{path:"한글 파일.js",status:"M"},{path:"old.txt",status:"D"}],excluded:1});
  expect(parseCommittedPaths("")).toEqual({files:[],excluded:0});
  for(const raw of ["M\0x","R100\0old\0new\0","X\0x\0","M\0../x\0","M\0/x\0",
    "M\0a\0A\0a\0","M\0x\nx\0",Array.from({length:501},(_,i)=>`A\0x${i}\0`).join("")])
    expect(()=>parseCommittedPaths(raw)).toThrow();
});

function fixture(body) {
  const root=realpathSync(mkdtempSync(join(tmpdir(),"tokenjuice-commits-")));
  const git=args=>execFileSync("git",["-C",root,...args],{encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  const write=(name,value="PRIVATE_BODY\n")=>writeFileSync(join(root,name),value);
  const commit=()=>{git(["add","."]);git(["commit","-m","PRIVATE_MESSAGE"]);};
  try {
    git(["init","-b","main"]);git(["config","user.email","private@example.invalid"]);
    git(["config","user.name","PRIVATE_AUTHOR"]);body({root,git,write,commit});
  } finally {rmSync(root,{recursive:true,force:true});}
}

test("real root and latest five commits are distinct from pending changes, without private metadata or writes",()=>{
  fixture(({root,git,write,commit})=>{
    write("first.txt");write(".env");commit();
    const first=collectCommitEvidence({repo:root,includePaths:true});
    expect(first.commits).toHaveLength(1);expect(first.commits[0].files).toEqual([{path:"first.txt",status:"A"}]);
    expect(first.commits[0].excluded).toBe(1);
    git(["mv","first.txt","한글 파일.txt"]);commit();
    const renamed=collectCommitEvidence({repo:root,includePaths:true});
    expect(renamed.commits[0].files).toEqual([{path:"first.txt",status:"D"},{path:"한글 파일.txt",status:"A"}]);
    for(let i=0;i<5;i++){write(`file-${i}.txt`);commit();}
    write("pending-only.txt");write("한글 파일.txt","PENDING_BODY\n");
    // Ordinary fixture status may refresh the index; capture bytes after it.
    const status=git(["status","--porcelain=v1","-z"]),index=readFileSync(join(root,".git/index"));
    const evidence=collectCommitEvidence({repo:root,includePaths:true}),json=JSON.stringify(evidence);
    expect(evidence.commits).toHaveLength(5);expect(evidence.commits[0].hash).toBe(evidence.head);
    expect(evidence.scope).toBe("latest_five_first_parent_commits");expect(evidence.reviewed).toBe(false);
    for(const secret of ["PRIVATE_MESSAGE","PRIVATE_AUTHOR","private@example.invalid","PRIVATE_BODY","PENDING_BODY","pending-only.txt",root])
      expect(json).not.toContain(secret);
    expect(readFileSync(join(root,".git/index"))).toEqual(index);expect(git(["status","--porcelain=v1","-z"])).toBe(status);
    mkdirSync(join(root,"nested"));expect(()=>collectCommitEvidence({repo:join(root,"nested"),includePaths:true})).toThrow();
  });
});

test("merge evidence compares first parent without listing side history as separate work",()=>{
  fixture(({root,git,write,commit})=>{
    write("base.txt");commit();git(["checkout","-b","side"]);write("side.txt");commit();
    const side=git(["rev-parse","HEAD"]).trim();git(["checkout","main"]);write("main.txt");commit();
    git(["merge","--no-ff","side","-m","PRIVATE_MERGE_MESSAGE"]);
    const evidence=collectCommitEvidence({repo:root,includePaths:true});
    expect(evidence.commits).toHaveLength(3);
    expect(evidence.commits[0].files).toEqual([{path:"side.txt",status:"A"}]);
    expect(evidence.commits.map(c=>c.hash)).not.toContain(side);
  });
});

test("consent precedes Git; corrupt history, too many paths and concurrent HEAD change fail closed",()=>{
  let called=false;
  expect(()=>collectCommitEvidence({repo:".",includePaths:true},()=>{called=true;})).toThrow();
  expect(()=>collectCommitEvidence({repo:"/tmp",includePaths:false},()=>{called=true;})).toThrow();expect(called).toBe(false);
  const root=realpathSync(mkdtempSync(join(tmpdir(),"tokenjuice-commit-race-")));
  const head="a".repeat(40);
  try {
    for(const mode of ["race","duplicate","wrong-head","too-many","aggregate-limit"]) {
      let heads=0;
      const run=(command,args,options)=>{
        expect(command).toBe("git");expect(options.env.GIT_NO_LAZY_FETCH).toBe("1");
        expect(options.env.GIT_ALLOW_PROTOCOL).toBe("");expect(options.env.GIT_TERMINAL_PROMPT).toBe("0");
        expect(options.env.GIT_NO_REPLACE_OBJECTS).toBe("1");expect(options.env.GIT_OPTIONAL_LOCKS).toBe("0");
        const action=args.slice(6);
        if(action[0]==="rev-parse") {
          if(action[1]==="--show-toplevel") return root+"\n";
          if(action[1]==="--abbrev-ref") return "main\n";
          return (++heads>1?"b".repeat(40):head)+"\n";
        }
        if(action[0]==="rev-list") return mode==="duplicate"?`${head}\n${head}\n`:mode==="wrong-head"?"b".repeat(40)+"\n":mode==="aggregate-limit"?`${head}\n${"b".repeat(40)}\n`:head+"\n";
        expect(action).toContain("--no-ext-diff");expect(action).toContain("--no-textconv");expect(action).toContain("--no-renames");
        return ["too-many","aggregate-limit"].includes(mode)?Array.from({length:mode==="too-many"?501:300},(_,i)=>`A\0x${i}\0`).join(""):"A\0x\0";
      };
      expect(()=>collectCommitEvidence({repo:root,includePaths:true},run)).toThrow();
    }
  } finally {rmSync(root,{recursive:true,force:true});}
});
