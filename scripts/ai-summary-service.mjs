import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createSummarySessions } from "./ai-summary-sessions.mjs";
import { createDailySummaryBudget } from "./ai-summary-budget.mjs";
import { createLocalSummaryApi } from "./ai-summary-api.mjs";
import { prepareAiSummary } from "./ai-work-summary.mjs";

export function startSummaryService({ apiKey, options, budgetDirectory, dailyMaxUSD, port = 4179, transport } = {}) {
  if (typeof apiKey !== "string" || !apiKey.trim() || /[\r\n]/.test(apiKey)
    || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error("invalid_service_config");
  const frozen = JSON.parse(JSON.stringify(options || {}));
  if (!prepareAiSummary("configuration check", frozen).budget) throw new Error("budget_required");
  const ledger = createDailySummaryBudget({ directory: budgetDirectory, dailyMaxUSD });
  const sessions = createSummarySessions({ apiKey, options: frozen, transport, budgetLedger: ledger });
  const assets = new Map([
    ["/", [new URL("../local-summary/index.html", import.meta.url), "text/html; charset=utf-8"]],
    ["/app.js", [new URL("../local-summary/app.js", import.meta.url), "text/javascript; charset=utf-8"]],
    ["/app.css", [new URL("../local-summary/app.css", import.meta.url), "text/css; charset=utf-8"]],
    ["/work-summary.js", [new URL("../companion/work-summary.js", import.meta.url), "text/javascript; charset=utf-8"]],
  ].map(([path, [file, type]]) => [path, { body: readFileSync(file), type }]));
  const token = randomBytes(32).toString("hex");
  const headers = { "cache-control":"no-store", "x-content-type-options":"nosniff", "referrer-policy":"no-referrer",
    "x-frame-options":"DENY", "content-security-policy":"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };
  let api, origin;
  const server = Bun.serve({ hostname:"127.0.0.1", port, maxRequestBodySize:9*1024*1024, idleTimeout:120,
    fetch(request) {
      const url = new URL(request.url);
      const reply = (value, status) => Response.json(value, { status, headers });
      if (url.origin !== origin || request.headers.get("host") !== new URL(origin).host)
        return reply({error:"local_origin_required"},403);
      if (url.pathname.startsWith("/api/summary/")) return api(request);
      if (url.pathname === "/api/session") {
        if (request.method !== "POST" || url.search || request.headers.get("origin") !== origin
          || request.headers.get("x-tokenjuice-client") !== "local-summary"
          || request.headers.get("content-type") !== "application/json"
          || ![null,"same-origin","none"].includes(request.headers.get("sec-fetch-site")))
          return reply({error:"same_origin_required"},403);
        return reply({ accessToken:token, model:frozen.model, budget:frozen.budget, dailyMaxUSD },200);
      }
      const asset = assets.get(url.pathname);
      if (request.method !== "GET" || url.search || !asset) return reply({error:"not_found"},404);
      return new Response(asset.body, { headers:{...headers,"content-type":asset.type} });
    },
    error() { return new Response("service_unavailable", {status:503,headers}); },
  });
  origin = `http://127.0.0.1:${server.port}`;
  api = createLocalSummaryApi({ origin, accessToken:token, sessions });
  return { origin, async stop() { await server.stop(false); sessions.dispose(); } };
}

if (import.meta.main) {
  if (process.argv[2] === "--help") {
    console.log("bun scripts/ai-summary-service.mjs /absolute/config.json\nAPI key: TOKENJUICE_SUMMARY_API_KEY environment only. Local single-user candidate; no automatic browser launch.");
  } else {
    try {
      const path = process.argv[2];
      if (!path?.startsWith("/")) throw new Error("absolute_config_required");
      const config = JSON.parse(readFileSync(path,"utf8"));
      const service = startSummaryService({apiKey:process.env.TOKENJUICE_SUMMARY_API_KEY,
        options:{model:config.model,maxOutputTokens:config.maxOutputTokens,budget:config.budget},
        budgetDirectory:config.budgetDirectory,dailyMaxUSD:config.dailyMaxUSD,port:config.port ?? 4179});
      console.log(`TokenJuice local summary candidate: ${service.origin}\nNo provider call until you review the excerpt and approve in the browser. Ctrl+C stops the service.`);
      let stopping = false;
      const stop = async () => { if (stopping) return; stopping = true; await service.stop(); };
      process.on("SIGINT",stop); process.on("SIGTERM",stop);
    } catch {
      console.error("Summary service did not start. Check explicit config, API key, model/pricing freshness, private POSIX budget directory and port. No credential values are printed.");
      process.exitCode = 1;
    }
  }
}
