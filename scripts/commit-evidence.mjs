import {openEvidenceRepository,safePath,sensitive} from "./worktree-evidence.mjs";

export function parseCommittedPaths(raw) {
  if(typeof raw!=="string" || Buffer.byteLength(raw)>1024*1024 || (raw && !raw.endsWith("\0")))
    throw Error("invalid_commit_paths");
  const rows=raw?raw.slice(0,-1).split("\0"):[], files=[], seen=new Set();let excluded=0;
  if(rows.length%2 || rows.length>1000) throw Error("invalid_commit_paths");
  for(let i=0;i<rows.length;i+=2) {
    const status=rows[i], path=rows[i+1];
    if(!/^[ADMT]$/.test(status) || !safePath(path) || seen.has(path)) throw Error("invalid_commit_paths");
    seen.add(path);
    if(sensitive(path)) {excluded++;continue;}
    files.push({path,status});
  }
  return {files,excluded};
}

export function collectCommitEvidence({repo,includePaths=false,now=Date.now()},run) {
  const {git,head,branch}=openEvidenceRepository({repo,includePaths,now},run);
  const raw=git(["rev-list","--first-parent","--max-count=5",head,"--"]);
  const hashes=raw.trim().split(/\r?\n/);
  if(hashes.length>5 || hashes[0]!==head || new Set(hashes).size!==hashes.length
    || hashes.some(hash=>!new RegExp(`^[a-f0-9]{${head.length}}$`).test(hash))) throw Error("invalid_commit_list");
  let count=0;
  const commits=hashes.map(hash=>{
    const paths=parseCommittedPaths(git(["diff-tree","--root","-r","--no-commit-id","--name-status","-z",
      "--no-renames","--no-ext-diff","--no-textconv","--ignore-submodules=all",
      "--diff-merges=first-parent",hash,"--"]));
    count+=paths.files.length+paths.excluded;
    if(count>500) throw Error("too_many_commit_paths");
    return {hash,...paths};
  });
  if(git(["rev-parse","--verify","HEAD"]).trim()!==head) throw Error("head_changed");
  return {format:"tokenjuice-commit-evidence-v1",privacy:"explicit_relative_paths",reviewed:false,
    createdAt:now,head,branch,scope:"latest_five_first_parent_commits",commits,
    limits:["Committed changes only, not current pending files, completion, tests or full work history.",
      "Merge changes compare the first parent; side-branch commits are not listed separately.",
      "Renames appear as deletion/addition, without claiming a rename relationship.",
      "No messages, authors, dates, contents, diffs, remotes or absolute root.",
      "Known sensitive paths and submodule work are excluded; other names may still be private.",
      "Recheck current repository and review selected paths before sharing."]};
}

if(import.meta.main) {
  try {
    const args=process.argv.slice(2);
    if(args.length!==3 || args[0]!=="--repo" || args[2]!=="--include-paths") throw Error("usage");
    console.log(JSON.stringify(collectCommitEvidence({repo:args[1],includePaths:true}),null,2));
  } catch {
    console.error("커밋 파일 확인 실패. 사용법: bun scripts/commit-evidence.mjs --repo /절대경로/저장소 --include-paths. 로컬 Git 루트·첫 커밋·경로 포함 동의를 확인하세요. 비공개 오류와 원문은 출력하지 않았습니다.");
    process.exitCode=1;
  }
}
