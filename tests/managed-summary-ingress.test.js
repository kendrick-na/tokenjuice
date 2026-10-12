import { test, expect } from "bun:test";
import { createManagedSummaryIngress } from "../scripts/managed-summary-ingress.mjs";
import { createManagedSummarySite } from "../scripts/managed-summary-site.mjs";
import { createManagedSummaryGateway } from "../scripts/managed-summary-gateway.mjs";
import { createManagedAppSessions } from "../scripts/managed-summary-sessions.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = "https://summary.example.test";
const incoming = (path = "/", extra = {}) => new Request(`http://summary.example.test${path}`, {
  headers: { host: "summary.example.test", ...extra },
});
const config = { origin, transport: "private_http_behind_tls", isTrustedPeer: () => true,
  site: () => Response.json({ accepted: true }) };

test("ingress requires explicit private TLS termination and server-side peer validation", async () => {
  for (const change of [{ origin: "http://summary.example.test" }, { origin: `${origin}/` },
    { origin: "https://user:password@summary.example.test" }, { site: null },
    { transport: undefined }, { transport: "public_http" }, { isTrustedPeer: undefined }])
    expect(() => createManagedSummaryIngress({ ...config, ...change })).toThrow("invalid_managed_ingress");
  for (const peer of [() => false, () => "true", () => null, () => Promise.resolve(true)]) {
    let calls = 0;
    const ingress = createManagedSummaryIngress({ ...config, isTrustedPeer: peer, site: () => { calls++; return new Response(); } });
    expect((await ingress(incoming("/", { "x-forwarded-proto": "https" }))).status).toBe(403);
    expect(calls).toBe(0);
  }
  const failed = await createManagedSummaryIngress({ ...config, isTrustedPeer: () => { throw Error("PRIVATE_PEER"); } })(incoming());
  expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("PRIVATE_PEER");
});

test("ingress never uses forwarded authority, preserves body and CSRF evidence, and sanitizes failures", async () => {
  let captured;
  const ingress = createManagedSummaryIngress({ ...config, site: async req => {
    captured = { url: req.url, method: req.method, headers: req.headers, body: await req.text() };
    return Response.json({ accepted: true }, { headers: { "set-cookie": "TEST_COOKIE" } });
  } });
  const request = new Request("http://internal.test/api/summary/preview?blocked=1", { method: "POST",
    headers: { host: "summary.example.test", origin: "https://evil.test", "sec-fetch-site": "cross-site",
      "content-type": "application/json", cookie: "TEST_SESSION", "forwarded": "host=evil.test;proto=http",
      "x-forwarded-host": "evil.test", "x-forwarded-proto": "https", "x-forwarded-for": "PRIVATE_IP",
      "x-original-url": "/auth/logout", "x-rewrite-url": "/auth/logout", "x-real-ip": "PRIVATE_IP" },
    body: '{"raw":"synthetic excerpt"}' });
  const response = await ingress(request);
  expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toBe("TEST_COOKIE");
  expect(captured.url).toBe(`${origin}/api/summary/preview?blocked=1`);
  expect(captured.body).toBe('{"raw":"synthetic excerpt"}'); expect(captured.method).toBe("POST");
  expect(captured.headers.get("origin")).toBe("https://evil.test");
  expect(captured.headers.get("sec-fetch-site")).toBe("cross-site");
  expect(captured.headers.get("cookie")).toBe("TEST_SESSION");
  for (const name of ["forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-for", "x-real-ip", "x-original-url", "x-rewrite-url"])
    expect(captured.headers.has(name)).toBe(false);
  for (const req of [incoming("/", { host: "evil.test", "x-forwarded-host": "summary.example.test" }),
    new Request(`${origin}/`, { headers: { host: "summary.example.test" } })])
    expect((await ingress(req)).status).toBe(403);
  const failed = await createManagedSummaryIngress({ ...config, site: () => { throw Error("PRIVATE_KEY"); } })(incoming());
  expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("PRIVATE_KEY");
  expect(failed.headers.get("cache-control")).toBe("no-store");
});

test("actual loopback ingress preserves the site's origin guards, static CSP and private-file exclusion", async () => {
  let server; let calls = 0;
  const site = createManagedSummarySite({ origin, gateway: { handle: async req => {
    calls++;
    if (req.headers.get("origin") !== origin) return Response.json({ error: "same_origin_required" }, { status: 403 });
    return Response.json({ url: req.url, body: await req.json() });
  } } });
  const ingress = createManagedSummaryIngress({ ...config, site,
    isTrustedPeer: request => server.requestIP(request)?.address === "127.0.0.1" });
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: ingress });
  const base = `http://127.0.0.1:${server.port}`;
  try {
    const page = await fetch(base, { headers: { host: "summary.example.test" } });
    expect(page.status).toBe(200); expect(page.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(await page.text()).toContain("이번 TokenJuice 업로드에 동의");
    for (const path of ["/.env", "/config.json", "/scripts/managed-summary-gateway.mjs"])
      expect((await fetch(`${base}${path}`, { headers: { host: "summary.example.test" } })).status).toBe(404);
    expect((await fetch(base, { headers: { host: "evil.test", "x-forwarded-host": "summary.example.test" } })).status).toBe(403);
    for (const from of ["https://evil.test", origin]) {
      const response = await fetch(`${base}/api/summary/preview`, { method: "POST",
        headers: { host: "summary.example.test", origin: from, "content-type": "application/json" }, body: '{"raw":"synthetic only"}' });
      expect(response.status).toBe(from === origin ? 200 : 403);
      if (response.ok) expect((await response.json()).body.raw).toBe("synthetic only");
    }
    expect(calls).toBe(2);
  } finally { await server.stop(true); }
});

const hostTest = process.platform === "win32" ? test.skip : test;
hostTest("ingress connects actual synthetic app sessions and gateway without bypassing authentication, consent or logout", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-ingress-test-"));
  const sessions = createManagedAppSessions({ origin, hasSummaryAccess: () => true });
  const cookie = sessions.issue("synthetic-ingress-user").setCookie.split(";")[0];
  let providerCalls = 0;
  const gateway = createManagedSummaryGateway({ origin, authenticate: sessions.authenticate,
    apiKey: "SYNTHETIC_ONLY_KEY", options: { model: "test-model", budget: { model: "test-model",
      maxUSD: .02, inputUSDPerMillion: 1, outputUSDPerMillion: 5, verifiedAt: Date.now() } },
    budgetDirectory: directory, dailyRequests: 2, globalDailyMaxUSD: .04,
    privacyPolicyURL: `${origin}/privacy`, policyVersion: "v1",
    transport: async () => { providerCalls++; throw Error("NO_PROVIDER_CALL_ALLOWED"); } });
  const ingress = createManagedSummaryIngress({ ...config,
    site: createManagedSummarySite({ origin, gateway, appSessions: sessions }) });
  const req = (path = "/api/summary/policy", body = {}, extra = {}) => new Request(`http://summary.example.test${path}`, {
    method: "POST", headers: { host: "summary.example.test", origin, "content-type": "application/json", cookie, ...extra },
    body: JSON.stringify(body),
  });
  try {
    expect((await ingress(req(undefined, {}, { cookie: "FAKE_COOKIE" }))).status).toBe(401);
    const response = await ingress(req()); expect(response.status).toBe(200);
    const policy = await response.json(); expect(policy.quota.remaining).toBe(2); expect(policy.logoutAvailable).toBe(true);
    expect(JSON.stringify(policy)).not.toContain("SYNTHETIC_ONLY_KEY");
    expect((await ingress(req(undefined, {}, { origin: "https://evil.test" }))).status).toBe(403);
    expect((await ingress(req(undefined, {}, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await ingress(req("/api/summary/policy?override=1"))).status).toBe(403);
    expect((await ingress(req(undefined, { subject: "other-user" }))).status).toBe(400);
    expect((await ingress(req("/api/summary/preview", { raw: "synthetic excerpt" }))).status).toBe(400);
    const logout = await ingress(req("/auth/logout", { confirmed: true }));
    expect(logout.status).toBe(200); expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await ingress(req())).status).toBe(401); expect(providerCalls).toBe(0);
  } finally { gateway.dispose(); sessions.dispose(); rmSync(directory, { recursive: true, force: true }); }
});
