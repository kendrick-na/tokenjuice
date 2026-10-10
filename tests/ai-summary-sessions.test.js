import { test, expect } from "bun:test";
import { createSummarySessions } from "../scripts/ai-summary-sessions.mjs";
const raw = "테스트 작업 인계";
const budgetLedger = { reserve() {} }; // Fixture only; production uses durable reservations.
const options = { model: "test-model", budget: { model: "test-model", maxUSD: 0.02,
  inputUSDPerMillion: 1, outputUSDPerMillion: 5, verifiedAt: Date.now() } };
const values = Object.fromEntries(["goal", "completed", "blocked", "next"].map(field => [field, "검토한 항목"]));
const providerResult = () => Response.json({ stop_reason: "end_turn", content: [{ type: "text", text:
  JSON.stringify(Object.fromEntries(Object.keys(values).map(field => [field, { text: values[field], evidenceIds: [1] }]))) }],
  usage: { input_tokens: 10, output_tokens: 50 } });

test("summary preview approval is owner-bound, expiring, and cannot execute without explicit consent", async () => {
  let clock = Date.now(), calls = 0;
  const controller = createSummarySessions({ options, budgetLedger, apiKey: "TEST_KEY", now: () => clock,
    transport: async () => { calls++; return providerResult(); } });
  const preview = controller.preview("owner-a", raw);
  expect(preview.id).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(preview)).not.toContain("TEST_KEY");
  await expect(controller.generate("owner-b", preview.id, preview.digest, true)).rejects.toThrow("approval_unavailable");
  await expect(controller.generate("owner-a", preview.id, preview.digest)).rejects.toThrow("consent_required");
  await expect(controller.generate("owner-a", preview.id, "changed", true)).rejects.toThrow("consent_required");
  clock += 5 * 60000;
  await expect(controller.generate("owner-a", preview.id, preview.digest, true)).rejects.toThrow("approval_unavailable");
  expect(calls).toBe(0); controller.dispose();
});

test("concurrent summary clicks consume one approval and review exports only checked values", async () => {
  let calls = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  const controller = createSummarySessions({ options, budgetLedger, apiKey: "TEST_KEY", transport: async url => {
    calls++;
    if (url.endsWith("/count_tokens")) return Response.json({ input_tokens: 10 });
    await pending; return providerResult();
  } });
  const preview = controller.preview("owner", raw);
  const first = controller.generate("owner", preview.id, preview.digest, true);
  await expect(controller.generate("owner", preview.id, preview.digest, true)).rejects.toThrow("approval_already_used");
  expect(() => controller.discard("owner", preview.id)).toThrow("summary_running");
  release(); await first;
  expect(calls).toBe(2);
  await expect(controller.generate("owner", preview.id, preview.digest, true)).rejects.toThrow("approval_already_used");
  expect(() => controller.review("owner", preview.id, values)).toThrow("review_required");
  const result = controller.review("owner", preview.id, { ...values, raw: "SECRET_RAW" }, true);
  expect(result.reviewed).toBe(true);
  expect(JSON.stringify(result)).not.toContain("SECRET_RAW");
  controller.discard("owner", preview.id); controller.dispose();
});

test("failed summary approvals cannot retry silently and preview memory is bounded", async () => {
  let calls = 0;
  const controller = createSummarySessions({ options, budgetLedger, apiKey: "TEST_KEY", transport: async () => {
    calls++; return new Response("private error", { status: 429 });
  } });
  const preview = controller.preview("owner", raw);
  await expect(controller.generate("owner", preview.id, preview.digest, true)).rejects.toThrow("summary_http_429");
  await expect(controller.generate("owner", preview.id, preview.digest, true)).rejects.toThrow("approval_already_used");
  expect(calls).toBe(1);
  controller.preview("owner", raw); controller.preview("owner", raw);
  expect(() => controller.preview("owner", raw)).toThrow("preview_capacity");
  controller.discard("owner", preview.id);
  expect(() => controller.preview("owner", raw)).not.toThrow();
  controller.dispose();
});

test("missing or exhausted daily ledger blocks all provider requests", async () => {
  let calls = 0;
  for (const ledger of [undefined, { reserve() { throw new Error("daily_summary_budget_exceeded"); } }]) {
    const controller = createSummarySessions({ options, budgetLedger: ledger, apiKey: "TEST_KEY",
      transport: async () => { calls++; return providerResult(); } });
    const preview = controller.preview("owner", raw);
    await expect(controller.generate("owner", preview.id, preview.digest, true)).rejects.toThrow(
      ledger ? "daily_summary_budget_exceeded" : "budget_ledger_required");
    controller.dispose();
  }
  expect(calls).toBe(0);
});
