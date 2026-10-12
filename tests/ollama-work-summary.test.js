import { test, expect } from "bun:test";
import { prepareOllamaSummary, generateOllamaSummary } from "../scripts/ollama-work-summary.mjs";

const raw = JSON.stringify([{ role: "user", content: "로그인 오류를 고쳐줘\napi_key=PRIVATE_KEY" },
  { role: "assistant", content: "수정 완료라고 주장함. 실제 로그인은 확인 필요" }]);
const options = { model: "test-model:local", modelDigest: "a".repeat(64) };
const value = () => Object.fromEntries(["goal", "completed", "blocked", "next"].map(field => [field,
  { text: "완료 주장은 직접 검증 필요", evidenceIds: [2] }]));
const result = () => ({ model: options.model, done: true, done_reason: "stop", message: { role: "assistant", content: JSON.stringify(value()) },
  prompt_eval_count: 100, eval_count: 50 });
const installed = () => ({ name: options.model, digest: options.modelDigest, size: 1000 });
function fixture(overrides = {}) {
  const calls = [];
  const responses = { "/api/status": { cloud: { disabled: true } }, "/api/tags": { models: [installed()] },
    "/api/chat": result(), ...overrides };
  return { calls, transport: async (url, request) => {
    calls.push({ url, request });
    const path = new URL(url).pathname;
    expect(new URL(url).origin).toBe("http://127.0.0.1:11434");
    expect(request.redirect).toBe("error");
    expect(request.headers).not.toHaveProperty("authorization");
    expect(request.headers).not.toHaveProperty("x-api-key");
    const response = responses[path];
    return response instanceof Response ? response : Response.json(response);
  } };
}
const approved = () => ({ ...options, approvedDigest: prepareOllamaSummary(raw, options).digest });

test("local preview binds explicit model weights, redacted evidence and resource bounds", () => {
  const preview = prepareOllamaSummary(raw, options);
  expect(preview.provider).toBe("ollama_local");
  expect(JSON.stringify(preview)).not.toContain("PRIVATE_KEY");
  expect(preview.evidenceBytes).toBeLessThanOrEqual(4096);
  expect(preview.payload).toMatchObject({ stream: false, format: "json", keep_alive: 0,
    options: { num_ctx: 8192, num_predict: 1024 } });
  expect(preview.payload).not.toHaveProperty("tools");
  expect(preview.digest).not.toBe(prepareOllamaSummary(raw, { ...options, modelDigest: "b".repeat(64) }).digest);
  expect(preview.digest).not.toBe(prepareOllamaSummary(raw, { ...options, maxOutputTokens: 512 }).digest);
  for (const model of ["test-model:cloud", "test-cloud:local", "../test:local", "no-tag", "https://host:model"])
    expect(() => prepareOllamaSummary(raw, { ...options, model })).toThrow("local_model_required");
  expect(() => prepareOllamaSummary(raw, { ...options, modelDigest: "wrong" })).toThrow("local_model_digest_required");
  const many = JSON.stringify(Array.from({ length: 80 }, (_, index) => ({ role: "user", content: `${index} ${"새 작업 ".repeat(100)}` })));
  expect(prepareOllamaSummary(many, options).truncated).toBe(true);
});

test("no metadata or generation request without exact approval", async () => {
  const fx = fixture();
  await expect(generateOllamaSummary(raw, { ...options, transport: fx.transport })).rejects.toThrow("consent_required");
  await expect(generateOllamaSummary(raw, { ...approved(), maxOutputTokens: 512, transport: fx.transport })).rejects.toThrow("consent_required");
  expect(fx.calls).toEqual([]);
});

test("local generation checks cloud status and installed weights before sending evidence", async () => {
  const fx = fixture();
  const draft = await generateOllamaSummary(raw, { ...approved(), transport: fx.transport });
  expect(fx.calls.map(call => new URL(call.url).pathname)).toEqual(["/api/status", "/api/tags", "/api/chat"]);
  expect(fx.calls.slice(0, 2).every(call => call.request.method === "GET" && !call.request.body)).toBe(true);
  expect(JSON.parse(fx.calls[2].request.body)).toEqual(prepareOllamaSummary(raw, options).payload);
  expect(draft.method).toBe("local_generative");
  expect(draft.reviewed).toBe(false);
  expect(draft.usage).toEqual({ input_tokens: 100, output_tokens: 50 });
  expect(draft.cost).toEqual({ providerFeeUSD: null, localResourcesUsed: true, isInvoice: false });
});

test("unknown or enabled cloud mode fails before any excerpt leaves the adapter", async () => {
  for (const status of [{}, { cloud: { disabled: false } }, { cloud: { disabled: "true" } }, new Response("private daemon error", { status: 404 })]) {
    const fx = fixture({ "/api/status": status });
    await expect(generateOllamaSummary(raw, { ...approved(), transport: fx.transport })).rejects.toThrow();
    expect(fx.calls).toHaveLength(1);
    expect(fx.calls[0].request.body).toBeUndefined();
  }
});

test("remote, changed, missing and ambiguous installed models never receive evidence", async () => {
  for (const models of [[], [installed(), installed()], [{ ...installed(), remote_host: "https://remote" }],
    [{ ...installed(), remote_model: "cloud" }], [{ ...installed(), digest: "b".repeat(64) }],
    [{ ...installed(), size: 0 }], [{ ...installed(), size: "1000" }]]) {
    const fx = fixture({ "/api/tags": { models } });
    await expect(generateOllamaSummary(raw, { ...approved(), transport: fx.transport })).rejects.toThrow();
    expect(fx.calls).toHaveLength(2);
    expect(fx.calls.every(call => !call.request.body)).toBe(true);
  }
});

test("truncation, remote responses, tools and unsupported evidence are rejected", async () => {
  for (const response of [{ ...result(), done: false }, { ...result(), model: "unexpected:local" }, { ...result(), done_reason: "length" },
    { ...result(), remote_host: "https://remote" },
    { ...result(), message: { ...result().message, tool_calls: [{}] } },
    { ...result(), message: { role: "assistant", content: JSON.stringify({ ...value(), next: { text: "invented", evidenceIds: [999] } }) } },
    new Response("x".repeat(128001))]) {
    const fx = fixture({ "/api/chat": response });
    await expect(generateOllamaSummary(raw, { ...approved(), transport: fx.transport })).rejects.toThrow();
    expect(fx.calls).toHaveLength(3);
  }
});

test("provider errors are sanitized, not retried and never fall back to cloud", async () => {
  const fx = fixture({ "/api/chat": new Response("PRIVATE_PROVIDER_ERROR", { status: 503 }) });
  await expect(generateOllamaSummary(raw, { ...approved(), transport: fx.transport })).rejects.toThrow("local_summary_http_503");
  expect(fx.calls).toHaveLength(3);
  let count = 0;
  await expect(generateOllamaSummary(raw, { ...approved(), transport: async () => { count++; throw new Error("PRIVATE_EXCEPTION"); } }))
    .rejects.toThrow("local_summary_request_failed");
  expect(count).toBe(1);
});
