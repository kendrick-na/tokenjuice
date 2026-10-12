import { test, expect } from "bun:test";
import { createManagedAppSessions } from "../scripts/managed-summary-sessions.mjs";
import { createManagedSummarySite } from "../scripts/managed-summary-site.mjs";
const origin = "https://summary.example.test";
const request = (cookie, body = { confirmed: true }, extra = {}, path = "/auth/logout") => new Request(`${origin}${path}`, {
  method: "POST", headers: { host: "summary.example.test", origin, "content-type": "application/json", cookie, ...extra }, body: JSON.stringify(body),
});

test("logout route revokes the app session, clears cookie only in headers and rejects CSRF/schema overrides", async () => {
  const app = createManagedAppSessions({ origin, hasSummaryAccess: () => true });
  const issued = app.issue("PRIVATE_TEST_SUBJECT"), cookie = issued.setCookie.split(";", 1)[0];
  const site = createManagedSummarySite({ origin, appSessions: app, gateway: { handle: async req => {
    const identity = await app.authenticate(req);
    return Response.json(identity ? { mode: "managed_cloud" } : { error: "authentication_required" }, { status: identity ? 200 : 401 });
  } } });
  try {
    for (const [body, headers, path] of [[{}, {}, "/auth/logout"], [{ confirmed: false }, {}, "/auth/logout"],
      [{ confirmed: true, subject: "other" }, {}, "/auth/logout"], [{ confirmed: true }, { origin: "https://evil.test" }, "/auth/logout"],
      [{ confirmed: true }, {}, "/auth/logout?subject=other"]]) {
      expect((await site(request(cookie, body, headers, path))).status).not.toBe(200);
      expect(await app.authenticate(request(cookie))).not.toBeNull();
    }
    const policy = await site(request(cookie, {}, {}, "/api/summary/policy")).then(r => r.json());
    const getLogout = new Request(`${origin}/auth/logout`, { headers: { host: "summary.example.test", origin, cookie } });
    expect((await site(getLogout)).status).toBe(403);
    expect(await app.authenticate(request(cookie))).not.toBeNull();
    expect((await site(request(cookie, { confirmed: true }, { "content-type": "text/plain" }))).status).toBe(415);
    expect(await app.authenticate(request(cookie))).not.toBeNull();
    expect((await site(request(cookie, { confirmed: true, text: "x".repeat(1100) }))).status).toBe(413);
    expect(await app.authenticate(request(cookie))).not.toBeNull();
    expect(policy.logoutAvailable).toBe(true);
    const response = await site(request(cookie)); expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe('{"loggedOut":true}');
    expect(await app.authenticate(request(cookie))).toBeNull();
    expect((await site(request(cookie, {}, {}, "/api/summary/policy"))).status).toBe(401);
  } finally { app.dispose(); }
});

test("logout without a configured session layer is explicitly unavailable and private failures are sanitized", async () => {
  const gateway = { handle: () => Response.json({ mode: "managed_cloud" }) };
  const site = createManagedSummarySite({ origin, gateway });
  expect((await site(request(""))).status).toBe(503);
  expect((await site(request("", {}, {}, "/api/summary/policy")).then(r => r.json())).logoutAvailable).toBe(false);
  const failed = createManagedSummarySite({ origin, gateway, appSessions: { logout: () => { throw Error("PRIVATE_FAILURE_TOKEN"); } } });
  const response = await failed(request("")); expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("PRIVATE_FAILURE_TOKEN");
});
