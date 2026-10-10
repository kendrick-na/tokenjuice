// Local extractive drafts, not a generative model. Never execute imported text.
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
  if (saved?.format === "tokenjuice-work-summary-v1") {
    if (saved.privacy !== "reviewed_local_excerpt" || saved.reviewed !== true
      || !fields.every(field => typeof saved[field] === "string" && saved[field].trim() && saved[field].length <= 4000)) throw new Error("invalid_summary");
    const draft = { format: "tokenjuice-work-draft-v1", method: "local_extractive", reviewed: false,
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
  if (draft?.format !== "tokenjuice-work-draft-v1" || !record(values)) throw new Error("invalid_draft");
  const out = { format: "tokenjuice-work-summary-v1", method: "local_extractive_user_reviewed",
    privacy: "reviewed_local_excerpt", reviewed: true, createdAt: Date.now() };
  for (const field of fields) {
    if (typeof values[field] !== "string" || !values[field].trim() || values[field].length > 4000) throw new Error("invalid_field");
    out[field] = safeExcerpt(values[field], 4000);
    if (!out[field]) throw new Error("redacted_field");
  }
  return out; // Deliberately omit raw messages, evidence, file/session IDs and paths.
}
export function initWorkSummary() {
  const get = id => document.getElementById(id);
  let draft = null;
  const notice = text => { get("work-feedback").textContent = text; };
  const resetReview = () => {
    get("work-review").checked = false;
    get("work-download").disabled = true;
  };
  get("work-open").addEventListener("click", () => get("work-file").click());
  get("work-file").addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    get("work-open").disabled = true;
    try {
      if (file.size > MAX_SESSION_BYTES) throw new Error("too_large");
      const nextDraft = draftSummary(await file.text());
      draft = nextDraft;
      for (const field of fields) get(`work-${field}`).value = draft[field];
      get("work-evidence").replaceChildren();
      for (const item of draft.evidence) {
        const entry = document.createElement("p");
        entry.textContent = `[${item.id}] ${item.role === "user" ? "사용자" : "AI의 발언(검증된 사실 아님)"} · ${item.text}`;
        get("work-evidence").append(entry);
      }
      resetReview(); get("work-editor").hidden = false;
      notice(draft.evidence.length ? `초안을 만들었습니다. ${draft.truncated ? "최근 200개 메시지만 반영했습니다. " : ""}각 메시지는 700자까지만 반영합니다. 완료 주장·비밀값·누락을 직접 확인하세요.`
        : "저장한 요약을 다시 열었습니다. 원문 근거는 포함되지 않습니다. 현재 작업·비밀값을 다시 확인해주세요.");
      get("work-goal").focus();
    } catch {
      notice("파일을 읽을 수 없습니다. 하나의 Claude/Codex 대화 JSON·JSONL 또는 텍스트(8 MiB 이하)를 선택하세요. 기존 초안은 유지했습니다.");
    } finally { event.target.value = ""; get("work-open").disabled = false; }
  });
  for (const field of fields) get(`work-${field}`).addEventListener("input", resetReview);
  get("work-review").addEventListener("change", event => { get("work-download").disabled = !event.target.checked; });
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
  get("work-clear").addEventListener("click", () => {
    draft = null;
    for (const field of fields) get(`work-${field}`).value = "";
    get("work-evidence").replaceChildren(); resetReview(); get("work-editor").hidden = true;
    notice("화면의 초안과 근거를 지웠습니다. 직접 다운로드한 파일은 삭제하지 않습니다."); get("work-open").focus();
  });
}
