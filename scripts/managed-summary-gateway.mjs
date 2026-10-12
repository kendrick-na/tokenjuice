// Deployment-independent, single-instance candidate. No listener, account
// discovery, model download, key lookup, request logging or default deployment.
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import { createDailySummaryBudget } from "./ai-summary-budget.mjs";
import { createDailySummaryAttempts } from "./ai-summary-attempts.mjs";
import { createSummarySessions } from "./ai-summary-sessions.mjs";
import { createHostedSummaryApi, readSummaryBody } from "./ai-summary-api.mjs";
import { prepareAiSummary } from "./ai-work-summary.mjs";

const reply = (value, status = 200) => Response.json(value, { status, headers: {
  "cache-control": "no-store", "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer", "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
} });

export function createManagedSummaryGateway({ origin, authenticate, apiKey, options,
  budgetDirectory, dailyRequests, globalDailyMaxUSD, privacyPolicyURL, policyVersion,
  transport, now = Date.now, maxAccounts = 64, authenticationTimeoutMs = 5000 } = {}) {
  let url, policyURL;
  try { url = new URL(origin); policyURL = new URL(privacyPolicyURL); } catch { throw new Error("invalid_gateway_config"); }
  if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password
    || policyURL.protocol !== "https:" || policyURL.username || policyURL.password
    || typeof authenticate !== "function" || typeof apiKey !== "string" || !apiKey.trim() || /[\r\n]/.test(apiKey)
    || typeof policyVersion !== "string" || !/^[a-zA-Z0-9._-]{1,64}$/.test(policyVersion)
    || !Number.isInteger(dailyRequests) || dailyRequests < 1 || dailyRequests > 100
    || !Number.isInteger(maxAccounts) || maxAccounts < 1 || maxAccounts > 256
    || !Number.isInteger(authenticationTimeoutMs) || authenticationTimeoutMs < 10 || authenticationTimeoutMs > 10000
    || ![undefined, "anthropic"].includes(options?.provider)) throw new Error("invalid_gateway_config");
  // Freeze operator-controlled model, pricing and limits. Client overrides are
  // rejected. Never reuse subscription credentials as model API credentials.
  const frozen = JSON.parse(JSON.stringify(options || {}));
  if (!prepareAiSummary("configuration check", frozen).budget) throw new Error("budget_required");
  const globalLedger = createDailySummaryBudget({ directory: budgetDirectory, dailyMaxUSD: globalDailyMaxUSD, now });
  const accounts = new Map();
  let pending = 0;
  const policy = Object.freeze({ mode: "managed_cloud", provider: "anthropic", model: frozen.model,
    policyVersion, privacyPolicyURL, dailyRequests, maxExcerptBytes: 20000,
    requiresProviderKey: false, requiresModelDownload: false,
    transmission: "Selected excerpt goes to TokenJuice, then Anthropic only after generation approval.",
    memoryTTLSeconds: 300, retention: "Gateway does not log or persist excerpts; hosting and provider retention must follow the linked policy." });

  function account(subject) {
    const id = createHash("sha256").update(subject).digest("hex");
    for (const [key, entry] of accounts) {
      if (!entry.active && now() - entry.lastSeen >= 10 * 60000) { entry.sessions.dispose(); accounts.delete(key); }
    }
    if (accounts.has(id)) return accounts.get(id);
    if (accounts.size >= maxAccounts) throw new Error("gateway_capacity");
    const attempts = createDailySummaryAttempts({ directory: join(budgetDirectory, "accounts", id), dailyLimit: dailyRequests, now });
    const sessions = createSummarySessions({ apiKey, options: frozen, transport, now, budgetLedger: {
      reserve(amount) {
        // Failures consume an attempt; never refund uncertain provider calls.
        // Account reservation first is conservative if the global gate fails.
        attempts.reserve(); globalLedger.reserve(amount);
      },
    } });
    const token = randomBytes(32).toString("hex");
    const entry = { sessions, token, attempts, active: 0, lastSeen: now(),
      api: createHostedSummaryApi({ origin, accessToken: token, sessions }) };
    accounts.set(id, entry); return entry;
  }

  return {
    policy,
    async handle(request) {
      if (pending >= 8) return reply({ error: "gateway_capacity" }, 429);
      pending++;
      try {
      const address = new URL(request.url), route = address.pathname;
      if (address.origin !== origin || address.search || request.headers.get("host") !== url.host
        || request.headers.get("origin") !== origin
        || ![null, "same-origin", "none"].includes(request.headers.get("sec-fetch-site")))
        return reply({ error: "same_origin_required" }, 403);
      if (!["/api/summary/policy", "/api/summary/preview", "/api/summary/generate", "/api/summary/review", "/api/summary/discard"].includes(route))
        return reply({ error: "not_found" }, 404);
      if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
      if (request.headers.get("content-type") !== "application/json") return reply({ error: "json_required" }, 415);
      let identity;
      let authTimer;
      try {
        identity = await Promise.race([
          Promise.resolve().then(() => authenticate(request)),
          new Promise((_, reject) => { authTimer = setTimeout(() => reject(Error("authentication_timeout")), authenticationTimeoutMs); }),
        ]);
      } catch { return reply({ error: "authentication_required" }, 401); }
      finally { clearTimeout(authTimer); }
      // authenticate MUST validate a real application session server-side, and
      // resolve entitlement from trusted storage, never request JSON/headers.
      if (typeof identity?.subject !== "string" || !identity.subject || identity.subject.length > 128)
        return reply({ error: "authentication_required" }, 401);
      if (identity.summaryEnabled !== true) return reply({ error: "summary_not_enabled" }, 403);
      let entry;
      try {
        const body = await readSummaryBody(request, route.endsWith("/preview") ? 128000 : 20000);
        if (route.endsWith("/policy")) {
          if (Object.keys(body).length) return reply({ error: "invalid_request_body" }, 400);
          entry = account(identity.subject); entry.active++; entry.lastSeen = now();
          return reply({ ...policy, quota: entry.attempts.snapshot() });
        }
        if (route.endsWith("/preview")) {
          if (Object.keys(body).length !== 3 || body.confirmed !== true || body.policyVersion !== policyVersion)
            return reply({ error: "transmission_consent_required" }, 400);
          if (typeof body.raw !== "string" || !body.raw.trim()
            || new TextEncoder().encode(body.raw).length > policy.maxExcerptBytes)
            return reply({ error: "invalid_excerpt" }, 400);
          // Upload is already an external transfer, even before a model call.
          // UI must redact and show THIS excerpt locally before this route.
          delete body.confirmed; delete body.policyVersion;
        }
        entry = account(identity.subject); entry.active++; entry.lastSeen = now();
        const headers = new Headers(request.headers);
        headers.set("authorization", `Bearer ${entry.token}`);
        const response = await entry.api(new Request(request.url, { method: "POST", headers, body: JSON.stringify(body) }));
        const result = await response.json();
        let quota = null;
        try { quota = entry.attempts.snapshot(); } catch { /* Unknown, never zero. Keep any completed draft. */ }
        return reply({ ...result, quota }, response.status);
      } catch (error) {
        const codes = new Set(["gateway_capacity", "invalid_body_size", "request_body_timeout", "invalid_request_body",
          "attempt_migration_required", "attempt_ledger_unavailable", "attempt_clock_rollback"]);
        return reply({ error: codes.has(error.message) ? error.message : "summary_unavailable" },
          error.message === "gateway_capacity" ? 429 : error.message === "invalid_body_size" ? 413
            : error.message === "request_body_timeout" ? 408 : error.message === "invalid_request_body" ? 400 : 503);
      } finally { if (entry) { entry.active--; entry.lastSeen = now(); } }
      } finally { pending--; }
    },
    dispose() {
      if (pending || [...accounts.values()].some(entry => entry.active)) throw new Error("summary_running");
      for (const entry of accounts.values()) entry.sessions.dispose();
      accounts.clear();
    },
  };
}
