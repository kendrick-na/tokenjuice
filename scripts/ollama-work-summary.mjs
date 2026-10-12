// Backend adapter only. No discovery, downloads, daemon configuration or fallback.
import { createHash } from "node:crypto";
import { prepareAiSummary, validateAiSummary, boundedResponse } from "./ai-work-summary.mjs";

const ORIGIN = "http://127.0.0.1:11434";
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function prepareOllamaSummary(raw, { model, modelDigest, maxOutputTokens = 1024 } = {}) {
  if (typeof model !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*:[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(model)
    || model.length > 128 || /cloud/i.test(model) || model.includes("..")) throw new Error("local_model_required");
  if (typeof modelDigest !== "string" || !/^[a-f0-9]{64}$/.test(modelDigest)) throw new Error("local_model_digest_required");
  // Reuse the same redaction, chronological evidence IDs and untrusted-data prompt.
  // A smaller excerpt plus fixed context/output bounds limits local RAM demand.
  const base = prepareAiSummary(raw, { model: "local-model", maxOutputTokens, maxEvidenceBytes: 4096 });
  const payload = { model, stream: false, format: "json", keep_alive: 0,
    messages: [{ role: "system", content: base.payload.system }, ...base.payload.messages],
    options: { num_ctx: 8192, num_predict: maxOutputTokens, temperature: 0 } };
  const receipt = { provider: "ollama_local", endpoint: `${ORIGIN}/api/chat`, modelDigest,
    checks: [`${ORIGIN}/api/status`, `${ORIGIN}/api/tags`], payload };
  return { ...receipt, digest: hash(receipt), evidence: base.evidence,
    truncated: base.truncated, evidenceBytes: base.evidenceBytes,
    warning: "로컬 Ollama의 클라우드 꺼짐과 모델 digest를 확인한 뒤 실행합니다. 기기 메모리·전력은 사용하며 의미 품질은 직접 검토해야 합니다." };
}

export async function generateOllamaSummary(raw, options = {}) {
  const prepared = prepareOllamaSummary(raw, options);
  if (options.approvedDigest !== prepared.digest) throw new Error("consent_required");
  const transport = options.transport || fetch;
  const request = async (route, payload) => {
    let response;
    try {
      response = await transport(`${ORIGIN}${route}`, { method: payload ? "POST" : "GET", redirect: "error",
        headers: { "content-type": "application/json" },
        ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(60000) });
    } catch { throw new Error("local_summary_request_failed"); }
    if (!response.ok) throw new Error(`local_summary_http_${response.status}`);
    try { return JSON.parse(await boundedResponse(response)); }
    catch { throw new Error("invalid_local_provider_response"); }
  };
  // Metadata only: no transcript is sent until both guards pass. Experimental
  // status unsupported/malformed -> fail closed, never guess local-only mode.
  const status = await request("/api/status");
  if (status?.cloud?.disabled !== true) throw new Error("local_cloud_disabled_required");
  const tags = await request("/api/tags");
  if (!Array.isArray(tags?.models)) throw new Error("invalid_local_model_list");
  const matches = tags.models.filter(item => item?.name === options.model);
  if (matches.length !== 1) throw new Error("local_model_unavailable");
  const installed = matches[0];
  if (installed.remote_host || installed.remote_model || installed.digest !== options.modelDigest
    || !Number.isSafeInteger(installed.size) || installed.size <= 0) throw new Error("local_model_verification_failed");
  const body = await request("/api/chat", prepared.payload);
  if (body?.done !== true || body.model !== options.model || body.done_reason !== "stop" || body.remote_host || body.remote_model
    || body.message?.role !== "assistant" || typeof body.message.content !== "string"
    || body.message.tool_calls?.length) throw new Error("incomplete_local_summary");
  let value;
  try { value = JSON.parse(body.message.content); } catch { throw new Error("invalid_summary_json"); }
  const summary = validateAiSummary(value, prepared.evidence);
  const safeCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000 ? value : null;
  return { format: "tokenjuice-ai-work-draft-v1", method: "local_generative", reviewed: false,
    model: options.model, createdAt: Date.now(), truncated: prepared.truncated, summary, evidence: prepared.evidence,
    usage: { input_tokens: safeCount(body.prompt_eval_count), output_tokens: safeCount(body.eval_count) },
    cost: { providerFeeUSD: null, localResourcesUsed: true, isInvoice: false },
    warning: "근거 번호는 참조의 존재만 검증합니다. 의미·완료 주장·누락을 확인한 뒤 인계하세요." };
}
