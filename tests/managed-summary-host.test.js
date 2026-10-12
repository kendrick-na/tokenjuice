import { test, expect } from "bun:test";
import { startManagedSummaryHost } from "../scripts/managed-summary-host.mjs";

const origin = "https://summary.example.test";
const headers = { host: "summary.example.test", origin, "content-type": "application/json" };
const config = { origin, gateway: { handle: () => Response.json({ error: "authentication_required" }, { status: 401 }) },
  isReady: () => true, verifyPeer: peer => peer.address === "127.0.0.1", onStopped: () => {} };

test("host refuses implicit public binding, missing socket verification/cleanup and invalid config before starting", () => {
  for (const change of [{ hostname: "0.0.0.0" }, { hostname: "::" }, { port: -1 }, { port: "4179" },
    { port: 65536 }, { verifyPeer: undefined }, { onStopped: undefined }, { isReady: undefined },
    { origin: "http://summary.example.test" }, { gateway: {} }])
    expect(() => startManagedSummaryHost({ ...config, ...change })).toThrow();
});

test("runtime serves static UI and minimal health but does not create login or expose private files", async () => {
  let cleanup = 0;
  const host = startManagedSummaryHost({ ...config, onStopped: () => { cleanup++; } });
  const base = `http://127.0.0.1:${host.port}`;
  try {
    expect(host.port).toBeGreaterThan(0);
    const health = await fetch(`${base}/healthz`, { headers });
    expect(health.status).toBe(200); expect(await health.json()).toEqual({ ready: true });
    const page = await fetch(base, { headers });
    expect(page.status).toBe(200); expect(page.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(await page.text()).toContain("API 키");
    for (const path of ["/.env", "/config.json", "/auth/login", "/test/session", "/scripts/managed-summary-host.mjs"])
      expect((await fetch(`${base}${path}`, { headers })).status).toBe(404);
    expect((await fetch(base, { headers: { host: "evil.test", "x-forwarded-host": "summary.example.test" } })).status).toBe(403);
    expect((await fetch(`${base}/api/summary/policy`, { method: "POST", headers, body: "{}" })).status).toBe(401);
    expect(await host.stop()).toEqual({ stopped: true });
    expect(await host.stop()).toEqual({ stopped: true }); expect(cleanup).toBe(1);
  } finally { await host.stop(); }
});

test("peer predicate receives actual socket information rather than client-controlled forwarding headers", async () => {
  let observed, calls = 0;
  const host = startManagedSummaryHost({ ...config, verifyPeer: peer => { observed = peer; return false; },
    gateway: { handle: () => { calls++; return new Response(); } } });
  try {
    const response = await fetch(`http://127.0.0.1:${host.port}/api/summary/policy`, { method: "POST", body: "{}",
      headers: { ...headers, "x-real-ip": "FAKE_PEER", "x-forwarded-for": "FAKE_PEER" } });
    expect(response.status).toBe(403); expect(calls).toBe(0);
    expect(observed.address).toBe("127.0.0.1"); expect(observed.port).toBeGreaterThan(0);
    expect(Object.isFrozen(observed)).toBe(true); expect(JSON.stringify(observed)).not.toContain("FAKE_PEER");
  } finally { expect(await host.stop()).toEqual({ stopped: true }); }
});

test("stop deadline leaves accepted work and cleanup intact; retry closes once after completion", async () => {
  let release, markStarted, cleaned = 0, host, inFlight;
  const started = new Promise(resolve => { markStarted = resolve; });
  host = startManagedSummaryHost({ ...config, onStopped: () => { cleaned++; }, gateway: { handle: async () => {
    markStarted(); return await new Promise(resolve => { release = () => resolve(Response.json({ syntheticDraft: true })); });
  } } });
  const base = `http://127.0.0.1:${host.port}`;
  try {
    for (const invalid of [0, -1, 120001, "10"])
      await expect(host.stop(invalid)).rejects.toThrow("invalid_stop_timeout");
    inFlight = fetch(`${base}/api/summary/generate`, { method: "POST", headers, body: "{}" });
    await started;
    expect(await host.stop(10)).toEqual({ stopped: false }); expect(cleaned).toBe(0);
    expect((await fetch(`${base}/healthz`, { headers })).status).toBe(503);
    expect((await fetch(base, { headers })).status).toBe(503);
    release(); const response = await inFlight;
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ syntheticDraft: true });
    expect(await Promise.all([host.stop(1000), host.stop(1000)])).toEqual([{ stopped: true }, { stopped: true }]);
    expect(cleaned).toBe(1);
  } finally { release?.(); if (inFlight) await inFlight.catch(() => {}); await host.stop(); }
});

test("slow or failed cleanup never reports success, retries disposal or leaks private details", async () => {
  let release, markCleanupStarted, cleanup = 0;
  const cleanupStarted = new Promise(resolve => { markCleanupStarted = resolve; });
  const host = startManagedSummaryHost({ ...config, onStopped: () => {
    cleanup++; markCleanupStarted(); return new Promise(resolve => { release = resolve; });
  } });
  try {
    const firstStop = host.stop(10);
    await cleanupStarted;
    expect(await firstStop).toEqual({ stopped: false }); expect(cleanup).toBe(1);
    release(); expect(await host.stop()).toEqual({ stopped: true }); expect(cleanup).toBe(1);
  } finally { release?.(); await host.stop(); }
  const failed = startManagedSummaryHost({ ...config, onStopped: () => { throw Error("PRIVATE_STORAGE_KEY"); } });
  expect(await failed.stop()).toEqual({ stopped: false });
  expect(JSON.stringify(await failed.stop())).not.toContain("PRIVATE_STORAGE_KEY");
});
