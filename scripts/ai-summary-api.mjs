// Local single-user HTTP adapter. Does not start a listener or discover keys.
// A host must bind 127.0.0.1 only and supply an ephemeral random access token.
import { createHash, timingSafeEqual } from "node:crypto";

const ROUTES = new Set(["preview", "generate", "review", "discard"]);
const PUBLIC_ERRORS = new Set(["approval_unavailable", "consent_required", "approval_already_used",
  "preview_capacity", "draft_unavailable", "summary_running", "review_required", "invalid_field",
  "redacted_field", "too_large", "empty_session", "too_many_records", "multiple_sessions",
  "no_supported_messages", "no_evidence", "invalid_budget_policy", "budget_required", "budget_ledger_required",
  "daily_summary_budget_exceeded", "budget_lock_unavailable", "invalid_budget_file", "budget_clock_rollback",
  "summary_budget_exceeded", "invalid_token_count", "summary_request_failed", "invalid_provider_response",
  "incomplete_summary", "invalid_summary_json", "invalid_evidence", "unsupported_claim", "redacted_summary",
  "local_summary_busy", "local_cloud_disabled_required", "local_model_unavailable", "local_model_verification_failed",
  "invalid_local_model_list", "local_summary_request_failed", "invalid_local_provider_response", "incomplete_local_summary"]);
const json = (value, status = 200) => Response.json(value, { status, headers: {
  "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
  "x-frame-options": "DENY", "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
} });
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value);
const hex = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

async function readBody(request, limit) {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new Error("invalid_body_size");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_request_body");
  const chunks = []; let size = 0, timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("request_body_timeout")), 5000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("invalid_body_size");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let at = 0;
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!plain(value)) throw new Error("invalid_request_body");
    return value;
  } catch (error) {
    // Do not await cancellation: a malicious stream can stall its cancel hook.
    reader.cancel().catch(() => {});
    if (["invalid_body_size", "request_body_timeout"].includes(error.message)) throw error;
    throw new Error("invalid_request_body");
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

export function createLocalSummaryApi({ origin, accessToken, sessions } = {}) {
  const match = typeof origin === "string" && /^http:\/\/127\.0\.0\.1:(\d{1,5})$/.exec(origin);
  if (!match || +match[1] < 1 || +match[1] > 65535 || !hex(accessToken)
    || !["preview", "generate", "review", "discard"].every(method => typeof sessions?.[method] === "function"))
    throw new Error("invalid_local_api_config");
  const expected = Buffer.from(accessToken, "utf8");
  const owner = createHash("sha256").update(accessToken).digest("hex");
  const host = new URL(origin).host;
  let active = 0;
  return async request => {
    const url = new URL(request.url);
    // Exact origin/Host checks also reject DNS-rebinding and public-interface URLs.
    if (url.origin !== origin || (request.headers.has("host") && request.headers.get("host") !== host))
      return json({ error: "local_origin_required" }, 403);
    const route = url.pathname.replace(/^\/api\/summary\//, "");
    if (!url.pathname.startsWith("/api/summary/") || !ROUTES.has(route) || url.search)
      return json({ error: "not_found" }, 404);
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const site = request.headers.get("sec-fetch-site");
    if (request.headers.get("origin") !== origin || (site && site !== "same-origin" && site !== "none"))
      return json({ error: "same_origin_required" }, 403);
    const supplied = request.headers.get("authorization");
    if (!supplied?.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);
    const token = Buffer.from(supplied.slice(7), "utf8");
    if (token.length !== expected.length || !timingSafeEqual(token, expected))
      return json({ error: "authentication_required" }, 401);
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") || ""))
      return json({ error: "json_required" }, 415);
    if (active >= 3) return json({ error: "request_capacity" }, 429);
    active++;
    try {
      const body = await readBody(request, route === "preview" ? 9 * 1024 * 1024 : 20000);
      if (route === "preview") {
        if (!exact(body, ["raw"]) || typeof body.raw !== "string") return json({ error: "invalid_request_body" }, 400);
        return json(sessions.preview(owner, body.raw));
      }
      const keys = route === "generate" ? ["id", "digest", "confirmed"]
        : route === "review" ? ["id", "values", "confirmed"] : ["id"];
      if (!exact(body, keys) || !hex(body.id)
        || (route === "generate" && (!hex(body.digest) || typeof body.confirmed !== "boolean"))
        || (route === "review" && (!exact(body.values, ["goal", "completed", "blocked", "next"])
          || typeof body.confirmed !== "boolean"))) return json({ error: "invalid_request_body" }, 400);
      if (route === "generate") return json(await sessions.generate(owner, body.id, body.digest, body.confirmed));
      if (route === "review") return json(sessions.review(owner, body.id, body.values, body.confirmed));
      sessions.discard(owner, body.id); return json({ discarded: true });
    } catch (error) {
      if (error.message === "invalid_body_size") return json({ error: error.message }, 413);
      if (error.message === "request_body_timeout") return json({ error: error.message }, 408);
      if (error.message === "invalid_request_body") return json({ error: error.message }, 400);
      const code = PUBLIC_ERRORS.has(error.message) || /^(?:local_)?summary_http_[45]\d\d$/.test(error.message)
        ? error.message : "summary_unavailable";
      const status = ["approval_unavailable", "draft_unavailable", "approval_already_used", "summary_running", "local_summary_busy"].includes(code) ? 409
        : ["preview_capacity", "daily_summary_budget_exceeded"].includes(code) ? 429
        : ["consent_required", "review_required", "invalid_field", "redacted_field", "multiple_sessions",
          "empty_session", "no_supported_messages", "no_evidence", "too_large", "too_many_records"].includes(code) ? 400 : 503;
      return json({ error: code }, status);
    } finally { active--; }
  };
}
