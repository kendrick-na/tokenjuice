import { readFileSync } from "node:fs";
import { readSummaryBody } from "./ai-summary-api.mjs";

// Mount on the same HTTPS origin as a gateway with real host authentication.
// Does not start a listener, sign users in or expose configuration files.
export function createManagedSummarySite({ origin, gateway, appSessions } = {}) {
  if (typeof origin !== "string" || new URL(origin).protocol !== "https:" || new URL(origin).origin !== origin
    || typeof gateway?.handle !== "function" || (appSessions !== undefined && typeof appSessions?.logout !== "function")) throw Error("invalid_managed_site");
  let logoutActive = 0;
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
    const reply = (value, status = 200, extra = {}) => Response.json(value, { status, headers: { ...headers, ...extra } });
    if (url.pathname === "/auth/logout") {
      if (!appSessions) return reply({ error: "logout_unavailable" }, 503);
      if (url.search || request.method !== "POST" || request.headers.get("origin") !== origin
        || ![null, "same-origin", "none"].includes(request.headers.get("sec-fetch-site"))) return reply({ error: "same_origin_required" }, 403);
      if (request.headers.get("content-type") !== "application/json") return reply({ error: "json_required" }, 415);
      if (logoutActive >= 3) return reply({ error: "request_capacity" }, 429);
      logoutActive++;
      try {
        const body = await readSummaryBody(request, 1024);
        if (Object.keys(body).length !== 1 || body.confirmed !== true) return reply({ error: "logout_confirmation_required" }, 400);
        const result = appSessions.logout(request);
        if (typeof result?.setCookie !== "string" || /[\r\n]/.test(result.setCookie)) throw Error("logout_unavailable");
        return reply({ loggedOut: true }, 200, { "set-cookie": result.setCookie });
      } catch (error) {
        const code = ["authentication_required", "same_origin_required", "invalid_request_body", "invalid_body_size", "request_body_timeout"].includes(error.message)
          ? error.message : "logout_unavailable";
        return reply({ error: code }, code === "authentication_required" ? 401 : code === "same_origin_required" ? 403
          : code === "invalid_body_size" ? 413 : code === "request_body_timeout" ? 408 : code === "invalid_request_body" ? 400 : 503);
      } finally { logoutActive--; }
    }
    if (url.pathname.startsWith("/api/summary/")) {
      const response = await gateway.handle(request);
      if (url.pathname === "/api/summary/policy" && response.ok) {
        const value = await response.json();
        return reply({ ...value, logoutAvailable: !!appSessions });
      }
      return response;
    }
    const file = files.get(url.pathname);
    if (request.method !== "GET" || url.search || !file) return new Response("not_found", { status: 404, headers });
    return new Response(file.body, { headers: { ...headers, "content-type": `${file.type}; charset=utf-8` } });
  };
}
