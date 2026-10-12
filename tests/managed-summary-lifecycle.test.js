import { test, expect } from "bun:test";
import { createManagedSummaryLifecycle } from "../scripts/managed-summary-lifecycle.mjs";
import { createManagedSummaryIngress } from "../scripts/managed-summary-ingress.mjs";
import { createManagedSummarySite } from "../scripts/managed-summary-site.mjs";
import { createManagedSummaryGateway } from "../scripts/managed-summary-gateway.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = "https://summary.example.test";
const req = (path = "/", init = {}) => new Request(`${origin}${path}`, { ...init,
  headers: { host: "summary.example.test", ...init.headers } });
const config = { origin, isReady: () => true, handler: () => new Response("synthetic") };

test("lifecycle config is explicit and health exposes only readiness without handler or provider work", async () => {
  for (const change of [{ origin: "http://summary.example.test" }, { origin: `${origin}/` },
    { origin: "https://user:password@summary.example.test" }, { isReady: undefined },
    { handler: undefined }, { maxActive: 0 }, { maxActive: 257 }, { maxActive: "2" }])
    expect(() => createManagedSummaryLifecycle({ ...config, ...change })).toThrow("invalid_managed_lifecycle");
  let calls = 0;
  for (const predicate of [() => true, () => false, () => "true", () => Promise.resolve(true),
    () => { throw Error("PRIVATE_DATABASE_KEY"); }]) {
    const lifecycle = createManagedSummaryLifecycle({ ...config, isReady: predicate,
      handler: () => { calls++; return new Response("PRIVATE_DATABASE_KEY"); } });
    const health = await lifecycle.handle(req("/healthz"));
    expect([200, 503]).toContain(health.status);
    expect(await health.json()).toEqual({ ready: health.status === 200 });
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect((await lifecycle.handle(req("/healthz?detail=1"))).status).toBe(404);
    expect((await lifecycle.handle(req("/healthz", { method: "POST", body: "PRIVATE" }))).status).toBe(405);
  }
  expect(calls).toBe(0);
});

test("not-ready state and wrong origin/Host cannot reach the wrapped application", async () => {
  let calls = 0, available = false;
  const lifecycle = createManagedSummaryLifecycle({ ...config, isReady: () => available,
    handler: () => { calls++; return new Response("accepted"); } });
  expect((await lifecycle.handle(req())).status).toBe(503);
  expect(calls).toBe(0); available = true;
  expect((await lifecycle.handle(req(undefined, { headers: { host: "evil.test" } }))).status).toBe(403);
  expect((await lifecycle.handle(new Request("https://evil.test/", { headers: { host: "summary.example.test" } }))).status).toBe(403);
  expect(calls).toBe(0); expect((await lifecycle.handle(req())).status).toBe(200); expect(calls).toBe(1);
  expect(await lifecycle.drain()).toEqual({ drained: true });
  expect((await lifecycle.handle(req("/healthz"))).status).toBe(503);
  expect((await lifecycle.handle(req())).status).toBe(503); expect(calls).toBe(1);
});

test("drain waits for accepted work, rejects new requests, and keeps bounded capacity", async () => {
  let release, started;
  const running = new Promise(resolve => { started = resolve; });
  const lifecycle = createManagedSummaryLifecycle({ ...config, maxActive: 1, handler: async () => {
    started(); return await new Promise(resolve => { release = resolve; });
  } });
  const result = lifecycle.handle(req("/api/summary/generate", { method: "POST", body: "synthetic" }));
  await running;
  expect((await lifecycle.handle(req())).status).toBe(429);
  // Capacity isn't a failed dependency: health must not encourage a restart.
  expect((await lifecycle.handle(req("/healthz"))).status).toBe(200);
  let finished = false;
  const drain = lifecycle.drain(1000).then(value => { finished = true; return value; });
  expect((await lifecycle.handle(req())).status).toBe(503); expect(finished).toBe(false);
  const secondDrain = lifecycle.drain(1000);
  release(Response.json({ syntheticDraft: true }, { headers: { "set-cookie": "TEST_COOKIE" } }));
  const response = await result; expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toBe("TEST_COOKIE");
  expect(await response.json()).toEqual({ syntheticDraft: true });
  expect(await drain).toEqual({ drained: true }); expect(await secondDrain).toEqual({ drained: true });
  expect((await lifecycle.handle(req())).status).toBe(503);
});

test("drain deadline does not cancel, refund, dispose or falsely finish pending work", async () => {
  let release;
  const lifecycle = createManagedSummaryLifecycle({ ...config, handler: () => new Promise(resolve => { release = resolve; }) });
  for (const invalid of [0, -1, 120001, "10", NaN]) expect(() => lifecycle.drain(invalid)).toThrow("invalid_drain_timeout");
  const result = lifecycle.handle(req());
  expect(await lifecycle.drain(10)).toEqual({ drained: false });
  expect((await lifecycle.handle(req())).status).toBe(503);
  release(new Response("accepted work finishes after deadline"));
  expect(await (await result).text()).toBe("accepted work finishes after deadline");
  expect(await lifecycle.drain()).toEqual({ drained: true });
  expect((await lifecycle.handle(req())).status).toBe(503);
});

test("handler failures release capacity without reflecting private details", async () => {
  const lifecycle = createManagedSummaryLifecycle({ ...config, maxActive: 1,
    handler: () => { throw Error("PRIVATE_PROVIDER_KEY"); } });
  for (let i = 0; i < 2; i++) {
    const response = await lifecycle.handle(req()); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE_PROVIDER_KEY");
  }
  expect(await lifecycle.drain()).toEqual({ drained: true });
});

test("real loopback ingress/site composition drains without bypassing private-peer or route guards", async () => {
  let server;
  const site = createManagedSummarySite({ origin, gateway: { handle: () => Response.json({ error: "authentication_required" }, { status: 401 }) } });
  const lifecycle = createManagedSummaryLifecycle({ origin, handler: site, isReady: () => true });
  const ingress = createManagedSummaryIngress({ origin, site: lifecycle.handle, transport: "private_http_behind_tls",
    isTrustedPeer: request => server.requestIP(request)?.address === "127.0.0.1" });
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: ingress });
  const base = `http://127.0.0.1:${server.port}`;
  const headers = { host: "summary.example.test" };
  try {
    const health = await fetch(`${base}/healthz`, { headers });
    expect(health.status).toBe(200); expect(await health.json()).toEqual({ ready: true });
    expect((await fetch(`${base}/healthz`, { headers: { host: "evil.test" } })).status).toBe(403);
    expect((await fetch(`${base}/.env`, { headers })).status).toBe(404);
    expect((await fetch(`${base}/api/summary/policy`, { method: "POST", headers, body: "{}" })).status).toBe(401);
    expect(await lifecycle.drain()).toEqual({ drained: true });
    expect((await fetch(`${base}/healthz`, { headers })).status).toBe(503);
    expect((await fetch(base, { headers })).status).toBe(503);
  } finally { await server.stop(true); }
});

const hostTest = process.platform === "win32" ? test.skip : test;
hostTest("accepted gateway generation completes after drain deadline with its attempt reservation preserved", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-drain-test-"));
  let release, markStarted, signal, calls = 0;
  const started = new Promise(resolve => { markStarted = resolve; });
  const gateway = createManagedSummaryGateway({ origin, authenticate: () => ({ subject: "synthetic-drain-user", summaryEnabled: true }),
    apiKey: "SYNTHETIC_ONLY_KEY", options: { model: "test-model", budget: { model: "test-model", maxUSD: .02,
      inputUSDPerMillion: 1, outputUSDPerMillion: 5, verifiedAt: Date.now() } }, budgetDirectory: directory,
    dailyRequests: 2, globalDailyMaxUSD: .04, privacyPolicyURL: `${origin}/privacy`, policyVersion: "v1",
    transport: async (url, init) => {
      calls++;
      if (url.endsWith("count_tokens")) return Response.json({ input_tokens: 10 });
      signal = init.signal; markStarted();
      return await new Promise(resolve => { release = () => resolve(Response.json({ stop_reason: "end_turn",
        content: [{ type: "text", text: JSON.stringify(Object.fromEntries(["goal", "completed", "blocked", "next"]
          .map(field => [field, { text: "합성 확인", evidenceIds: [1] }]))) }], usage: { input_tokens: 10, output_tokens: 20 } })); });
    } });
  const lifecycle = createManagedSummaryLifecycle({ origin, isReady: () => true,
    handler: createManagedSummarySite({ origin, gateway }) });
  const post = (route, body = {}) => req(`/api/summary/${route}`, { method: "POST",
    headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
  try {
    const preview = await (await lifecycle.handle(post("preview", {
      raw: "Synthetic selected excerpt", confirmed: true, policyVersion: "v1" }))).json();
    expect(calls).toBe(0);
    const result = lifecycle.handle(post("generate", { id: preview.id, digest: preview.digest, confirmed: true }));
    await started;
    expect(await lifecycle.drain(10)).toEqual({ drained: false });
    expect(signal.aborted).toBe(false);
    expect((await lifecycle.handle(post("generate", { id: preview.id, digest: preview.digest, confirmed: true }))).status).toBe(503);
    expect(calls).toBe(2);
    release();
    const response = await result; expect(response.status).toBe(200);
    const draft = await response.json(); expect(draft.method).toBe("cloud_generative");
    expect(draft.quota.used).toBe(1); expect(draft.quota.remaining).toBe(1);
    expect(JSON.stringify(draft)).not.toContain("SYNTHETIC_ONLY_KEY");
    expect(await lifecycle.drain()).toEqual({ drained: true }); expect(calls).toBe(2);
  } finally { gateway.dispose(); rmSync(directory, { recursive: true, force: true }); }
});
