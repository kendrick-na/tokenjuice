import { safeExcerpt } from "./work-summary.js";
const topics = new Set(["data", "display", "install", "usability", "feature", "other"]);
const states = new Set(["fresh", "fallback", "stale", "auth_expired", "rate_limited", "unavailable"]);

// Deliberately exclude accounts, provider labels, paths, prompts, exact quota,
// IDs, reset times and raw diagnostic output. Never collect device identifiers.
export function feedbackDiagnostics({ snapshot = null, demo = false, expired = false } = {}, now = Date.now()) {
  if (!snapshot) return { source: "no_snapshot", age: "not_applicable", providers: [] };
  if (demo) return { source: "demo_only", age: "not_applicable", providers: [] };
  const age = !Number.isFinite(snapshot.generatedAt) || !Number.isFinite(now) ? "unknown"
    : now < snapshot.generatedAt ? "clock_changed"
    : expired || now - snapshot.generatedAt >= 1800000 ? "older_than_30m" : "under_30m";
  const list = [...(Array.isArray(snapshot.claude) ? snapshot.claude : []).map(value => ["claude", value]),
    ["codex", snapshot.codex], ...(Array.isArray(snapshot.providers) ? snapshot.providers : []).map(value => ["other", value])];
  return { source: "imported_snapshot_not_live", age,
    providers: list.slice(0, 20).map(([provider, value]) => ({ provider, state: states.has(value?.state) ? value.state : "unknown" })),
    truncated: list.length > 20 };
}
export function feedbackReport({ topic, description, includeDiagnostics = false }, context = {}, now = Date.now()) {
  if (!topics.has(topic) || typeof description !== "string" || !description.trim() || description.length > 2000
    || typeof includeDiagnostics !== "boolean") throw Error("invalid_feedback");
  const cleaned = safeExcerpt(description, 2000);
  if (!cleaned) throw Error("empty_feedback");
  return { format: "tokenjuice-feedback-v1", topic, description: cleaned,
    ...(includeDiagnostics ? { diagnostics: feedbackDiagnostics(context, now) } : {}) };
}

export function initFeedback(context) {
  const get = id => document.getElementById(id);
  let report = null;
  const notice = text => { get("feedback-status").textContent = text; };
  const controls = () => {
    const ready = !!report && get("feedback-reviewed").checked;
    get("feedback-copy").disabled = !ready; get("feedback-download").disabled = !ready;
    get("feedback-submit").hidden = !ready;
  };
  const invalidate = () => {
    report = null; get("feedback-reviewed").checked = false;
    get("feedback-preview").textContent = ""; get("feedback-preview-panel").hidden = true;
    controls(); notice("내용이 바뀌었습니다. 미리보기를 새로 만들고 다시 확인하세요. 자동 저장·전송하지 않습니다.");
  };
  get("feedback-open").addEventListener("click", () => {
    get("feedback-panel").open = true; get("feedback-topic").focus();
  });
  for (const id of ["feedback-topic", "feedback-description", "feedback-diagnostics"]) get(id).addEventListener("input", invalidate);
  get("feedback-prepare").addEventListener("click", () => {
    invalidate();
    try {
      report = feedbackReport({ topic: get("feedback-topic").value, description: get("feedback-description").value,
        includeDiagnostics: get("feedback-diagnostics").checked }, context());
      get("feedback-preview").textContent = JSON.stringify(report, null, 2);
      get("feedback-preview-panel").hidden = false;
      notice("이 기기에서 제보 초안을 만들었습니다. 알려진 비밀값·주소 일부를 제외했지만 완전한 탐지가 아닙니다. 원문과 미리보기를 비교하고 공개해도 되는지 확인하세요. 아직 제출하지 않았습니다.");
      get("feedback-preview").focus();
    } catch { notice("문제 상황을 1~2,000자로 적어주세요. 알려진 비밀값만 있는 내용은 공유 초안으로 만들지 않습니다."); }
    controls();
  });
  get("feedback-reviewed").addEventListener("change", controls);
  get("feedback-copy").addEventListener("click", async () => {
    if (!report || !get("feedback-reviewed").checked) return;
    try { await navigator.clipboard.writeText(JSON.stringify(report, null, 2)); notice("검토한 초안을 복사했습니다. GitHub 양식에 직접 붙여넣고 제출해야 접수됩니다."); }
    catch { notice("클립보드 복사를 확인하지 못했습니다. 미리보기에서 직접 복사하거나 JSON으로 저장하세요. 제출하지 않았습니다."); }
  });
  get("feedback-download").addEventListener("click", () => {
    if (!report || !get("feedback-reviewed").checked) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "tokenjuice-feedback.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice("검토한 초안 JSON의 저장을 요청했습니다. 다운로드 파일은 직접 관리하세요. 아직 제출하지 않았습니다.");
  });
  get("feedback-reset").addEventListener("click", () => {
    get("feedback-description").value = ""; get("feedback-diagnostics").checked = false;
    get("feedback-topic").value = "data"; invalidate(); notice("화면의 제보 초안을 지웠습니다. 이미 복사한 클립보드·다운로드 파일·GitHub 제보는 삭제하지 않습니다.");
    get("feedback-topic").focus();
  });
  controls();
}
