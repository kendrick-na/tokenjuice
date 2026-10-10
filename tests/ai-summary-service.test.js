import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startSummaryService } from "../scripts/ai-summary-service.mjs";
const hostTest=process.platform==="win32"?test.skip:test;
const options={model:"test-model",budget:{model:"test-model",maxUSD:0.02,inputUSDPerMillion:1,outputUSDPerMillion:5,verifiedAt:Date.now()}};
hostTest("local service serves allowlisted UI, bootstraps only same-origin clients and keeps keys private",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"tokenjuice-host-test-"));let calls=0;
  const service=startSummaryService({apiKey:"TEST_PRIVATE_PROVIDER_KEY",options,budgetDirectory:directory,dailyMaxUSD:0.03,port:0,
    transport:async()=>{calls++;return Response.json({input_tokens:10});}});
  try{
    const page=await fetch(service.origin);expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain("connect-src 'self'");
    const html=await page.text();expect(html).toContain("HANDOFF");expect(html).not.toContain("TEST_PRIVATE_PROVIDER_KEY");
    for(const path of ["/api/session","/scripts/ai-summary-service.mjs","/config.json"])
      expect((await fetch(`${service.origin}${path}`)).status).not.toBe(200);
    const bootstrap=()=>fetch(`${service.origin}/api/session`,{method:"POST",headers:{origin:service.origin,
      "x-tokenjuice-client":"local-summary","content-type":"application/json"},body:"{}"});
    const response=await bootstrap(), session=await response.json();
    expect(response.headers.get("cache-control")).toBe("no-store");expect(session.accessToken).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(session)).not.toContain("TEST_PRIVATE_PROVIDER_KEY");
    const rejected=await fetch(`${service.origin}/api/session`,{method:"POST",headers:{origin:"https://outside.test",
      "x-tokenjuice-client":"local-summary","content-type":"application/json"},body:"{}"});
    expect(rejected.status).toBe(403);
    const preview=await fetch(`${service.origin}/api/summary/preview`,{method:"POST",headers:{origin:service.origin,
      authorization:`Bearer ${session.accessToken}`,"content-type":"application/json"},body:JSON.stringify({raw:"synthetic task"})});
    expect(preview.status).toBe(200);expect(calls).toBe(0);
    expect((await bootstrap().then(r=>r.json())).accessToken).toBe(session.accessToken);
  }finally{await service.stop();rmSync(directory,{recursive:true,force:true});}
});
hostTest("service refuses invalid key or stale pricing before starting",()=>{
  expect(()=>startSummaryService({apiKey:"",options})).toThrow("invalid_service_config");
  expect(()=>startSummaryService({apiKey:"TEST",options:{...options,budget:{...options.budget,verifiedAt:1}}})).toThrow("invalid_budget_policy");
});
test("summary browser assets have no third-party calls, persistent storage or provider credentials",()=>{
  const source=readFileSync(new URL("../local-summary/app.js",import.meta.url),"utf8");
  expect(source).not.toMatch(/localStorage|sessionStorage|api\.anthropic|x-api-key/);
  expect(source).toContain('get("consent").checked');expect(source).toContain('get("reviewed").checked');
});
