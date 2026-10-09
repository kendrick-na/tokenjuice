const KEY = "tokenjuice.widget-snapshot.v1";
const SYNC_FORMAT = "tokenjuice-sync-v1";
const SNAPSHOT_REEXPORT_AFTER_MS = 30 * 60 * 1000;
const $ = (selector) => document.querySelector(selector);
const fileInput = $("#snapshot-file");
const importFeedback = $("#import-feedback");
const liveRegion = $("#live-region");

const stateCopy = {
  fresh: { label: "방금 확인됨", tone: "good", meaning: "이 스냅샷을 만든 시점에 성공적으로 읽은 값입니다.", action: "지금은 계속 작업해도 좋습니다." },
  fallback: { label: "대체 정보", tone: "caution", meaning: "제공자 응답 대신 최근 로컬 기록을 읽은 값입니다.", action: "다음 확인 전까지는 대체 정보입니다." },
  stale: { label: "업데이트 필요", tone: "caution", meaning: "마지막 성공 값입니다. 현재 값으로 가정하면 안 됩니다.", action: "Mac에서 새 스냅샷을 가져오세요." },
  auth_expired: { label: "다시 연결 필요", tone: "danger", meaning: "연결 자격이 만료되어 최신 사용량을 읽지 못했습니다.", action: "Mac에서 Claude 로그인을 다시 확인하세요." },
  rate_limited: { label: "제공자 제한 중", tone: "danger", meaning: "제공자가 다음 확인 가능 시각 전의 요청을 제한하고 있습니다.", action: "다음 확인 가능 시각까지 잠시 기다리세요." },
  unavailable: { label: "확인할 수 없음", tone: "danger", meaning: "확인 가능한 데이터를 찾지 못해 숫자를 표시하지 않았습니다.", action: "데이터 경로와 연결 상태를 확인하세요." },
};

function relativeTime(at) {
  const min = Math.round((Date.now() - Number(at)) / 60000);
  if (!Number.isFinite(min)) return "마지막 확인 시각 없음";
  if (min < 1) return "방금 확인한 스냅샷";
  if (min < 60) return `${min}분 전 확인한 스냅샷`;
  return `${Math.floor(min / 60)}시간 전 확인한 스냅샷`;
}
function snapshotNeedsRefresh(snapshot) {
  const generatedAt = Number(snapshot?.generatedAt);
  return Number.isFinite(generatedAt) && Date.now() - generatedAt >= SNAPSHOT_REEXPORT_AFTER_MS;
}
function timeText(value, prefix = "리셋") {
  if (!value) return `${prefix} 시각 없음`;
  // reset 시각은 provider마다 ISO/Unix seconds가 섞일 수 있지만, snapshot의
  // observedAt/lastSuccessAt/retryAt 계약은 Unix milliseconds다. 밀리초를 다시
  // 1,000배 하면 rate-limit 복구 시각이 엉뚱하게 표시된다.
  const numeric = Number(value);
  const normalized = typeof value === "number" || /^\d+$/.test(String(value))
    ? (numeric > 100_000_000_000 ? numeric : numeric * 1000)
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? `${prefix} 시각 없음` : `${prefix} ${date.toLocaleString("ko-KR", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}`;
}
function valid(snapshot) {
  return snapshot && snapshot.contractVersion === 1 && snapshot.transport === "local_export_only" && Array.isArray(snapshot.claude) && snapshot.codex;
}
function bytes(value) { return Uint8Array.from(atob(value || ""), (char) => char.charCodeAt(0)); }
function validBundle(bundle) {
  const crypto = bundle?.crypto;
  return bundle?.format === SYNC_FORMAT && bundle?.contractVersion === 1 && bundle?.transport === "encrypted_manual_transfer"
    && crypto?.algorithm === "AES-256-GCM" && crypto?.kdf === "PBKDF2-SHA-256" && Number.isInteger(crypto?.iterations)
    && typeof crypto?.salt === "string" && typeof crypto?.iv === "string" && typeof crypto?.tag === "string" && typeof crypto?.ciphertext === "string";
}
async function decryptBundle(bundle, passphrase) {
  const crypto = bundle.crypto;
  const passphraseKey = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bytes(crypto.salt), iterations: crypto.iterations, hash: "SHA-256" },
    passphraseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
  );
  const ciphertext = bytes(crypto.ciphertext), tag = bytes(crypto.tag);
  const sealed = new Uint8Array(ciphertext.length + tag.length); sealed.set(ciphertext); sealed.set(tag, ciphertext.length);
  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(crypto.iv), additionalData: new TextEncoder().encode(SYNC_FORMAT), tagLength: 128 }, key, sealed,
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}
function escapeHtml(value) { const span = document.createElement("span"); span.textContent = String(value ?? ""); return span.innerHTML; }
function announce(message, tone = "") {
  if (importFeedback) {
    importFeedback.hidden = !message;
    importFeedback.className = `import-feedback ${tone}`;
    importFeedback.textContent = message;
  }
  if (liveRegion) liveRegion.textContent = message;
}
function copyFor(payload) { return stateCopy[payload?.state] || stateCopy.unavailable; }
function remaining(item) { return Math.max(0, Math.min(100, 100 - Number(item.used))); }
function metric(item) {
  const left = remaining(item);
  const tone = left < 20 ? "danger" : left < 50 ? "warn" : "";
  const forecast = item.forecast?.beforeReset ? `<span class="forecast danger">리셋 전 소진 예상</span>` : item.forecast ? `<span class="forecast">로컬 추정</span>` : "";
  return `<div class="metric"><div class="metric-line"><span>${escapeHtml(item.name)}</span><strong>${Math.round(left)}<small>% 남음</small></strong></div><div class="bar ${tone}" role="progressbar" aria-label="${escapeHtml(item.name)} ${Math.round(left)}% 남음" aria-valuenow="${Math.round(left)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${left}%"></i></div><div class="metric-meta"><span>${timeText(item.resets)}</span>${forecast}</div></div>`;
}
function card(name, payload, kind) {
  const status = copyFor(payload);
  const itemMarkup = payload.items?.length ? payload.items.map(metric).join("") : "<p class=\"empty-card\">표시할 quota가 없습니다. 이 값은 숨긴 상태가 더 안전합니다.</p>";
  const source = payload.sourceLabel || payload.source || "데이터 경로 정보 없음";
  const observedAt = payload.lastSuccessAt || payload.observedAt;
  return `<article class="account ${kind}"><header class="account-head"><div><span class="account-name">${escapeHtml(name)}</span><span class="source">${escapeHtml(source)}</span></div><span class="state ${status.tone}">${status.label}</span></header>${itemMarkup}<p class="state-explainer"><b>데이터 상태</b>${status.meaning}</p><p class="recovery"><b>다음 행동</b>${status.action}${payload.retryAt ? ` ${timeText(payload.retryAt, "다음 확인")}.` : ""}</p><p class="last-success">${observedAt ? timeText(observedAt, "마지막 성공") : "마지막 성공 시각 없음"}</p></article>`;
}
function allPayloads(snapshot) { return [...snapshot.claude, snapshot.codex, ...(snapshot.providers || [])]; }
function contextSessions(snapshot) {
  return Array.isArray(snapshot.sessions) ? snapshot.sessions.filter((session) => session && session.kind === "context" && Number.isFinite(Number(session.pct))) : [];
}
function contextRisk(snapshot) {
  const session = contextSessions(snapshot).sort((a, b) => Number(b.pct) - Number(a.pct))[0];
  if (!session) return null;
  const pct = Number(session.pct);
  const tone = pct >= 90 ? "danger" : pct >= 80 ? "caution" : "good";
  const label = pct >= 90 ? "컨텍스트 임박" : pct >= 80 ? "checkpoint 권장" : "여유 있음";
  const next = pct >= 90 ? "현재 작업을 정리하고 새 세션으로 전환할 준비를 하세요." : pct >= 80 ? "다음 큰 작업 전에 checkpoint를 남길 시점입니다." : "현재 세션을 계속 사용해도 좋습니다.";
  return { session, pct, tone, label, next };
}
function saveCheckpoint(risk) {
  const session = risk.session;
  const checkpoint = {
    format: "tokenjuice-checkpoint-v1",
    createdAt: Date.now(),
    privacy: "metadata_only",
    platform: session.platform,
    project: session.name || null,
    branch: session.branch || null,
    model: session.model || null,
    context: { used: Number(session.used) || 0, window: Number(session.win) || null, pct: Number(risk.pct.toFixed(1)) },
    status: session.status || null,
    nextAction: risk.next,
  };
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(checkpoint, null, 2)}\n`], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `tokenjuice-checkpoint-${session.name || "session"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
function renderContext(snapshot) {
  const card = $("#context-card");
  const risk = contextRisk(snapshot);
  if (!risk) { card.hidden = true; card.innerHTML = ""; return; }
  const session = risk.session;
  const identity = [session.platform === "claude" ? "Claude" : "Codex", session.name, session.branch].filter(Boolean).join(" · ");
  card.hidden = false;
  card.className = `context-card ${risk.tone}`;
  card.innerHTML = `<div class="context-head"><div><p>작업 컨텍스트</p><h2 id="context-title">${escapeHtml(risk.label)}</h2></div><strong>${Math.round(risk.pct)}<small>% 사용</small></strong></div><div class="context-bar" role="progressbar" aria-label="${escapeHtml(identity)} 컨텍스트 ${Math.round(risk.pct)}% 사용" aria-valuenow="${Math.round(risk.pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, risk.pct)}%"></i></div><p class="context-meta">${escapeHtml(identity)} · ${escapeHtml(session.model || "모델 정보 없음")}</p><p class="context-next"><b>NEXT</b>${escapeHtml(risk.next)}</p><button id="checkpoint-action" type="button">메타데이터 checkpoint 저장 <b aria-hidden="true">↓</b></button>`;
  $("#checkpoint-action").addEventListener("click", () => saveCheckpoint(risk));
}
function priority(snapshot) {
  const payloads = allPayloads(snapshot);
  const issue = payloads.find((payload) => !["fresh", "fallback"].includes(payload.state));
  const context = contextRisk(snapshot);
  if (!issue && context && context.pct >= 80) {
    return {
      eyebrow: "지금 확인할 일",
      title: `${context.session.platform === "claude" ? "Claude" : "Codex"} · ${context.label}`,
      copy: `${context.session.name || "현재 세션"}의 컨텍스트가 ${Math.round(context.pct)}% 사용되었습니다.`,
      tone: context.tone,
      cta: "컨텍스트 상태 보기",
      why: `로컬 세션 로그 추정 · ${context.session.model || "모델 정보 없음"} · ${context.session.win ? `${Math.round(context.session.win / 1000)}k 창` : "창 크기 없음"}`,
      next: context.next,
    };
  }
  if (issue) {
    const state = copyFor(issue);
    return {
      eyebrow: "지금 확인할 일",
      title: `${issue.account || issue.label || "한도"} · ${state.label}`,
      copy: state.action,
      tone: state.tone,
      cta: issue.state === "auth_expired" ? "연결 상태 확인" : "새 스냅샷 가져오기",
      why: `${issue.sourceLabel || issue.source || "데이터 경로 정보 없음"} · ${issue.lastSuccessAt ? timeText(issue.lastSuccessAt, "마지막 성공") : "성공한 확인 없음"}`,
      next: issue.state === "auth_expired" ? "Mac에서 제공자 로그인을 갱신하세요." : state.action,
    };
  }
  const entries = payloads.flatMap((payload) => (payload.items || []).map((item) => ({ payload, item, remaining: remaining(item) })));
  const lowest = entries.sort((a, b) => a.remaining - b.remaining)[0];
  if (lowest) {
    const urgency = lowest.remaining < 20 ? "한도 관리가 필요합니다." : "현재 작업 흐름은 안정적입니다.";
    return {
      eyebrow: "지금 가장 좁은 창",
      title: `${lowest.payload.account || lowest.payload.label || "계정"} · ${lowest.item.name} ${Math.round(lowest.remaining)}% 남음`,
      copy: `${urgency} ${timeText(lowest.item.resets)}.`,
      tone: lowest.remaining < 20 ? "danger" : lowest.remaining < 50 ? "caution" : "good",
      cta: "세부 한도 보기",
      why: `${lowest.payload.sourceLabel || lowest.payload.source || "데이터 경로 정보 없음"} · ${lowest.payload.lastSuccessAt ? timeText(lowest.payload.lastSuccessAt, "마지막 성공") : "성공한 확인 없음"}`,
      next: lowest.remaining < 20 ? "다음 작업 전환을 검토하고, 실제 checkpoint 저장은 다음 단계에서 연결합니다." : "현재 상태를 확인하고 작업을 계속하세요.",
    };
  }
  return {
    eyebrow: "현재 상태",
    title: "표시할 수 있는 한도가 없습니다",
    copy: "숫자를 추정하지 않았습니다. 새 스냅샷에서 상태를 확인하세요.",
    tone: "danger",
    cta: "새 스냅샷 가져오기",
    why: "확인 가능한 provider 데이터가 없습니다.",
    next: "Mac에서 로컬 스냅샷을 내보낸 뒤 다시 가져오세요.",
  };
}
function renderPriority(snapshot) {
  const item = priority(snapshot);
  $("#priority-card").className = `priority-card ${item.tone}`;
  $("#priority-card").innerHTML = `<p id="priority-label">${item.eyebrow}</p><h1>${escapeHtml(item.title)}</h1><div class="decision-grid"><div class="decision-block"><b>NOW</b><span>${escapeHtml(item.copy)}</span></div><div class="decision-block"><b>WHY</b><span>${escapeHtml(item.why)}</span></div><div class="decision-block next"><b>NEXT</b><span>${escapeHtml(item.next)}</span></div></div><button id="priority-action" type="button">${item.cta} <b aria-hidden="true">→</b></button>`;
  $("#priority-action").addEventListener("click", () => {
    if (item.cta.includes("가져오기")) fileInput.click();
    else $("#accounts").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
function render(snapshot, { demo = false } = {}) {
  $("#empty-state").hidden = true; $("#dashboard").hidden = false; $("#clear").hidden = demo;
  updateTransport(demo);
  $("#snapshot-time").textContent = demo ? "예시 데이터 · 기기에 저장하지 않음" : relativeTime(snapshot.generatedAt);
  const providerNeedsAttention = allPayloads(snapshot).some((source) => source.state !== "fresh");
  const transportNeedsRefresh = !demo && snapshotNeedsRefresh(snapshot);
  $("#status-dot").className = providerNeedsAttention || transportNeedsRefresh ? "caution" : "good";
  const snapshotWarning = $("#snapshot-age-warning");
  snapshotWarning.hidden = !transportNeedsRefresh;
  snapshotWarning.innerHTML = transportNeedsRefresh
    ? `<b>스냅샷 업데이트 필요</b><span>이 파일은 ${escapeHtml(relativeTime(snapshot.generatedAt))}. provider 상태와 별개로, Mac에서 새 스냅샷을 내보낸 뒤 다시 가져오세요.</span>`
    : "";
  renderPriority(snapshot);
  renderContext(snapshot);
  const providers = (snapshot.providers || []).map((provider) => card(provider.label || "Local provider", provider, "provider"));
  $("#accounts").innerHTML = [...snapshot.claude.map((account) => card(account.account || "Claude", account, "claude")), card("Codex", snapshot.codex, "codex"), ...providers].join("");
}
function updateTransport(demo = false) {
  $("#transport").textContent = demo
    ? "예시 데이터"
    : navigator.onLine ? "로컬 전용" : "오프라인 · 저장된 스냅샷";
}
function load(snapshot) { localStorage.setItem(KEY, JSON.stringify(snapshot)); render(snapshot); }
function demoSnapshot() {
  const now = Date.now();
  return { contractVersion: 1, generatedAt: now, transport: "local_export_only", claude: [{ account: "Claude", state: "fresh", source: "local example", lastSuccessAt: now, items: [{ name: "5-hour", used: 38, resets: new Date(now + 2 * 3600e3).toISOString() }, { name: "Weekly", used: 61, resets: new Date(now + 3 * 86400e3).toISOString() }] }], codex: { state: "rate_limited", source: "local example", retryAt: now + 38 * 60e3, items: [] }, providers: [] };
}
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0]; if (!file) return;
  announce("스냅샷을 확인하는 중입니다.");
  try {
    let snapshot = JSON.parse(await file.text());
    if (validBundle(snapshot)) {
      const passphrase = window.prompt("이 암호화 번들을 만들 때 사용한 암호를 입력하세요.");
      if (!passphrase) {
        announce("가져오기를 취소했습니다. 암호화 번들은 만든 때의 암호를 입력해야 열 수 있습니다.", "caution");
        return;
      }
      snapshot = await decryptBundle(snapshot, passphrase);
    }
    if (!valid(snapshot)) throw new Error("invalid");
    load(snapshot);
    announce("스냅샷을 가져왔습니다. 가장 먼저 확인할 상태를 표시합니다.", "good");
  } catch { announce("가져올 수 없는 파일입니다. TokenJuice 스냅샷 v1인지 확인한 뒤 다시 시도하세요.", "danger"); }
  finally { fileInput.value = ""; }
});
$("#replace").addEventListener("click", () => fileInput.click());
$("#preview-demo").addEventListener("click", () => render(demoSnapshot(), { demo: true }));
$("#clear").addEventListener("click", () => { localStorage.removeItem(KEY); location.reload(); });
try { const snapshot = JSON.parse(localStorage.getItem(KEY)); if (valid(snapshot)) render(snapshot); } catch { localStorage.removeItem(KEY); }
window.addEventListener("online", () => updateTransport());
window.addEventListener("offline", () => updateTransport());
updateTransport();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
