import {execFileSync} from "node:child_process";
import {realpathSync,statSync} from "node:fs";
import {isAbsolute,posix,win32} from "node:path";
export const sameRepositoryRoot=(left,right,platform=process.platform)=>
  (platform==="win32"?win32.relative(left,right):posix.relative(left,right))==="";
export function sameRepositoryDirectory(left,right,platform=process.platform,stat=statSync) {
  if(sameRepositoryRoot(left,right,platform)) return true;
  if(platform!=="win32") return false;
  // realpath may preserve an 8.3 alias while Git returns its long name. Do not
  // guess aliases or accept a shared prefix: verify the physical directory.
  const a=stat(left,{bigint:true}), b=stat(right,{bigint:true});
  return a.isDirectory() && b.isDirectory() && typeof a.dev==="bigint"
    && a.dev>=0n && typeof a.ino==="bigint" && a.ino>0n
    && a.dev===b.dev && a.ino===b.ino;
}

export const safePath = path => typeof path === "string" && path.length > 0 && path.length <= 1024
  && !/[\u0000-\u001f\u007f\\]/.test(path) && !path.startsWith("/")
  && !/^[A-Za-z]:/.test(path) && !path.split("/").some(part => ["", ".", ".."].includes(part));
export const sensitive = path => /(?:^|\/)(?:\.env(?:\.[^/]*)?|\.git|\.ssh|\.aws|\.claude|\.codex|credentials(?:\.[^/]*)?|secrets?(?:\.[^/]*)?)(?:\/|$)|\.(?:pem|key|p12|pfx|keystore)$/i.test(path);
export function parseWorktreeStatus(raw) {
  if (typeof raw !== "string" || Buffer.byteLength(raw) > 1024*1024 || (raw && !raw.endsWith("\0")))
    throw Error("invalid_status");
  const entries = raw ? raw.slice(0,-1).split("\0") : [];
  const files = [], seen = new Set(); let excluded = 0, count = 0;
  for (let i=0;i<entries.length;i++) {
    const row=entries[i], status=row.slice(0,2), path=row.slice(3);
    if (row[2] !== " " || !/^[ MTADRCU?]{2}$/.test(status) || status === "  "
      || (status.includes("?") && status !== "??") || !safePath(path) || seen.has(path)) throw Error("invalid_status");
    seen.add(path);count++;
    if (count > 500) throw Error("too_many_files");
    let original = null;
    if (/[RC]/.test(status)) {original=entries[++i];if (!safePath(original)) throw Error("invalid_rename");}
    if (sensitive(path) || (original && sensitive(original))) {excluded++;continue;}
    files.push({path,indexStatus:status[0],worktreeStatus:status[1]});
  }
  return {files,excluded}; // Old rename paths and file contents are intentionally omitted.
}

export function openEvidenceRepository({repo,includePaths=false,now=Date.now()}, run=execFileSync) {
  if (!includePaths || typeof repo !== "string" || !isAbsolute(repo)
    || !Number.isSafeInteger(now) || now<=0) throw Error("explicit_paths_required");
  const root=realpathSync(repo);
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith("GIT_")));
  env.GIT_OPTIONAL_LOCKS="0";
  env.GIT_NO_LAZY_FETCH="1";
  env.GIT_ALLOW_PROTOCOL="";
  env.GIT_NO_REPLACE_OBJECTS="1";
  env.GIT_TERMINAL_PROMPT="0";
  const git = args => run("git",["-c","core.fsmonitor=false","-c","core.untrackedCache=false","-C",root,...args],
    {encoding:"utf8",env,timeout:15000,maxBuffer:1024*1024,stdio:["ignore","pipe","pipe"]});
  if (!sameRepositoryDirectory(root,realpathSync(git(["rev-parse","--show-toplevel"]).trim()))) throw Error("repository_root_required");
  const head=git(["rev-parse","--verify","HEAD"]).trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) throw Error("invalid_head");
  const ref=git(["rev-parse","--abbrev-ref","HEAD"]).trim();
  if (ref.length>256 || /[\u0000-\u001f\u007f]/.test(ref)) throw Error("invalid_branch");
  return {git,head,branch:ref==="HEAD"?null:ref};
}

export function collectWorktreeEvidence({repo,includePaths=false,now=Date.now()}, run=execFileSync) {
  const {git,head,branch}=openEvidenceRepository({repo,includePaths,now},run);
  const status=parseWorktreeStatus(git(["status","--porcelain=v1","-z","--untracked-files=all","--ignore-submodules=all"]));
  if (git(["rev-parse","--verify","HEAD"]).trim() !== head) throw Error("head_changed");
  return {format:"tokenjuice-worktree-evidence-v1",privacy:"explicit_relative_paths",reviewed:false,
    createdAt:now,head,branch,...status,
    limits:["Local Git observation, not proof of implementation, tests or completion.",
      "Only currently pending changes; not committed history or the full set of recent work.",
      "Not an atomic filesystem snapshot; recheck before resuming.",
      "Names may still be private. Review before sharing. Known sensitive paths are excluded.",
      "No contents, diffs, absolute root, remote URLs, original rename paths or nested submodule work."]};
}

if (import.meta.main) {
  try {
    const args=process.argv.slice(2);
    if (args.length!==3 || args[0]!=="--repo" || args[2]!=="--include-paths") throw Error("usage");
    console.log(JSON.stringify(collectWorktreeEvidence({repo:args[1],includePaths:true}),null,2));
  } catch {
    console.error("변경 파일 확인 실패. 사용법: bun scripts/worktree-evidence.mjs --repo /절대경로/저장소 --include-paths. 저장소 루트·첫 커밋·경로 포함 동의를 확인하세요. 파일명도 비밀일 수 있습니다. 원문·명령 오류는 출력하지 않았습니다.");
    process.exitCode=1;
  }
}
