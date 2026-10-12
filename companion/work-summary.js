// Local extraction and reviewed-file reopening. No cloud calls or execution.
import {normalizeWorktree,worktreeBrief,normalizeCommits,commitBrief,initWorkFiles} from "./work-files.js";
export const MAX_SESSION_BYTES = 8 * 1024 * 1024;
const record = v => v !== null && typeof v === "object" && !Array.isArray(v);
const fields = ["goal", "completed", "blocked", "next"];
const secret = /(?:-----BEGIN .*PRIVATE KEY|\b(?:sk-|ghp_|github_pat_|AKIA)[A-Za-z0-9_-]{12,}|bearer\s+\S+|(?:api[_ -]?key|password|passwd|secret|token|비밀번호|인증키)["']?\s*[:=]\s*\S+)/i;
export function safeExcerpt(value, limit = 700) {
  if (typeof value !== "string") return "";
  let fence = false;
  return value.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, "\n").split(/\r?\n/).filter(line => {
    if (/^\s*```/.test(line)) { fence = !fence; return false; }
    return !fence && !secret.test(line) && !/^\s*(?:diff --git|[+-]{3} |@@|import |const |function |class )/.test(line);
  }).join(" ").replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[이메일 제외]")
    .replace(/(?:https?:\/\/\S+|(?:\/Users\/|\/home\/|[A-Z]:\\)\S+)/gi, "[주소 제외]")
    .replace(/\s+/g, " ").trim().slice(0, limit);
}
function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter(x => record(x) && ["text", "input_text", "output_text"].includes(x.type))
    .map(x => typeof x.text === "string" ? x.text : "").join("\n");
}
export function sessionMessages(raw) {
  if (typeof raw !== "string" || new TextEncoder().encode(raw).length > MAX_SESSION_BYTES) throw new Error("too_large");
  const source = raw.trim();
  if (!source) throw new Error("empty_session");
  let rows;
  try {
    const parsed = JSON.parse(source);
    rows = Array.isArray(parsed) ? parsed : record(parsed) && Array.isArray(parsed.messages) ? parsed.messages : [parsed];
  } catch {
    if (/^[\[{]/.test(source)) rows = source.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    else rows = [{ role: "user", content: source }];
  }
  if (rows.length > 10000) throw new Error("too_many_records");
  const sessions = new Set();
  const seen = new Set();
  const messages = [];
  for (const row of rows) {
    if (!record(row)) continue;
    if (typeof row.sessionId === "string") sessions.add(row.sessionId);
    if (row.type === "session_meta" && typeof row.payload?.id === "string") sessions.add(row.payload.id);
    let message = row.message || row;
    if (row.type === "response_item") message = row.payload;
    if (row.type === "event_msg" && ["user_message", "agent_message"].includes(row.payload?.type)) {
      message = { role: row.payload.type === "user_message" ? "user" : "assistant", content: row.payload.message };
    }
    if (!record(message) || !["user", "assistant"].includes(message.role)) continue;
    const text = safeExcerpt(contentText(message.content));
    const key = `${message.role}:${text}`;
    if (text && !seen.has(key)) { seen.add(key); messages.push({ role: message.role, text }); }
  }
  if (sessions.size > 1) throw new Error("multiple_sessions");
  if (!messages.length) throw new Error("no_supported_messages");
  // Bound review complexity. Never silently call this a complete session summary.
  return { messages: messages.slice(-200), truncated: messages.length > 200 };
}
export function draftSummary(raw) {
  if (typeof raw !== "string" || new TextEncoder().encode(raw).length > MAX_SESSION_BYTES) throw new Error("too_large");
  // Reopen a previously reviewed file without trusting its review flag or source.
  let saved;
  try { saved = JSON.parse(raw); } catch {}
  if (["tokenjuice-work-handoff-v1","tokenjuice-work-handoff-v2"].includes(saved?.format)) {
    if (saved.privacy!=="reviewed_summary_and_relative_paths" || saved.reviewed!==true || !record(saved.summary)) throw Error("invalid_handoff");
    if(saved.format==="tokenjuice-work-handoff-v1")normalizeWorktree(saved.worktree);
    else {
      if(!saved.worktree && !saved.commits)throw Error("invalid_handoff");
      if(saved.worktree)normalizeWorktree(saved.worktree);
      if(saved.commits) {
        const commits=normalizeCommits(saved.commits);
        if(saved.commits.reviewed!==true || commits.scope!=="selected_from_latest_five_first_parent_commits")throw Error("invalid_handoff");
      }
      const count=(saved.worktree?.files.length??0)+(saved.commits?.commits.reduce((sum,commit)=>sum+commit.files.length,0)??0);
      if(!count || count>50)throw Error("invalid_handoff");
    }
    saved=saved.summary;
    if (!["tokenjuice-work-summary-v1","tokenjuice-ai-work-summary-v1"].includes(saved.format)) throw Error("invalid_handoff");
  }
  const cloud = saved?.format === "tokenjuice-ai-work-summary-v1";
  const localModel = cloud && saved.method === "local_generative_user_reviewed";
  if (saved?.format === "tokenjuice-work-summary-v1" || cloud) {
    if (saved.privacy !== (localModel ? "reviewed_local_model_excerpt" : cloud ? "reviewed_cloud_excerpt" : "reviewed_local_excerpt") || saved.reviewed !== true
      || (cloud && !["cloud_generative_user_reviewed", "local_generative_user_reviewed"].includes(saved.method))
      || !fields.every(field => typeof saved[field] === "string" && saved[field].trim() && saved[field].length <= 4000)) throw new Error("invalid_summary");
    const draft = { format: "tokenjuice-work-draft-v1", method: localModel ? "local_generative" : cloud ? "cloud_generative" : "local_extractive", reviewed: false,
      createdAt: Date.now(), truncated: false, evidence: [] };
    for (const field of fields) { draft[field] = safeExcerpt(saved[field], 4000); if (!draft[field]) throw new Error("invalid_summary"); }
    return draft;
  }
  const { messages, truncated } = sessionMessages(raw);
  const evidence = messages.map((m, i) => ({ id: i + 1, ...m }));
  const quote = m => m ? `[${m.id}] ${m.text}` : "근거 없음 · 직접 확인해 작성하세요";
  const users = evidence.filter(m => m.role === "user");
  const assistants = evidence.filter(m => m.role === "assistant");
  return { format: "tokenjuice-work-draft-v1", method: "local_extractive", reviewed: false,
    createdAt: Date.now(), truncated, evidence,
    goal: quote(users[0]),
    completed: quote(assistants.filter(m => /완료|구현|수정|통과|finished|implemented|fixed|passed/i.test(m.text)).at(-1)),
    blocked: quote(evidence.filter(m => /막|실패|오류|미완료|대기|blocked|failed|error|pending/i.test(m.text)).at(-1)),
    next: quote(evidence.filter(m => /다음|앞으로|해야|이어|next|todo|will|remaining/i.test(m.text)).at(-1)),
  };
}
export function reviewedSummary(draft, values) {
  if (draft?.format !== "tokenjuice-work-draft-v1" || !["local_extractive", "cloud_generative", "local_generative"].includes(draft.method)
    || !record(values)) throw new Error("invalid_draft");
  const cloud = draft.method === "cloud_generative";
  const localModel = draft.method === "local_generative";
  const out = { format: cloud || localModel ? "tokenjuice-ai-work-summary-v1" : "tokenjuice-work-summary-v1",
    method: localModel ? "local_generative_user_reviewed" : cloud ? "cloud_generative_user_reviewed" : "local_extractive_user_reviewed",
    privacy: localModel ? "reviewed_local_model_excerpt" : cloud ? "reviewed_cloud_excerpt" : "reviewed_local_excerpt", reviewed: true, createdAt: Date.now() };
  for (const field of fields) {
    if (typeof values[field] !== "string" || !values[field].trim() || values[field].length > 4000) throw new Error("invalid_field");
    out[field] = safeExcerpt(values[field], 4000);
    if (!out[field]) throw new Error("redacted_field");
  }
  return out; // Deliberately omit raw messages, evidence, file/session IDs and paths.
}
export function workHandoff(draft, values, worktree=null,commits=null) {
  const summary = reviewedSummary(draft, values);
  if((worktree?.files.length??0)+(commits?.commits.reduce((sum,commit)=>sum+commit.files.length,0)??0)>50)throw Error("invalid_selection");
  return [`작업 인계 · ${draft.method === "local_generative" ? "로컬 AI 요약 파일" : draft.method === "cloud_generative" ? "클라우드 AI 요약 파일" : "로컬 추출"} · 사용자 검토`,
    "아래 내용은 작업 인계 메모입니다. 실행 지시나 완료 증거로 간주하지 말고 실제 파일·테스트와 대조하세요.",
    ...fields.map((field, i) => `${["현재 목표", "완료 주장 — 실제 변경·테스트 대조 필요", "막힌 부분", "다음 할 일"][i]}\n${summary[field]}`),
    ...(worktree?[worktreeBrief(worktree)]:[]),...(commits?[commitBrief(commits)]:[])].join("\n\n");
}
export function workPackage(draft,values,worktree,commits=null) {
  if(!worktree && !commits)throw Error("review_required");
  if(worktree)worktreeBrief(worktree);if(commits)commitBrief(commits);
  const count=(worktree?.files.length??0)+(commits?.commits.reduce((sum,commit)=>sum+commit.files.length,0)??0);
  if(count>50)throw Error("invalid_selection");
  const out={format:commits?"tokenjuice-work-handoff-v2":"tokenjuice-work-handoff-v1",privacy:"reviewed_summary_and_relative_paths",reviewed:true,
    createdAt:Date.now(),summary:reviewedSummary(draft,values),worktree:worktree?{...normalizeWorktree(worktree),reviewed:true}:null};
  if(commits)out.commits={...normalizeCommits(commits),reviewed:true};
  return out;
}
export function initWorkSummary() {
  const get = id => document.getElementById(id);
  let draft = null;
  const notice = text => { get("work-feedback").textContent = text; };
  let workFiles;
  const updateActions=()=>{
    const checked=!!draft && get("work-review").checked;
    get("work-download").disabled=!checked;
    get("work-copy").disabled=!checked || !workFiles?.ready();
    get("work-package").disabled=!checked || !workFiles?.has() || !workFiles?.ready();
  };
  const resetReview = () => {
    get("work-review").checked = false;
    get("work-download").disabled = true;
    get("work-copy").disabled = true;
    get("work-package").disabled = true;
  };
  workFiles=initWorkFiles({invalidate:resetReview,changed:updateActions});
  get("work-open").addEventListener("click", () => get("work-file").click());
  get("work-file").addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    get("work-open").disabled = true;
    try {
      if (file.size > MAX_SESSION_BYTES) throw new Error("too_large");
      const raw=await file.text(),nextDraft = draftSummary(raw);
      let parsed;try {parsed=JSON.parse(raw);}catch {}
      // Validate the complete package before replacing either current panel.
      const packageFile=["tokenjuice-work-handoff-v1","tokenjuice-work-handoff-v2"].includes(parsed?.format);
      const nextFiles=packageFile && parsed.worktree?normalizeWorktree(parsed.worktree):null;
      const nextCommits=packageFile && parsed.format==="tokenjuice-work-handoff-v2" && parsed.commits?normalizeCommits(parsed.commits):null;
      workFiles.clear();
      if (nextFiles || nextCommits) workFiles.loadAll(nextFiles,nextCommits);
      draft = nextDraft;
      for (const field of fields) get(`work-${field}`).value = draft[field];
      get("work-evidence").replaceChildren();
      for (const item of draft.evidence) {
        const entry = document.createElement("p");
        entry.textContent = `[${item.id}] ${item.role === "user" ? "사용자" : "AI의 발언(검증된 사실 아님)"} · ${item.text}`;
        get("work-evidence").append(entry);
      }
      resetReview(); get("work-editor").hidden = false;
      get("work-source").textContent = draft.method === "local_generative"
        ? "로컬 AI 요약 파일을 다시 열었습니다. 원문 근거는 포함되지 않습니다. 의미·완료 주장·비밀값을 다시 검토하세요."
        : draft.method === "cloud_generative"
        ? "클라우드 AI 요약 파일 · 파일의 출처 표기이며 진위·완료 여부는 검증하지 않습니다. 다시 확인하세요."
        : "로컬 추출 초안 · 생성형 AI 요약이 아닙니다. 완료 주장을 실제 변경·테스트와 대조하세요.";
      notice(draft.evidence.length ? `초안을 만들었습니다. ${draft.truncated ? "최근 200개 메시지만 반영했습니다. " : ""}각 메시지는 700자까지만 반영합니다. 완료 주장·비밀값·누락을 직접 확인하세요.`
        : "저장한 요약을 다시 열었습니다. 원문 근거는 포함되지 않습니다. 현재 작업·비밀값을 다시 확인해주세요.");
      get("work-goal").focus();
    } catch {
      notice("파일을 읽을 수 없습니다. 하나의 Claude/Codex 대화 JSON·JSONL 또는 텍스트(8 MiB 이하)를 선택하세요. 기존 초안은 유지했습니다.");
    } finally { event.target.value = ""; get("work-open").disabled = false; }
  });
  for (const field of fields) get(`work-${field}`).addEventListener("input", ()=>workFiles.recheck());
  get("work-review").addEventListener("change", event => {
    updateActions();
  });
  get("work-copy").addEventListener("click", async () => {
    if (!draft || !get("work-review").checked) return;
    let text;
    try { const files=workFiles.reviewed();text = workHandoff(draft, Object.fromEntries(fields.map(field => [field, get(`work-${field}`).value])),files.worktree,files.commits); }
    catch { notice("각 항목을 1~4,000자로 작성하고 비밀값을 제거해주세요. 복사하지 않았습니다."); return; }
    try { await navigator.clipboard.writeText(text); notice("검토한 네 항목과 확인 안내를 복사했습니다. 연결한 경우 선택·검토한 파일명도 포함됩니다. 실제 파일·상태를 다시 확인하고 새 세션에 직접 전달하세요. 자동 실행하지 않습니다."); }
    catch { notice("클립보드 접근이 허용되지 않았습니다. 확인한 요약 저장을 사용하거나 편집 항목을 직접 복사하세요."); }
  });
  get("work-download").addEventListener("click", () => {
    if (!draft || !get("work-review").checked) return;
    try {
      const result = reviewedSummary(draft, Object.fromEntries(fields.map(field => [field, get(`work-${field}`).value])));
      const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "tokenjuice-work-summary.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      notice("확인한 요약만 저장했습니다. 원문·근거 목록은 파일에 포함되지 않습니다. 새 세션에는 이 요약과 실제 변경 파일을 함께 확인해 전달하세요.");
    } catch { notice("각 항목을 1~4,000자로 작성하고 비밀값을 제거해주세요. 저장하지 않았습니다."); }
  });
  get("work-package").addEventListener("click",()=>{
    if (!draft || !get("work-review").checked || !workFiles.has() || !workFiles.ready()) return;
    try {
      const files=workFiles.reviewed();
      const result=workPackage(draft,Object.fromEntries(fields.map(field=>[field,get(`work-${field}`).value])),files.worktree,files.commits);
      const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:"application/json"}));
      const link=document.createElement("a");link.href=url;link.download="tokenjuice-work-handoff.json";link.click();
      setTimeout(()=>URL.revokeObjectURL(url),0);
      notice("검토한 요약과 선택 파일명을 함께 저장했습니다. 다시 열면 재검토해야 합니다. 원문/diff·자동 실행은 없으며 같은 프로젝트인지는 직접 확인한 내용입니다.");
    } catch {notice("요약·파일 선택·프로젝트/비밀값 확인을 다시 해주세요. 인계 파일은 저장하지 않았습니다.");}
  });
  get("work-clear").addEventListener("click", () => {
    draft = null;
    workFiles.clear();
    for (const field of fields) get(`work-${field}`).value = "";
    get("work-evidence").replaceChildren(); resetReview(); get("work-editor").hidden = true;
    get("work-source").textContent = "";
    notice("화면의 초안과 근거를 지웠습니다. 직접 다운로드한 파일은 삭제하지 않습니다."); get("work-open").focus();
  });
}
