const KEY = "tokenjuice.widget-snapshot.v1";
const SYNC_FORMAT = "tokenjuice-sync-v1";
const $ = (selector) => document.querySelector(selector);
const fileInput = $("#snapshot-file");

function relativeTime(at) {
  const min = Math.round((Date.now() - Number(at)) / 60000);
  if (!Number.isFinite(min)) return "시각 정보 없음";
  if (min < 1) return "방금 내보냄";
  if (min < 60) return `${min}분 전 내보냄`;
  return `${Math.floor(min / 60)}시간 전 내보냄`;
}
function resetText(value) {
  if (!value) return "리셋 시각 없음";
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? "리셋 시각 없음" : `리셋 ${date.toLocaleString("ko-KR", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}`;
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
function metric(item) {
  const remaining = Math.max(0, Math.min(100, 100 - Number(item.used)));
  const tone = remaining < 20 ? "danger" : remaining < 50 ? "warn" : "";
  return `<div class="metric"><div class="metric-line"><span>${escapeHtml(item.name)}</span><strong>${Math.round(remaining)}%</strong></div><div class="bar ${tone}"><i style="width:${remaining}%"></i></div><div class="meta">${resetText(item.resets)}</div></div>`;
}
function escapeHtml(value) { const span = document.createElement("span"); span.textContent = String(value ?? ""); return span.innerHTML; }
function card(name, payload, kind) {
  const state = payload.state || "unavailable";
  const itemMarkup = payload.items?.length ? payload.items.map(metric).join("") : "<p class=\"notice\">현재 표시할 수 있는 quota가 없습니다.</p>";
  const detail = state === "fresh" ? "최신 로컬 스냅샷" : `현재 상태: ${escapeHtml(state.replaceAll("_", " "))}`;
  return `<article class="account ${kind}"><header class="account-head"><span class="account-name">${escapeHtml(name)}</span><span class="state ${escapeHtml(state)}">${escapeHtml(state)}</span></header>${itemMarkup}<p class="notice">${detail}</p></article>`;
}
function render(snapshot) {
  $("#empty-state").hidden = true; $("#dashboard").hidden = false; $("#clear").hidden = false;
  $("#snapshot-time").textContent = relativeTime(snapshot.generatedAt);
  const stale = [...snapshot.claude, snapshot.codex].some((source) => source.state !== "fresh");
  $("#status-dot").style.background = stale ? "var(--yellow)" : "var(--green)";
  const providers = (snapshot.providers || []).map((provider) => card(provider.label || "Local provider", provider, "provider"));
  $("#accounts").innerHTML = [...snapshot.claude.map((account) => card(account.account || "Claude", account, "claude")), card("Codex", snapshot.codex, "codex"), ...providers].join("");
}
function load(snapshot) { localStorage.setItem(KEY, JSON.stringify(snapshot)); render(snapshot); }
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0]; if (!file) return;
  try {
    let snapshot = JSON.parse(await file.text());
    if (validBundle(snapshot)) {
      const passphrase = window.prompt("이 암호화 번들을 만들 때 사용한 암호를 입력하세요.");
      if (!passphrase) return;
      snapshot = await decryptBundle(snapshot, passphrase);
    }
    if (!valid(snapshot)) throw new Error("invalid");
    load(snapshot);
  } catch { alert("TokenJuice 스냅샷 v1 또는 올바른 암호화 번들이 아닙니다."); }
  finally { fileInput.value = ""; }
});
$("#replace").addEventListener("click", () => fileInput.click());
$("#clear").addEventListener("click", () => { localStorage.removeItem(KEY); location.reload(); });
try { const snapshot = JSON.parse(localStorage.getItem(KEY)); if (valid(snapshot)) render(snapshot); } catch { localStorage.removeItem(KEY); }
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
