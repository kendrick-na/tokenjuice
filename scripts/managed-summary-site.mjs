import { readFileSync } from "node:fs";

// Mount on the same HTTPS origin as a gateway with real host authentication.
// Does not start a listener, sign users in or expose configuration files.
export function createManagedSummarySite({ origin, gateway } = {}) {
  if (typeof origin !== "string" || new URL(origin).protocol !== "https:" || new URL(origin).origin !== origin
    || typeof gateway?.handle !== "function") throw Error("invalid_managed_site");
  const files = new Map([
    ["/", ["../managed-summary/index.html", "text/html"]],
    ["/app.js", ["../managed-summary/app.js", "text/javascript"]],
    ["/app.css", ["../local-summary/app.css", "text/css"]],
    ["/managed-summary/excerpt.js", ["../managed-summary/excerpt.js", "text/javascript"]],
    ["/companion/work-summary.js", ["../companion/work-summary.js", "text/javascript"]],
    ["/companion/work-files.js", ["../companion/work-files.js", "text/javascript"]],
  ].map(([path, [file, type]]) => [path, { body: readFileSync(new URL(file, import.meta.url)), type }]));
  const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
    "x-frame-options": "DENY", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };
  return async request => {
    const url = new URL(request.url);
    if (url.origin !== origin || request.headers.get("host") !== new URL(origin).host)
      return Response.json({ error: "same_origin_required" }, { status: 403, headers });
    if (url.pathname.startsWith("/api/summary/")) return gateway.handle(request);
    const file = files.get(url.pathname);
    if (request.method !== "GET" || url.search || !file) return new Response("not_found", { status: 404, headers });
    return new Response(file.body, { headers: { ...headers, "content-type": `${file.type}; charset=utf-8` } });
  };
}
