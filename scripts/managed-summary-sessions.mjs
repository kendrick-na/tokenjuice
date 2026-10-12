// Application sessions AFTER a host login provider verifies identity.
// No password login, OAuth callback, token discovery, public issuance or storage.
import { randomBytes, createHash } from "node:crypto";
const NAME = "__Host-tokenjuice_session";
const digest = value => createHash("sha256").update(value).digest("hex");
const subjectValid = value => typeof value === "string" && value.length > 0 && value.length <= 128;

export function createManagedAppSessions({ origin, hasSummaryAccess, now = Date.now,
  ttlMs = 8 * 3600000, idleMs = 30 * 60000, accessTimeoutMs = 5000, maxSessions = 512 } = {}) {
  let url;
  try { url = new URL(origin); } catch { throw Error("invalid_app_session_config"); }
  if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password
    || typeof hasSummaryAccess !== "function" || typeof now !== "function"
    || !Number.isInteger(ttlMs) || ttlMs < 60000 || ttlMs > 86400000
    || !Number.isInteger(idleMs) || idleMs < 60000 || idleMs > ttlMs
    || !Number.isInteger(accessTimeoutMs) || accessTimeoutMs < 10 || accessTimeoutMs > 10000
    || !Number.isInteger(maxSessions) || maxSessions < 1 || maxSessions > 4096) throw Error("invalid_app_session_config");
  const sessions = new Map();
  const stamp = () => { const value = now(); if (!Number.isSafeInteger(value) || value < 0) throw Error("invalid_app_session_clock"); return value; };
  const valid = (entry, time) => time >= entry.lastSeen && time < entry.expiresAt && time - entry.lastSeen < idleMs;
  const prune = time => { for (const [key, entry] of sessions) if (!valid(entry, time)) sessions.delete(key); };
  const cookie = (token, age) => `${NAME}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
  function lookup(request) {
    const address = new URL(request.url);
    if (address.origin !== origin || request.headers.get("host") !== url.host) return null;
    const raw = request.headers.get("cookie") || "";
    if (raw.length > 8192) return null;
    const values = raw.split(";").map(part => part.trim()).filter(part => part.split("=", 1)[0] === NAME);
    if (values.length !== 1) return null;
    const token = values[0].slice(NAME.length + 1);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    return digest(token);
  }
  return {
    // Server-only: call only with an identity freshly verified by the host's
    // login provider. Never expose a route accepting arbitrary subject JSON.
    issue(verifiedSubject) {
      if (!subjectValid(verifiedSubject)) throw Error("verified_identity_required");
      const time = stamp(); prune(time);
      if (sessions.size >= maxSessions) throw Error("app_session_capacity");
      const token = randomBytes(32).toString("hex"), expiresAt = time + ttlMs;
      sessions.set(digest(token), { subject: verifiedSubject, issuedAt: time, lastSeen: time, expiresAt });
      // Cookie is a secret capability: host sends it ONLY as Set-Cookie.
      return { setCookie: cookie(token, Math.floor(ttlMs / 1000)), expiresAt };
    },
    async authenticate(request) {
      const time = stamp(); prune(time);
      const key = lookup(request), entry = key && sessions.get(key);
      if (!entry) return null;
      let timer, enabled;
      const controller = new AbortController();
      try {
        enabled = await Promise.race([
          Promise.resolve().then(() => hasSummaryAccess(entry.subject, { signal: controller.signal })),
          new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error("access_timeout")); }, accessTimeoutMs); }),
        ]);
      } catch { return null; }
      finally { clearTimeout(timer); }
      // Logout/revocation/expiry during an awaited access check must win.
      const completed = stamp();
      if (sessions.get(key) !== entry || !valid(entry, completed)) { sessions.delete(key); return null; }
      if (enabled !== true && enabled !== false) return null;
      entry.lastSeen = completed;
      return { subject: entry.subject, summaryEnabled: enabled };
    },
    logout(request) {
      if (request.method !== "POST" || request.headers.get("origin") !== origin
        || ![null, "same-origin", "none"].includes(request.headers.get("sec-fetch-site"))) throw Error("same_origin_required");
      const key = lookup(request);
      if (!key) throw Error("authentication_required");
      sessions.delete(key);
      return { setCookie: cookie("", 0) };
    },
    revokeSubject(subject) {
      if (!subjectValid(subject)) throw Error("verified_identity_required");
      for (const [key, entry] of sessions) if (entry.subject === subject) sessions.delete(key);
    },
    dispose() { sessions.clear(); },
  };
}
