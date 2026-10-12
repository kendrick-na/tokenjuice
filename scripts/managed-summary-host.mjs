import { createManagedSummarySite } from "./managed-summary-site.mjs";
import { createManagedSummaryLifecycle } from "./managed-summary-lifecycle.mjs";
import { createManagedSummaryIngress } from "./managed-summary-ingress.mjs";

// Explicit runtime factory only. No CLI, environment/key discovery, login,
// signal installation or external bind happens when this module is imported.
export function startManagedSummaryHost({ origin, gateway, appSessions, isReady, verifyPeer, onStopped,
  hostname = "127.0.0.1", port = 0, privateIngressPort = false, maxActive = 16 } = {}) {
  if (!["127.0.0.1", "0.0.0.0"].includes(hostname) || (hostname === "0.0.0.0" && privateIngressPort !== true)
    || !Number.isInteger(port) || port < 0 || port > 65535
    || typeof verifyPeer !== "function" || typeof onStopped !== "function") throw Error("invalid_managed_host");
  const site = createManagedSummarySite({ origin, gateway, appSessions });
  const lifecycle = createManagedSummaryLifecycle({ origin, handler: site, isReady, maxActive });
  let server, finalization;
  const ingress = createManagedSummaryIngress({ origin, site: lifecycle.handle, transport: "private_http_behind_tls",
    isTrustedPeer(request) {
      const peer = server?.requestIP(request);
      if (!peer) return false;
      // Pass only socket metadata, never headers or a claimed client address.
      return verifyPeer(Object.freeze({ address: peer.address, port: peer.port, family: peer.family }));
    } });
  server = Bun.serve({ hostname, port, maxRequestBodySize: 128000, idleTimeout: 120, fetch: ingress,
    error() { return Response.json({ error: "service_unavailable" }, { status: 503,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } }); } });
  return {
    port: server.port,
    async stop(timeoutMs = 30000) {
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw Error("invalid_stop_timeout");
      const started = performance.now();
      const result = await lifecycle.drain(timeoutMs);
      if (!result.drained) return { stopped: false };
      // Only one transport close and owner cleanup, even with simultaneous or
      // repeated stop calls. A cleanup error is never falsely successful.
      finalization ??= (async () => {
        await server.stop(false);
        await onStopped();
        return { stopped: true };
      })().catch(() => ({ stopped: false }));
      const remaining = Math.floor(timeoutMs - (performance.now() - started));
      if (remaining <= 0) return { stopped: false };
      let timer;
      try {
        return await Promise.race([finalization, new Promise(resolve => {
          timer = setTimeout(() => resolve({ stopped: false }), remaining);
        })]);
      } finally { clearTimeout(timer); }
    },
  };
}
