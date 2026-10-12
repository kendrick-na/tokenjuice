import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { prepareManagedExcerpt, validateManagedPolicy } from "../managed-summary/excerpt.js";
import { createManagedSummarySite } from "../scripts/managed-summary-site.mjs";

test("managed excerpt keeps only bounded local speaker text without raw metadata and secrets", () => {
  const raw = JSON.stringify({ messages: [
    { role: "user", content: "목표 확인\napi_key=PRIVATE_SECRET", sessionId: "PRIVATE_ID", path: "/Users/private/repo" },
    { role: "assistant", content: "완료 주장 확인 필요", unknown: "PRIVATE_META" },
    { role: "tool", content: "PRIVATE_TOOL_OUTPUT" },
  ] });
  const excerpt = prepareManagedExcerpt(raw);
  expect(excerpt.raw).not.toContain("PRIVATE"); expect(excerpt.raw).not.toContain("sessionId");
  expect(JSON.parse(excerpt.raw)).toEqual([{ role: "user", content: "목표 확인" }, { role: "assistant", content: "완료 주장 확인 필요" }]);
  expect(excerpt.bytes).toBe(new TextEncoder().encode(excerpt.raw).length);
  const large = JSON.stringify(Array.from({ length: 200 }, (_, i) => ({ role: "user", content: `${i} ${"가".repeat(650)}` })));
  const bounded = prepareManagedExcerpt(large);
  expect(bounded.bytes).toBeLessThanOrEqual(20000); expect(bounded.truncated).toBe(true);
  expect(bounded.messages.at(-1).text).toStartWith("199 ");
  expect(() => prepareManagedExcerpt("{bad")).toThrow();
  expect(() => prepareManagedExcerpt("text", 999999)).toThrow();
});

test("managed policy rejects unexpected provider, download/key requirements and dangerous policy URLs", () => {
  const policy = { mode: "managed_cloud", provider: "anthropic", model: "test-model", policyVersion: "v1",
    privacyPolicyURL: "https://summary.example.test/privacy", dailyRequests: 2, maxExcerptBytes: 20000,
    requiresProviderKey: false, requiresModelDownload: false };
  expect(validateManagedPolicy(policy).dailyRequests).toBe(2);
  for (const change of [{ provider: "other" }, { requiresProviderKey: true }, { requiresModelDownload: true },
    { privacyPolicyURL: "javascript:alert(1)" }, { privacyPolicyURL: "https://user:password@example.test" },
    { dailyRequests: 0 }, { maxExcerptBytes: 1000000 }, { policyVersion: "" }])
    expect(() => validateManagedPolicy({ ...policy, ...change })).toThrow("invalid_policy");
});

test("managed site serves only public assets with same-origin CSP; no config or provider key route", async () => {
  const origin = "https://summary.example.test"; let calls = 0;
  const site = createManagedSummarySite({ origin, gateway: { handle: () => { calls++; return Response.json({ accepted: true }); } } });
  const request = path => new Request(`${origin}${path}`, { headers: { host: "summary.example.test" } });
  const page = await site(request("/")); expect(page.status).toBe(200);
  expect(page.headers.get("content-security-policy")).toContain("connect-src 'self'");
  expect(await page.text()).toContain("이번 TokenJuice 업로드에 동의");
  for (const path of ["/app.js", "/app.css", "/managed-summary/excerpt.js", "/companion/work-summary.js", "/companion/work-files.js"])
    expect((await site(request(path))).status).toBe(200);
  for (const path of ["/config.json", "/scripts/managed-summary-gateway.mjs", "/.env", "/?query=1"])
    expect((await site(request(path))).status).toBe(404);
  expect((await site(new Request("https://evil.test/", { headers: { host: "evil.test" } }))).status).toBe(403);
  expect(calls).toBe(0); await site(request("/api/summary/policy")); expect(calls).toBe(1);
  const source = readFileSync(new URL("../managed-summary/app.js", import.meta.url), "utf8");
  expect(source).not.toMatch(/localStorage|sessionStorage|x-api-key|api\.anthropic/);
  expect(source).toContain('get("upload-consent").checked'); expect(source).toContain('get("generate-consent").checked');
});
