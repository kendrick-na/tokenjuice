import { test, expect } from "bun:test";
import { createSummarySessions } from "../scripts/ai-summary-sessions.mjs";

const options = { provider: "ollama_local", model: "test-model:local", modelDigest: "a".repeat(64) };
const raw = "합성 대화 · 실제 로그인 검증 필요";
const values = Object.fromEntries(["goal", "completed", "blocked", "next"].map(field => [field, "검토한 합성 항목"]));
function fixture({ hold, fail } = {}) {
  const calls = [];
  const transport = async (url, request) => {
    calls.push({ url, request });
    if (hold && url.endsWith("/api/status")) await hold;
    if (fail) return new Response("PRIVATE_ERROR", { status: 503 });
    if (url.endsWith("/api/status")) return Response.json({ cloud: { disabled: true } });
    if (url.endsWith("/api/tags")) return Response.json({ models: [{ name: options.model, digest: options.modelDigest, size: 1000 }] });
    return Response.json({ model: options.model, done: true, done_reason: "stop", message: { role: "assistant",
      content: JSON.stringify(Object.fromEntries(Object.keys(values).map(field => [field, { text: "실제 작업 확인 필요", evidenceIds: [1] }]))) } });
  };
  return { calls, transport };
}

test("local approval retains owner, digest, expiry and preview capacity without provider calls", async () => {
  let now = 1000;
  const fx = fixture();
  const sessions = createSummarySessions({ options, transport: fx.transport, now: () => now });
  try {
    const preview = sessions.preview("owner", raw);
    expect(preview.provider).toBe("ollama_local");
    expect(fx.calls).toEqual([]);
    await expect(sessions.generate("other", preview.id, preview.digest, true)).rejects.toThrow("approval_unavailable");
    await expect(sessions.generate("owner", preview.id, "wrong", true)).rejects.toThrow("consent_required");
    await expect(sessions.generate("owner", preview.id, preview.digest, false)).rejects.toThrow("consent_required");
    expect(fx.calls).toEqual([]);
    sessions.preview("owner", raw); sessions.preview("owner", raw);
    expect(() => sessions.preview("owner", raw)).toThrow("preview_capacity");
    now += 300001;
    await expect(sessions.generate("owner", preview.id, preview.digest, true)).rejects.toThrow("approval_unavailable");
    expect(fx.calls).toEqual([]);
  } finally { sessions.dispose(); }
});

test("one local controller serializes generations without consuming a different waiting approval", async () => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const fx = fixture({ hold });
  const sessions = createSummarySessions({ options, transport: fx.transport,
    budgetLedger: { reserve() { throw new Error("local path must not reserve cloud dollars"); } } });
  const one = sessions.preview("owner", raw), two = sessions.preview("owner", raw);
  const pending = sessions.generate("owner", one.id, one.digest, true);
  try {
    await expect(sessions.generate("owner", one.id, one.digest, true)).rejects.toThrow("approval_already_used");
    await expect(sessions.generate("owner", two.id, two.digest, true)).rejects.toThrow("local_summary_busy");
    expect(() => sessions.discard("owner", one.id)).toThrow("summary_running");
    expect(() => sessions.dispose()).toThrow("summary_running");
  } finally { release(); }
  await pending;
  try {
    await expect(sessions.generate("owner", one.id, one.digest, true)).rejects.toThrow("approval_already_used");
    await sessions.generate("owner", two.id, two.digest, true);
    expect(fx.calls).toHaveLength(6);
    expect(() => sessions.review("owner", one.id, values)).toThrow("review_required");
    const exported = sessions.review("owner", one.id, { ...values, raw: "PRIVATE_RAW", evidence: "PRIVATE_EVIDENCE" }, true);
    expect(exported).toMatchObject({ method: "local_generative_user_reviewed", privacy: "reviewed_local_model_excerpt", reviewed: true });
    expect(JSON.stringify(exported)).not.toContain("PRIVATE");
    expect(exported).not.toHaveProperty("modelDigest");
    expect(exported).not.toHaveProperty("cost");
  } finally { sessions.dispose(); }
});

test("failed local generation consumes approval and frees the controller without cloud fallback", async () => {
  const fx = fixture({ fail: true });
  const sessions = createSummarySessions({ options, transport: fx.transport });
  try {
    const one = sessions.preview("owner", raw), two = sessions.preview("owner", raw);
    await expect(sessions.generate("owner", one.id, one.digest, true)).rejects.toThrow("local_summary_http_503");
    await expect(sessions.generate("owner", one.id, one.digest, true)).rejects.toThrow("approval_already_used");
    await expect(sessions.generate("owner", two.id, two.digest, true)).rejects.toThrow("local_summary_http_503");
    expect(fx.calls).toHaveLength(2);
    expect(fx.calls.every(call => call.url === "http://127.0.0.1:11434/api/status")).toBe(true);
    expect(() => sessions.review("owner", one.id, values, true)).toThrow("draft_unavailable");
  } finally { sessions.dispose(); }
});

test("unknown summary provider cannot silently select a cloud adapter", () => {
  expect(() => createSummarySessions({ options: { ...options, provider: "typo" } })).toThrow("unsupported_summary_provider");
});
