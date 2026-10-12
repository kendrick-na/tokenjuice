import { test, expect } from "bun:test";
import { createManagedAppSessions } from "../scripts/managed-summary-sessions.mjs";
const origin = "https://summary.example.test";
const request = (cookie, extra = {}) => new Request(`${origin}/api/summary/policy`, {
  method: "POST", headers: { host: new URL(origin).host, origin, cookie, ...extra },
});
const sessionCookie = session => session.setCookie.split(";", 1)[0];

test("app session is cookie-only, opaque, secure and cannot accept user-chosen or duplicate IDs", async () => {
  const app = createManagedAppSessions({ origin, hasSummaryAccess: () => true });
  try {
    const issued = app.issue("alice"), cookie = sessionCookie(issued);
    expect(issued.setCookie).toContain("Secure; HttpOnly; SameSite=Strict");
    expect(issued.setCookie).not.toContain("alice"); expect(issued.setCookie).not.toContain("Domain=");
    expect(cookie).toMatch(/^__Host-tokenjuice_session=[a-f0-9]{64}$/);
    expect(await app.authenticate(request(cookie))).toEqual({ subject: "alice", summaryEnabled: true });
    expect(await app.authenticate(request("__Host-tokenjuice_session=" + "0".repeat(64)))).toBeNull();
    expect(await app.authenticate(request(`${cookie}; ${cookie}`))).toBeNull();
    expect(await app.authenticate(request("", { authorization: `Bearer ${cookie.split("=")[1]}` }))).toBeNull();
    expect(await app.authenticate(new Request("http://summary.example.test/", { headers: { host: "summary.example.test", cookie } }))).toBeNull();
  } finally { app.dispose(); }
});

test("absolute and idle expiry do not slide indefinitely and restart invalidates capabilities", async () => {
  let time = 1000000;
  const config = { origin, hasSummaryAccess: () => true, now: () => time, ttlMs: 120000, idleMs: 60000 };
  const app = createManagedAppSessions(config);
  const cookie = sessionCookie(app.issue("alice"));
  time += 50000; expect(await app.authenticate(request(cookie))).not.toBeNull();
  time += 50000; expect(await app.authenticate(request(cookie))).not.toBeNull();
  time += 20000; expect(await app.authenticate(request(cookie))).toBeNull();
  const idle = sessionCookie(app.issue("alice"));
  time += 60000; expect(await app.authenticate(request(idle))).toBeNull();
  const valid = sessionCookie(app.issue("alice"));
  expect(await createManagedAppSessions(config).authenticate(request(valid))).toBeNull();
  time -= 1; expect(await app.authenticate(request(valid))).toBeNull(); app.dispose();
});

test("logout and subject revocation win over in-flight access checks", async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const app = createManagedAppSessions({ origin, hasSummaryAccess: () => wait });
  const cookie = sessionCookie(app.issue("alice"));
  const checking = app.authenticate(request(cookie));
  expect(() => app.logout(request(cookie, { origin: "https://evil.test" }))).toThrow("same_origin_required");
  const revoked = app.logout(request(cookie)); expect(revoked.setCookie).toContain("Max-Age=0");
  release(true); expect(await checking).toBeNull();
  const second = sessionCookie(app.issue("alice")); app.revokeSubject("alice");
  expect(await app.authenticate(request(second))).toBeNull(); app.dispose();
});

test("access is checked on every request and failures/timeouts never grant summary rights", async () => {
  let enabled = true, calls = 0;
  const app = createManagedAppSessions({ origin, hasSummaryAccess: () => { calls++; return enabled; } });
  const cookie = sessionCookie(app.issue("alice"));
  expect((await app.authenticate(request(cookie))).summaryEnabled).toBe(true);
  enabled = false; expect((await app.authenticate(request(cookie))).summaryEnabled).toBe(false); expect(calls).toBe(2);
  enabled = "true"; expect(await app.authenticate(request(cookie))).toBeNull(); app.dispose();
  const stuck = createManagedAppSessions({ origin, accessTimeoutMs: 10, hasSummaryAccess: () => new Promise(() => {}) });
  expect(await stuck.authenticate(request(sessionCookie(stuck.issue("alice"))))).toBeNull(); stuck.dispose();
});

test("capacity is bounded, expired entries release it, and malformed config is refused", () => {
  let time = 1000000;
  const app = createManagedAppSessions({ origin, hasSummaryAccess: () => true, maxSessions: 1, ttlMs: 60000, idleMs: 60000, now: () => time });
  app.issue("alice"); expect(() => app.issue("bob")).toThrow("app_session_capacity");
  time += 60000; expect(app.issue("bob").setCookie).toContain("HttpOnly"); app.dispose();
  expect(() => createManagedAppSessions({ origin: "http://summary.example.test", hasSummaryAccess: () => true })).toThrow("invalid_app_session_config");
  expect(() => createManagedAppSessions({ origin, hasSummaryAccess: () => true, ttlMs: 60000 })).toThrow("invalid_app_session_config");
});
