// Browser-safe. No network, storage, source IDs, paths or provider credentials.
import { sessionMessages } from "../companion/work-summary.js";
export function prepareManagedExcerpt(raw, maxBytes = 20000) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 20000) throw Error("invalid_excerpt_limit");
  const parsed = sessionMessages(raw), messages = [];
  const encode = items => JSON.stringify(items.map(item => ({ role: item.role, content: item.text })));
  for (const item of parsed.messages.toReversed()) {
    if (new TextEncoder().encode(encode([item, ...messages])).length > maxBytes) break;
    messages.unshift(item);
  }
  if (!messages.length) throw Error("no_evidence");
  return { raw: encode(messages), bytes: new TextEncoder().encode(encode(messages)).length,
    messages, truncated: parsed.truncated || messages.length < parsed.messages.length };
}

export function validateManagedPolicy(value) {
  let link;
  try { link = new URL(value?.privacyPolicyURL); } catch { throw Error("invalid_policy"); }
  if (value?.mode !== "managed_cloud" || value.provider !== "anthropic"
    || typeof value.model !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value.model)
    || !/^[a-zA-Z0-9._-]{1,64}$/.test(value.policyVersion || "")
    || link.protocol !== "https:" || link.username || link.password
    || !Number.isInteger(value.dailyRequests) || value.dailyRequests < 1 || value.dailyRequests > 100
    || value.maxExcerptBytes !== 20000 || value.requiresProviderKey !== false || value.requiresModelDownload !== false)
    throw Error("invalid_policy");
  return { model: value.model, policyVersion: value.policyVersion, privacyPolicyURL: link.href,
    dailyRequests: value.dailyRequests, maxExcerptBytes: value.maxExcerptBytes };
}
