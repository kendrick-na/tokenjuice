// Synthetic provider only. Used by browser acceptance, never reads environment API keys.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startSummaryService } from "../scripts/ai-summary-service.mjs";
import { createManagedSummaryGateway } from "../scripts/managed-summary-gateway.mjs";
import { createManagedSummarySite } from "../scripts/managed-summary-site.mjs";
import { createManagedAppSessions } from "../scripts/managed-summary-sessions.mjs";
const directory=mkdtempSync(join(tmpdir(),"tokenjuice-summary-browser-test-"));
const service=startSummaryService({apiKey:"TEST_FIXTURE_KEY",budgetDirectory:directory,dailyMaxUSD:0.1,port:4181,
  options:{model:"test-model",budget:{model:"test-model",maxUSD:0.02,inputUSDPerMillion:1,outputUSDPerMillion:5,verifiedAt:Date.now()}},
  transport:async url=>url.endsWith("count_tokens")?Response.json({input_tokens:10}):Response.json({stop_reason:"end_turn",
    content:[{type:"text",text:JSON.stringify(Object.fromEntries(["goal","completed","blocked","next"].map(field=>[field,
      {text:`검토할 ${field}`,evidenceIds:[1]}])))}],usage:{input_tokens:10,output_tokens:50}})});
console.log(`Synthetic summary fixture: ${service.origin}`);
const local=startSummaryService({port:4182,options:{provider:"ollama_local",model:"test-model:local",modelDigest:"a".repeat(64)},
  transport:async url=>url.endsWith("/api/status")?Response.json({cloud:{disabled:true}})
    :url.endsWith("/api/tags")?Response.json({models:[{name:"test-model:local",digest:"a".repeat(64),size:1000}]})
    :Response.json({model:"test-model:local",done:true,done_reason:"stop",message:{role:"assistant",
      content:JSON.stringify(Object.fromEntries(["goal","completed","blocked","next"].map(field=>[field,{text:`로컬 합성 ${field}`,evidenceIds:[1]}])))},
      prompt_eval_count:10,eval_count:50})});
console.log(`Synthetic local model fixture: ${local.origin}`);
// TEST-ONLY HTTP-to-HTTPS bridge with a fixed synthetic identity. This is not
// application authentication, not production ingress and never a deployment.
const managedOrigin="https://summary.browser.test";
const appSessions=createManagedAppSessions({origin:managedOrigin,hasSummaryAccess:()=>true});
let fixtureCookie=appSessions.issue("SYNTHETIC_BROWSER_ONLY").setCookie.split(";",1)[0];
const gateway=createManagedSummaryGateway({origin:managedOrigin,authenticate:appSessions.authenticate,
  apiKey:"TEST_MANAGED_SERVER_KEY",budgetDirectory:join(directory,"managed"),dailyRequests:2,globalDailyMaxUSD:.1,
  privacyPolicyURL:"https://summary.browser.test/privacy",policyVersion:"test-v1",
  options:{model:"test-model",budget:{model:"test-model",maxUSD:.02,inputUSDPerMillion:1,outputUSDPerMillion:5,verifiedAt:Date.now()}},
  transport:async url=>url.endsWith("count_tokens")?Response.json({input_tokens:10}):Response.json({stop_reason:"end_turn",
    content:[{type:"text",text:JSON.stringify(Object.fromEntries(["goal","completed","blocked","next"].map(field=>[field,
      {text:`클라우드 합성 ${field}`,evidenceIds:[1]}])))}],usage:{input_tokens:10,output_tokens:30}})});
const managedSite=createManagedSummarySite({origin:managedOrigin,gateway,appSessions});
const managed=Bun.serve({hostname:"127.0.0.1",port:4183,maxRequestBodySize:128000,async fetch(request){
  const url=new URL(request.url),localOrigin="http://127.0.0.1:4183";
  if(url.origin!==localOrigin || request.headers.get("host")!=="127.0.0.1:4183"
    || (request.method==="POST" && request.headers.get("origin")!==localOrigin))return new Response("fixture_origin_required",{status:403});
  if(url.pathname==="/test/session" && request.method==="POST") {
    const body=await request.json();
    if(Object.keys(body).length>1 || ![undefined,"race"].includes(body.scenario))return new Response("fixture_scenario_required",{status:400});
    fixtureCookie=appSessions.issue(body.scenario==="race"?"SYNTHETIC_RACE_ONLY":"SYNTHETIC_BROWSER_ONLY").setCookie.split(";",1)[0];
    return Response.json({fixture:true});
  }
  const headers=new Headers(request.headers);headers.set("host",new URL(managedOrigin).host);
  // Inject a synthetic cookie only inside this TEST bridge. This does not prove
  // real browser Secure-cookie behavior or a real login provider integration.
  headers.set("cookie",fixtureCookie);
  if(request.method==="POST")headers.set("origin",managedOrigin);
  return managedSite(new Request(`${managedOrigin}${url.pathname}${url.search}`,{method:request.method,headers,
    ...(request.method==="POST"?{body:await request.text()}:{})}));
}});
console.log("Synthetic managed cloud fixture: http://127.0.0.1:4183 (not production authentication)");
let stopping=false;
const stop=async()=>{if(stopping)return;stopping=true;await Promise.all([service.stop(),local.stop(),managed.stop(false)]);gateway.dispose();appSessions.dispose();rmSync(directory,{recursive:true,force:true});};
process.on("SIGINT",stop);process.on("SIGTERM",stop);
