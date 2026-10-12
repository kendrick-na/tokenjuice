// Adapter for a privately reachable HTTP port behind an operator-verified TLS
// terminator. Does not start a server, configure a proxy, log in or read keys.
export function createManagedSummaryIngress({ origin, site, transport, isTrustedPeer } = {}) {
  let publicURL;
  try { publicURL = new URL(origin); } catch { throw Error("invalid_managed_ingress"); }
  if (publicURL.protocol !== "https:" || publicURL.origin !== origin || publicURL.username || publicURL.password
    || typeof site !== "function" || transport !== "private_http_behind_tls"
    || typeof isTrustedPeer !== "function") throw Error("invalid_managed_ingress");
  const fail = (code, status) => Response.json({ error: code }, { status, headers: {
    "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  } });
  return async request => {
    try {
      // This predicate MUST use the server's socket/network boundary, not
      // headers, cookies, URL, Origin or a client-provided claim of TLS.
      const peer = isTrustedPeer(request);
      if (peer !== true) {
        if (peer && typeof peer.then === "function") Promise.resolve(peer).catch(() => {});
        return fail("trusted_ingress_required", 403);
      }
      const inputURL = new URL(request.url);
      if (inputURL.protocol !== "http:" || inputURL.username || inputURL.password
        || request.headers.get("host") !== publicURL.host) return fail("same_origin_required", 403);
      const headers = new Headers(request.headers);
      for (const name of [...headers.keys()]) {
        if (name === "forwarded" || name.startsWith("x-forwarded-")
          || ["x-real-ip", "x-original-url", "x-rewrite-url"].includes(name)) headers.delete(name);
      }
      // Only the explicitly configured public origin supplies scheme/authority.
      // The client's Origin/Fetch Metadata, cookies, method and body are kept
      // for the site's existing CSRF, authentication and consent validation.
      const upstream = new Request(`${origin}${inputURL.pathname}${inputURL.search}`, {
        method: request.method, headers, body: request.body, signal: request.signal, duplex: "half",
      });
      const response = await site(upstream);
      if (!(response instanceof Response)) throw Error("invalid_site_response");
      return response;
    } catch { return fail("ingress_unavailable", 503); }
  };
}
