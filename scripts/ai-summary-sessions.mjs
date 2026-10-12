// In-memory request coordination, not an HTTP authentication layer.
// The eventual authenticated route must supply the trusted owner identity.
import { randomBytes } from "node:crypto";
import { prepareAiSummary, generateAiSummary, reviewedAiSummary } from "./ai-work-summary.mjs";
import { prepareOllamaSummary, generateOllamaSummary } from "./ollama-work-summary.mjs";

export function createSummarySessions({ apiKey, options, transport, budgetLedger, now = Date.now } = {}) {
  if (![undefined, "anthropic", "ollama_local"].includes(options?.provider)) throw new Error("unsupported_summary_provider");
  const local = options?.provider === "ollama_local";
  const prepare = local ? prepareOllamaSummary : prepareAiSummary;
  const generate = local ? generateOllamaSummary : generateAiSummary;
  let localRunning = false;
  const sessions = new Map();
  const ttl = 5 * 60000;
  const ownerValid = owner => typeof owner === "string" && owner.length >= 1 && owner.length <= 128;
  const prune = () => {
    for (const [id, entry] of sessions) {
      if (entry.state !== "running" && entry.expiresAt <= now()) { clearTimeout(entry.timer); sessions.delete(id); }
    }
  };
  const get = (owner, id) => {
    prune();
    const entry = sessions.get(id);
    if (!ownerValid(owner) || !entry || entry.owner !== owner) throw new Error("approval_unavailable");
    return entry;
  };
  return {
    preview(owner, raw) {
      if (!ownerValid(owner)) throw new Error("owner_required");
      prune();
      if (sessions.size >= 3) throw new Error("preview_capacity");
      const prepared = prepare(raw, options);
      const id = randomBytes(32).toString("hex");
      const expiresAt = now() + ttl;
      const entry = { owner, raw, digest: prepared.digest, expiresAt, state: "awaiting", result: null, timer: null };
      entry.timer = setTimeout(() => {
        if (entry.state !== "running") sessions.delete(id);
      }, ttl);
      entry.timer.unref?.();
      sessions.set(id, entry);
      return { id, expiresAt, ...prepared };
    },
    async generate(owner, id, approvedDigest, confirmed = false) {
      const entry = get(owner, id);
      if (confirmed !== true || approvedDigest !== entry.digest) throw new Error("consent_required");
      if (entry.state !== "awaiting") throw new Error("approval_already_used");
      if (local && localRunning) throw new Error("local_summary_busy");
      // Consume synchronously before awaiting the provider. Double clicks and
      // concurrent requests cannot share a reusable approval capability.
      entry.state = "running";
      if (local) localRunning = true;
      const raw = entry.raw; entry.raw = null;
      try {
        if (!local && typeof budgetLedger?.reserve !== "function") throw new Error("budget_ledger_required");
        // Reserve the full approved per-request maximum before count_tokens or
        // generation. Never refund uncertain failures or silently retry them.
        if (!local) budgetLedger.reserve(options?.budget?.maxUSD);
        const result = await generate(raw, { ...options, ...(local ? {} : { apiKey }), transport, approvedDigest });
        entry.state = "done"; entry.result = result;
        return result;
      } catch (error) { entry.state = "failed"; throw error; }
      finally {
        if (local) localRunning = false;
        if (entry.expiresAt <= now()) { clearTimeout(entry.timer); sessions.delete(id); }
      }
    },
    review(owner, id, values, confirmed = false) {
      const entry = get(owner, id);
      if (entry.state !== "done") throw new Error("draft_unavailable");
      return reviewedAiSummary(entry.result, values, confirmed);
    },
    discard(owner, id) {
      const entry = get(owner, id);
      if (entry.state === "running") throw new Error("summary_running");
      clearTimeout(entry.timer); sessions.delete(id);
    },
    dispose() {
      if ([...sessions.values()].some(entry => entry.state === "running")) throw new Error("summary_running");
      for (const entry of sessions.values()) clearTimeout(entry.timer);
      sessions.clear();
    },
  };
}
