import { prepareManagedExcerpt, validateManagedPolicy, validateManagedQuota } from "/managed-summary/excerpt.js";
import { reviewedSummary } from "/companion/work-summary.js";
const get = id => document.getElementById(id), fields = ["goal", "completed", "blocked", "next"];
let policy = null, selected = null, preview = null, draft = null, busy = false, consumed = false, timer;
const notice = text => { get("status").textContent = text; };
const errors = { authentication_required: "계정 로그인 확인이 필요합니다. 호스트에서 로그인한 뒤 연결을 다시 확인하세요. 선택 내용은 자동 전송하지 않습니다." };
errors.summary_not_enabled = "이 계정의 클라우드 요약이 활성화되지 않았습니다. 기본 추적은 별도 기능입니다.";
errors.daily_summary_budget_exceeded = "하루 요청 시도 또는 전체 운영 한도에 도달했습니다. 자동 재시도하지 않습니다.";
errors.daily_summary_attempts_exceeded = "오늘 요약 요청 시도를 모두 사용했습니다. UTC 날짜가 바뀐 후 직접 다시 확인하세요.";
errors.attempt_ledger_unavailable = "요약 횟수 기록을 안전하게 읽지 못했습니다. 한도를 초기화하지 않았으며 운영자 확인이 필요합니다.";
errors.attempt_clock_rollback = "서버 시각이 기록보다 뒤로 이동했습니다. 한도를 초기화하지 않고 요청을 차단했습니다.";
errors.attempt_migration_required = "이전 예산 기록의 요청 횟수 전환이 필요합니다. 운영자 확인 전 새 한도를 부여하지 않습니다.";
errors.transmission_consent_required = "전송 정책이 바뀌었거나 동의가 누락됐습니다. 연결을 다시 확인하고 발췌를 재선택하세요.";
errors.approval_unavailable = "승인이 만료됐습니다. 발췌 업로드부터 다시 확인하세요.";
errors.approval_already_used = "이미 사용한 승인입니다. 자동 재사용하지 않습니다.";
errors.gateway_capacity = "서버 요청이 많습니다. 잠시 뒤 직접 연결을 다시 확인하세요.";
function quotaFresh() {
  const q = policy?.quota;
  return !!q && Date.now() >= q.observedAt - 1000 && Date.now() - q.observedAt <= 120000 && Date.now() < q.resetsAt;
}
function renderQuota() {
  const q = policy?.quota;
  get("quota").textContent = !q ? "남은 요청 횟수 확인 불가 · 0회나 새 한도로 간주하지 않습니다. 계정 연결을 직접 다시 확인하세요."
    : `${quotaFresh() ? "마지막 확인" : "오래된 관측 · 다시 확인 필요"}: UTC ${q.day} 구간 ${q.remaining}/${q.limit}회 남음 · ${q.used}회 시도 · ${new Date(q.resetsAt).toLocaleString()}에 구간 전환 · 확인 ${new Date(q.observedAt).toLocaleTimeString()}. 실패한 시도도 포함하며 성공 횟수·청구액이 아닙니다.`;
}
function controls() {
  get("connect").disabled = busy;
  get("file").disabled = busy || !policy;
  get("clear").disabled = busy || !(selected || preview || draft);
  get("upload").disabled = busy || !policy || !selected || !!preview || !get("upload-consent").checked;
  get("generate").disabled = busy || !policy || !preview || consumed || Date.now() >= preview.expiresAt
    || (quotaFresh() && policy.quota.remaining === 0) || !get("generate-consent").checked;
  get("save").disabled = busy || !draft || !get("reviewed").checked;
}
async function api(route, body) {
  let response, value;
  try {
    response = await fetch(`/api/summary/${route}`, { method: "POST", credentials: "same-origin", redirect: "error",
      headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(100000) });
    value = await response.json();
  } catch { throw Error("요약 서버 응답을 확인하지 못했습니다. 이미 보낸 요청은 실행됐을 수 있습니다. 자동 재시도하지 않습니다."); }
  if (policy && Object.hasOwn(value, "quota")) { policy.quota = validateManagedQuota(value.quota, policy.dailyRequests); renderQuota(); }
  if (!response.ok) {
    if (response.status === 401 || value.error === "summary_not_enabled") { policy = null; renderQuota(); }
    throw Error(errors[value.error] || "요청에 실패했습니다. 선택·편집 내용은 유지하며 자동 재시도하지 않습니다.");
  }
  return value;
}
async function run(action) {
  if (busy) return;
  busy = true; controls();
  try { await action(); } catch (error) { notice(error.message || "요청을 완료하지 못했습니다."); }
  finally { busy = false; controls(); }
}
async function connect() {
  policy = null;
  renderQuota();
  get("upload-consent").checked = false; get("generate-consent").checked = false;
  try { policy = validateManagedPolicy(await api("policy", {})); }
  catch (error) { if (error.message === "invalid_policy") throw Error("서버의 요약 정책 형식을 확인하지 못했습니다. 업로드하지 않았습니다."); throw error; }
  renderQuota();
  get("privacy").href = policy.privacyPolicyURL;
  if (selected) get("upload-policy").textContent = `${selected.bytes.toLocaleString()} bytes · ${selected.messages.length}개 발언 · ${selected.truncated ? "일부 발언 누락" : "선택 발언 범위"} · 정책 ${policy.policyVersion}. 원문 전체를 요약한다고 보장하지 않습니다.`;
  notice(`계정 요약 권한 확인 · ${policy.model} · 하루 최대 ${policy.dailyRequests}회 요청 시도(UTC). 모델 다운로드나 개인 API 키 입력이 필요하지 않습니다.`);
}
get("connect").addEventListener("click", () => run(connect));
get("file").addEventListener("change", () => run(async () => {
  const file = get("file").files?.[0]; if (!file) return;
  try {
    if (file.size > 8 * 1024 * 1024) throw Error("8 MiB 이하 파일을 선택하세요. 기존 내용은 유지했습니다.");
    let next;
    try { next = prepareManagedExcerpt(await file.text(), policy.maxExcerptBytes); }
    catch { throw Error("지원하는 한 대화 파일을 선택하세요. 기존 내용은 유지했고 업로드하지 않았습니다."); }
    if (preview) await api("discard", { id: preview.id }).catch(() => {});
    selected = next; preview = null; draft = null; consumed = false; clearInterval(timer);
    for (const id of ["upload-consent", "generate-consent", "reviewed"]) get(id).checked = false;
    get("local-excerpt").textContent = selected.raw;
    get("upload-policy").textContent = `${selected.bytes.toLocaleString()} bytes · ${selected.messages.length}개 발언 · ${selected.truncated ? "일부 발언 누락" : "선택 발언 범위"} · 정책 ${policy.policyVersion}. 원문 전체를 요약한다고 보장하지 않습니다.`;
    get("upload-panel").hidden = false; get("preview-panel").hidden = true; get("review-panel").hidden = true;
    notice("이 기기에서 발췌했습니다. 아직 업로드하지 않았습니다. 표시된 JSON과 보존 정책을 확인하세요.");
    get("upload-consent").focus();
  } finally { get("file").value = ""; }
}));
for (const id of ["upload-consent", "generate-consent", "reviewed"]) get(id).addEventListener("change", controls);
get("upload").addEventListener("click", () => run(async () => {
  if (!selected || !policy || preview || !get("upload-consent").checked) return;
  // Turn off consent before awaiting. An uncertain upload cannot auto-retry.
  get("upload-consent").checked = false;
  notice("동의한 발췌를 TokenJuice에 업로드 중입니다. 아직 AI 생성 호출 전이며 중복 전송하지 않습니다.");
  preview = await api("preview", { raw: selected.raw, confirmed: true, policyVersion: policy.policyVersion });
  if (!/^[a-f0-9]{64}$/.test(preview.id || "") || !/^[a-f0-9]{64}$/.test(preview.digest || "")
    || preview.provider !== "anthropic" || preview.payload?.model !== policy.model
    || !Number.isFinite(preview.expiresAt) || !Array.isArray(preview.evidence)) {
    preview = null; throw Error("서버 미리보기 형식이 유효하지 않습니다. 생성하지 않았습니다.");
  }
  consumed = false; get("generate-consent").checked = false;
  get("model-policy").textContent = `Anthropic · ${policy.model} · 이 발췌의 생성 승인은 5분 이내 1회입니다. 운영 예산 계산은 사용자 청구서가 아닙니다.`;
  get("server-excerpt").textContent = JSON.stringify(preview.evidence, null, 2);
  get("payload").textContent = JSON.stringify({ endpoint: preview.endpoint, countEndpoint: preview.countEndpoint, payload: preview.payload }, null, 2);
  get("preview-panel").hidden = false;
  timer = setInterval(() => { get("expiry").textContent = `승인 남은 시간 ${Math.max(0, Math.ceil((preview?.expiresAt - Date.now()) / 1000))}초`; controls(); }, 1000);
  notice("발췌가 TokenJuice에 전달됐습니다. 아직 AI 제공자 호출 전입니다. 생성 승인을 별도로 확인하세요.");
  get("generate-consent").focus();
}));
get("generate").addEventListener("click", () => run(async () => {
  if (!policy || !preview || consumed || !get("generate-consent").checked || Date.now() >= preview.expiresAt) return;
  consumed = true; notice("동의한 발췌로 요약 중입니다. 중복 실행과 자동 재시도를 하지 않습니다.");
  policy.quota = null; renderQuota();
  const result = await api("generate", { id: preview.id, digest: preview.digest, confirmed: true });
  if (result.method !== "cloud_generative" || !fields.every(field => typeof result.summary?.[field]?.text === "string"))
    throw Error("요약 초안 형식을 확인하지 못했습니다. 자동 재시도하지 않습니다.");
  draft = result;
  for (const field of fields) get(field).value = draft.summary[field].text;
  get("evidence").textContent = JSON.stringify({ summary: draft.summary, evidence: draft.evidence }, null, 2);
  get("reviewed").checked = false; get("review-panel").hidden = false;
  notice("AI 초안을 실제 작업과 대조하고 수정하세요. 편집과 저장은 이 기기에서만 처리합니다."); get("goal").focus();
}));
for (const field of fields) get(field).addEventListener("input", () => { get("reviewed").checked = false; controls(); });
get("save").addEventListener("click", () => run(async () => {
  if (!draft || !get("reviewed").checked) return;
  let result;
  try { result = reviewedSummary({ format: "tokenjuice-work-draft-v1", method: "cloud_generative" },
    Object.fromEntries(fields.map(field => [field, get(field).value]))); }
  catch { throw Error("네 항목을 모두 1~4,000자로 작성하고 민감정보를 제거하세요. 저장하지 않았습니다."); }
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "tokenjuice-ai-work-summary.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0); notice("검토한 네 항목만 기기에 저장했습니다. 원문·근거·계정 정보는 제외했습니다.");
}));
get("clear").addEventListener("click", () => run(async () => {
  let cleared = true;
  if (preview) try { await api("discard", { id: preview.id }); } catch { cleared = false; }
  selected = preview = draft = null; consumed = false; clearInterval(timer);
  for (const id of ["upload-consent", "generate-consent", "reviewed"]) get(id).checked = false;
  for (const id of [...fields, "local-excerpt", "server-excerpt", "payload", "evidence", "expiry"]) {
    if (fields.includes(id)) get(id).value = ""; else get(id).textContent = "";
  }
  for (const id of ["upload-panel", "preview-panel", "review-panel"]) get(id).hidden = true;
  notice(cleared ? "화면과 서버 초안을 지웠습니다. 예약 한도와 다운로드 파일은 유지합니다."
    : "화면만 지웠습니다. 서버 삭제는 확인하지 못했으며 실행 중이 아닌 승인 세션은 최대 5분 뒤 만료됩니다.");
}));
if (location.protocol === "file:") { notice("파일로 직접 열면 서버 연결이 되지 않습니다. 운영 호스트의 HTTPS 주소에서 열어야 합니다. 공개 서비스는 아직 미개통입니다."); controls(); }
else run(connect);
setInterval(() => { renderQuota(); controls(); }, 30000);
