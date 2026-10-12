// In-process readiness/drain controller. No listener, signal handler, provider
// call, budget reset, resource disposal or forced cancellation is installed.
export function createManagedSummaryLifecycle({ origin, handler, isReady, maxActive = 16 } = {}) {
  let address;
  try { address = new URL(origin); } catch { throw Error("invalid_managed_lifecycle"); }
  if (address.protocol !== "https:" || address.origin !== origin || address.username || address.password
    || typeof handler !== "function" || typeof isReady !== "function"
    || !Number.isInteger(maxActive) || maxActive < 1 || maxActive > 256) throw Error("invalid_managed_lifecycle");
  let draining = false, active = 0;
  const waiters = new Set();
  const json = (value, status) => Response.json(value, { status, headers: {
    "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  } });
  function ready() {
    if (draining) return false;
    try {
      const value = isReady();
      if (value && typeof value.then === "function") Promise.resolve(value).catch(() => {});
      return value === true;
    } catch { return false; }
  }
  return {
    async handle(request) {
      let url;
      try { url = new URL(request.url); } catch { return json({ error: "same_origin_required" }, 403); }
      if (url.origin !== origin || request.headers.get("host") !== address.host)
        return json({ error: "same_origin_required" }, 403);
      if (url.pathname === "/healthz") {
        if (url.search) return json({ error: "not_found" }, 404);
        if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
        const available = ready();
        return json({ ready: available }, available ? 200 : 503);
      }
      if (!ready()) return json({ error: "service_unavailable" }, 503);
      if (active >= maxActive) return json({ error: "request_capacity" }, 429);
      active++;
      try {
        const response = await handler(request);
        if (!(response instanceof Response)) throw Error("invalid_handler_response");
        return response;
      } catch { return json({ error: "service_unavailable" }, 503); }
      finally {
        active--;
        if (active === 0) for (const finish of [...waiters]) finish(true);
      }
    },
    drain(timeoutMs = 30000) {
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000)
        throw Error("invalid_drain_timeout");
      draining = true; // Irreversible: timed-out work cannot re-enable requests.
      if (active === 0) return Promise.resolve({ drained: true });
      return new Promise(resolve => {
        const finish = value => {
          clearTimeout(timer); waiters.delete(finish); resolve({ drained: value });
        };
        const timer = setTimeout(() => finish(active === 0), timeoutMs);
        waiters.add(finish);
      });
    },
  };
}
