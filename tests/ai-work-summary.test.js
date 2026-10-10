import { test, expect } from "bun:test";
import { prepareAiSummary, generateAiSummary, validateAiSummary } from "../scripts/ai-work-summary.mjs";
const raw = JSON.stringify([{ role: "user", content: "로그인 오류를 고쳐줘\napi_key=SECRET_KEY" },
  { role: "assistant", content: "수정 완료라고 보고함. 다음은 실제 로그인 검증" }]);
const options = { model: "test-model", maxOutputTokens: 1024 };
const value = () => Object.fromEntries(["goal", "completed", "blocked", "next"].map(field => [field, { text: "완료 주장은 직접 검증 필요", evidenceIds: [2] }]));

test("AI preview is bounded, redacted, and consent is tied to the exact request", () => {
  const p = prepareAiSummary(raw, options);
  expect(JSON.stringify(p)).not.toContain("SECRET_KEY");
  expect(p.evidenceBytes).toBeLessThanOrEqual(20000);
  expect(p.digest).toBe(prepareAiSummary(raw, options).digest);
  expect(p.digest).not.toBe(prepareAiSummary(raw, { ...options, model: "different" }).digest);
  expect(p.digest).not.toBe(prepareAiSummary(raw, { ...options, maxOutputTokens: 512 }).digest);
  const long = Array.from({ length: 200 }, (_, i) => ({ role: "user", content: `${i} ${"가".repeat(699)}` }));
  const limited = prepareAiSummary(JSON.stringify(long), options);
  expect(limited.truncated).toBe(true);
  expect(limited.evidenceBytes).toBeLessThanOrEqual(20000);
});

test("AI request cannot send without exact consent or an explicit API key", async () => {
  let calls = 0;
  const transport = async () => { calls++; throw new Error("secret exception"); };
  await expect(generateAiSummary(raw, { ...options, transport })).rejects.toThrow("consent_required");
  const digest = prepareAiSummary(raw, options).digest;
  await expect(generateAiSummary(raw, { ...options, approvedDigest: digest, transport })).rejects.toThrow("api_key_required");
  await expect(generateAiSummary(raw, { ...options, model: "changed", approvedDigest: digest, apiKey: "test", transport })).rejects.toThrow("consent_required");
  expect(calls).toBe(0);
});

test("AI generation uses one bounded request and returns an unreviewed evidence draft", async () => {
  let calls = 0;
  const transport = async (url, request) => {
    calls++;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(request.redirect).toBe("error");
    expect(JSON.parse(request.body)).not.toHaveProperty("tools");
    expect(JSON.parse(request.body).max_tokens).toBe(1024);
    return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ...value(), raw: "SECRET_RAW" }) }], usage: { input_tokens: 100, output_tokens: 50 } });
  };
  const result = await generateAiSummary(raw, { ...options, approvedDigest: prepareAiSummary(raw, options).digest, apiKey: "test-key", transport });
  expect(calls).toBe(1);
  expect(result.reviewed).toBe(false);
  expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 50 });
  expect(JSON.stringify(result)).not.toContain("SECRET_RAW");
  expect(JSON.stringify(result)).not.toContain("test-key");
});

test("AI output rejects invented references, unsupported claims and blank fields", () => {
  const evidence = prepareAiSummary(raw, options).evidence;
  for (const bad of [{ text: "invented", evidenceIds: [999] }, { text: "done", evidenceIds: [] }, { text: "", evidenceIds: [1] }]) {
    expect(() => validateAiSummary({ ...value(), goal: bad }, evidence)).toThrow();
  }
});

test("AI provider failures are not retried and never disclose private error content", async () => {
  let calls = 0;
  const args = { ...options, approvedDigest: prepareAiSummary(raw, options).digest, apiKey: "test-key" };
  await expect(generateAiSummary(raw, { ...args, transport: async () => { calls++; return new Response("SECRET_ERROR", { status: 429 }); } })).rejects.toThrow("summary_http_429");
  expect(calls).toBe(1);
  for (const body of [{ stop_reason: "max_tokens", content: [] }, { stop_reason: "end_turn", content: [{ type: "tool_use" }] }]) {
    await expect(generateAiSummary(raw, { ...args, transport: async () => Response.json(body) })).rejects.toThrow("incomplete_summary");
  }
});

test("AI response size and transport exceptions fail closed without secret output", async () => {
  const args = { ...options, approvedDigest: prepareAiSummary(raw, options).digest, apiKey: "test-key" };
  await expect(generateAiSummary(raw, { ...args, transport: async () => new Response("x".repeat(128001)) })).rejects.toThrow("invalid_provider_response");
  await expect(generateAiSummary(raw, { ...args, transport: async () => { throw new Error("PRIVATE_KEY_AND_DATA"); } })).rejects.toThrow("summary_request_failed");
});
