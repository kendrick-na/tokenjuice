import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createManagedSummaryGateway } from "../scripts/managed-summary-gateway.mjs";
import { createLocalSummaryApi } from "../scripts/ai-summary-api.mjs";

const hostTest = process.platform === "win32" ? test.skip : test;
const origin = "https://summary.example.test";
const options = { model: "test-model", budget: { model: "test-model", maxUSD: .02,
  inputUSDPerMillion: 1, outputUSDPerMillion: 5, verifiedAt: Date.now() } };
const request = (route, body = {}, account = "alice", extra = {}) => new Request(`${origin}/api/summary/${route}`, {
  method: "POST", headers: { host: new URL(origin).host, origin, "content-type": "application/json",
    authorization: `Bearer TEST_SESSION_${account}`, ...extra }, body: JSON.stringify(body),
});
function fixture(directory, overrides = {}) {
  const calls = [];
  const config = { origin, apiKey: "TEST_SERVER_ONLY_PROVIDER_KEY", options, budgetDirectory: directory,
    dailyRequests: 1, globalDailyMaxUSD: .04, privacyPolicyURL: "https://summary.example.test/privacy", policyVersion: "v1",
    authenticate: async req => {
      const token = req.headers.get("authorization");
      if (!/^Bearer TEST_SESSION_(alice|bob|disabled)$/.test(token || "")) return null;
      return { subject: token.slice("Bearer TEST_SESSION_".length), summaryEnabled: !token.endsWith("disabled") };
    },
    transport: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("count_tokens")) return Response.json({ input_tokens: 10 });
      return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(
        Object.fromEntries(["goal", "completed", "blocked", "next"].map(field => [field, { text: "합성 확인", evidenceIds: [1] }]))) }],
        usage: { input_tokens: 10, output_tokens: 20 } });
    }, ...overrides };
  return { gateway: createManagedSummaryGateway(config), calls, config };
}
const preview = async (gateway, account = "alice") => gateway.handle(request("preview", {
  raw: "Selected synthetic excerpt", confirmed: true, policyVersion: "v1" }, account)).then(r => r.json());
const generate = (gateway, p, account = "alice", confirmed = true) => gateway.handle(request("generate", {
  id: p.id, digest: p.digest, confirmed }, account));

hostTest("managed cloud verifies application session and two separate consents; never exposes provider key", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-managed-test-"));
  const { gateway, calls } = fixture(directory);
  try {
    expect((await gateway.handle(request("policy", {}, "anonymous"))).status).toBe(401);
    expect((await gateway.handle(request("policy", {}, "disabled"))).status).toBe(403);
    expect((await gateway.handle(request("policy", {}, "alice", { origin: "https://evil.test" }))).status).toBe(403);
    const policy = await gateway.handle(request("policy")).then(r => r.json());
    expect(policy.requiresProviderKey).toBe(false); expect(policy.requiresModelDownload).toBe(false);
    expect(JSON.stringify(policy)).not.toContain("TEST_SERVER_ONLY");
    for (const body of [{ raw: "test" }, { raw: "test", confirmed: true, policyVersion: "old" },
      { raw: "test", confirmed: true, policyVersion: "v1", model: "other" }])
      expect((await gateway.handle(request("preview", body))).status).toBe(400);
    expect(calls).toHaveLength(0);
    const p = await preview(gateway);
    expect(p.id).toMatch(/^[a-f0-9]{64}$/); expect(calls).toHaveLength(0);
    expect(JSON.stringify(p)).not.toContain("TEST_SERVER_ONLY");
    expect((await generate(gateway, p, "bob")).status).toBe(409);
    expect((await generate(gateway, p, "alice", false)).status).toBe(400);
    expect(calls).toHaveLength(0);
    const response = await generate(gateway, p);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const draft = await response.json(); expect(draft.method).toBe("cloud_generative");
    expect(JSON.stringify(draft)).not.toContain("TEST_SERVER_ONLY");
    expect(calls).toHaveLength(2); expect(calls[0].init.headers["x-api-key"]).toBe("TEST_SERVER_ONLY_PROVIDER_KEY");
    expect((await generate(gateway, p)).status).toBe(409);
  } finally { gateway.dispose(); rmSync(directory, { recursive: true, force: true }); }
});

hostTest("per-account attempts and shared operator budget persist across gateway recreation, without excerpts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-managed-test-"));
  let { gateway, calls } = fixture(directory, { globalDailyMaxUSD: .02 });
  try {
    expect((await generate(gateway, await preview(gateway))).status).toBe(200);
    gateway.dispose(); ({ gateway, calls } = fixture(directory, { globalDailyMaxUSD: .02 }));
    const p = await preview(gateway);
    const limited = await generate(gateway, p);
    expect(limited.status).toBe(429); expect(calls).toHaveLength(0);
    const other = await generate(gateway, await preview(gateway, "bob"), "bob");
    expect(other.status).toBe(429); expect(calls).toHaveLength(0);
    const ledger = readFileSync(join(directory, "daily-budget.json"), "utf8");
    expect(ledger).not.toContain("excerpt"); expect(ledger).not.toContain("alice");
    for (const name of readdirSync(join(directory, "accounts"))) expect(name).toMatch(/^[a-f0-9]{64}$/);
  } finally { gateway.dispose(); rmSync(directory, { recursive: true, force: true }); }
});

hostTest("failed provider call consumes daily allowance and does not silently retry or fall back", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-managed-test-")); let calls = 0;
  const { gateway } = fixture(directory, { transport: async () => { calls++; return new Response("PRIVATE_ERROR", { status: 429 }); } });
  try {
    const p = await preview(gateway);
    const failed = await generate(gateway, p);
    expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("PRIVATE_ERROR");
    expect((await generate(gateway, p)).status).toBe(409);
    expect((await generate(gateway, await preview(gateway))).status).toBe(429);
    expect(calls).toBe(1);
  } finally { gateway.dispose(); rmSync(directory, { recursive: true, force: true }); }
});

hostTest("gateway bounds excerpts, accounts, request fields and origin while leaving local API loopback-only", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-managed-test-"));
  const { gateway, calls } = fixture(directory, { maxAccounts: 1 });
  try {
    const bad = await gateway.handle(request("preview", { raw: "가".repeat(7000), confirmed: true, policyVersion: "v1" }));
    expect(bad.status).toBe(400);
    await preview(gateway);
    expect((await gateway.handle(request("preview", { raw: "selected", confirmed: true, policyVersion: "v1" }, "bob"))).status).toBe(429);
    expect(calls).toHaveLength(0);
    expect(() => createLocalSummaryApi({ origin })).toThrow("invalid_local_api_config");
    expect(() => fixture(directory, { origin: "http://summary.example.test" })).toThrow("invalid_gateway_config");
    expect(() => fixture(directory, { options: { ...options, provider: "ollama_local" } })).toThrow("invalid_gateway_config");
  } finally { gateway.dispose(); rmSync(directory, { recursive: true, force: true }); }
});

hostTest("in-flight authentication has a bounded capacity, and rejects disposal until drained", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-managed-test-"));
  let release; const gate = new Promise(resolve => { release = resolve; });
  const { gateway } = fixture(directory, { authenticate: async () => { await gate; return null; } });
  const pending = Array.from({ length: 8 }, () => gateway.handle(request("policy")));
  try {
    expect((await gateway.handle(request("policy"))).status).toBe(429);
    expect(() => gateway.dispose()).toThrow("summary_running");
    release(); for (const response of await Promise.all(pending)) expect(response.status).toBe(401);
  } finally { release(); await Promise.all(pending); gateway.dispose(); rmSync(directory, { recursive: true, force: true }); }
});

hostTest("authenticated quota persists after pricing changes and failed requests consume attempts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-managed-test-"));
  let { gateway, calls } = fixture(directory);
  try {
    const initial = await gateway.handle(request("policy")).then(r => r.json());
    expect(initial.quota).toMatchObject({ used: 0, remaining: 1, limit: 1 });
    const first = await generate(gateway, await preview(gateway)).then(r => r.json());
    expect(first.quota).toMatchObject({ used: 1, remaining: 0 });
    gateway.dispose(); ({ gateway, calls } = fixture(directory, { options: { ...options, budget: { ...options.budget, maxUSD: .001 } } }));
    const after = await gateway.handle(request("policy")).then(r => r.json());
    expect(after.quota.remaining).toBe(0);
    const failed = await generate(gateway, await preview(gateway));
    expect(failed.status).toBe(429); expect((await failed.json()).error).toBe("daily_summary_attempts_exceeded");
    expect(calls).toHaveLength(0);
    const bob = await gateway.handle(request("policy", {}, "bob")).then(r => r.json());
    expect(bob.quota.remaining).toBe(1);
  } finally { gateway.dispose(); rmSync(directory, { recursive: true, force: true }); }
});

hostTest("completed draft survives unavailable quota observation without a fabricated allowance", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tokenjuice-managed-test-"));
  const setup = fixture(directory);
  const defaultTransport = setup.config.transport; setup.gateway.dispose();
  const { gateway } = fixture(directory, { transport: async (url, init) => {
    const response = await defaultTransport(url, init);
    if (!url.endsWith("count_tokens")) {
      const id = readdirSync(join(directory, "accounts"))[0];
      writeFileSync(join(directory, "accounts", id, "daily-attempts.lock"), "", { mode: 0o600 });
    }
    return response;
  } });
  try {
    const response = await generate(gateway, await preview(gateway));
    expect(response.status).toBe(200);
    const draft = await response.json(); expect(draft.method).toBe("cloud_generative"); expect(draft.quota).toBeNull();
    const policyResponse = await gateway.handle(request("policy"));
    expect(policyResponse.status).toBe(503); expect((await policyResponse.json()).error).toBe("attempt_ledger_unavailable");
  } finally { gateway.dispose(); rmSync(directory, { recursive: true, force: true }); }
});
