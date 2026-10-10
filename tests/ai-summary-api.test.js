import { test, expect } from "bun:test";
import { createLocalSummaryApi } from "../scripts/ai-summary-api.mjs";
import { createSummarySessions } from "../scripts/ai-summary-sessions.mjs";
const origin = "http://127.0.0.1:4179", accessToken = "a".repeat(64);
const options = { model:"test-model", budget:{model:"test-model", maxUSD:0.02,
  inputUSDPerMillion:1, outputUSDPerMillion:5, verifiedAt:Date.now()} };
function request(route, body, headers = {}, method = "POST") {
  return new Request(`${origin}/api/summary/${route}`, { method, headers:{ origin,
    authorization:`Bearer ${accessToken}`, "content-type":"application/json", ...headers },
    ...(method === "POST" ? {body:JSON.stringify(body)} : {}) });
}
function fixture() {
  let calls=0, reserved=0;
  const sessions = createSummarySessions({ options, apiKey:"TEST_PROVIDER_KEY", budgetLedger:{reserve(){reserved++;}},
    transport:async url => {
      calls++;
      if (url.endsWith("count_tokens")) return Response.json({input_tokens:10});
      return Response.json({stop_reason:"end_turn", content:[{type:"text", text:JSON.stringify(
        Object.fromEntries(["goal","completed","blocked","next"].map(field=>[field,{text:`checked ${field}`,evidenceIds:[1]}]))) }],
        usage:{input_tokens:10,output_tokens:50}});
    } });
  return { api:createLocalSummaryApi({origin,accessToken,sessions}), sessions, calls:()=>calls, reserved:()=>reserved };
}
test("local API requires bearer authentication, same origin, JSON, and exact Host before reading data", async()=>{
  const f=fixture();
  for (const [headers,status] of [[{authorization:""},401], [{authorization:"Bearer wrong"},401],
    [{origin:"https://evil.test"},403], [{origin:"null"},403], [{"sec-fetch-site":"cross-site"},403],
    [{host:"evil.test:4179"},403], [{"content-type":"text/plain"},415]]) {
    const response=await f.api(request("preview",{raw:"test"},headers));
    expect(response.status).toBe(status); expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  expect((await f.api(request("preview",null,{},"GET"))).status).toBe(405);
  expect((await f.api(request("preview?token=SECRET",{raw:"test"}))).status).toBe(404);
  expect(f.calls()).toBe(0); expect(f.reserved()).toBe(0); f.sessions.dispose();
});
test("HTTP preview to approval to review roundtrip cannot bypass consent or replay generation", async()=>{
  const f=fixture();
  const preview=await (await f.api(request("preview",{raw:"test task"}))).json();
  expect(preview.digest).toMatch(/^[a-f0-9]{64}$/); expect(f.calls()).toBe(0);
  expect(JSON.stringify(preview)).not.toContain("TEST_PROVIDER_KEY");
  const body={id:preview.id,digest:preview.digest,confirmed:false};
  expect((await f.api(request("generate",body))).status).toBe(400); expect(f.reserved()).toBe(0);
  const generated=await f.api(request("generate",{...body,confirmed:true}));
  expect(generated.status).toBe(200); expect(f.calls()).toBe(2); expect(f.reserved()).toBe(1);
  expect((await f.api(request("generate",{...body,confirmed:true}))).status).toBe(409);
  const values={goal:"goal",completed:"none",blocked:"none",next:"verify files"};
  expect((await f.api(request("review",{id:preview.id,values,confirmed:false}))).status).toBe(400);
  const saved=await (await f.api(request("review",{id:preview.id,values,confirmed:true}))).json();
  expect(saved.format).toBe("tokenjuice-ai-work-summary-v1"); expect(saved).not.toHaveProperty("evidence");
  expect((await f.api(request("discard",{id:preview.id}))).status).toBe(200);
  expect((await f.api(request("review",{id:preview.id,values,confirmed:true}))).status).toBe(409);
  f.sessions.dispose();
});
test("HTTP schema rejects client owner/model/key overrides, oversized and malformed bodies", async()=>{
  const f=fixture();
  for (const body of [{raw:"test",owner:"another"},{raw:"test",apiKey:"SECRET"},{raw:"test",model:"other"},[],null])
    expect((await f.api(request("preview",body))).status).toBe(400);
  expect((await f.api(request("preview",{raw:"test"},{"content-length":"99999999"}))).status).toBe(413);
  const broken=request("preview",{raw:"test"});
  const invalid=new Request(broken.url,{method:"POST",headers:broken.headers,body:"{broken SECRET"});
  expect((await f.api(invalid)).status).toBe(400);
  expect(f.calls()).toBe(0); f.sessions.dispose();
});
test("HTTP adapter never reflects private exceptions and refuses public listener configuration", async()=>{
  const methods={preview(){throw new Error("TEST_PRIVATE_KEY and original prompt");},generate(){},review(){},discard(){}};
  const api=createLocalSummaryApi({origin,accessToken,sessions:methods});
  const response=await api(request("preview",{raw:"test"}));
  expect(response.status).toBe(503); expect(await response.json()).toEqual({error:"summary_unavailable"});
  for (const unsafe of ["http://0.0.0.0:4179","http://example.test:4179","http://127.0.0.1:0","http://127.0.0.1:70000"])
    expect(()=>createLocalSummaryApi({origin:unsafe,accessToken,sessions:methods})).toThrow("invalid_local_api_config");
});
test("real loopback HTTP listener completes a synthetic approved request without exposing keys", async()=>{
  const f=fixture(); let handler;
  const server=Bun.serve({hostname:"127.0.0.1",port:0,fetch:req=>handler(req)});
  const localOrigin=`http://127.0.0.1:${server.port}`;
  handler=createLocalSummaryApi({origin:localOrigin,accessToken,sessions:f.sessions});
  const send=(route,body,extra={})=>fetch(`${localOrigin}/api/summary/${route}`,{method:"POST",
    headers:{origin:localOrigin,authorization:`Bearer ${accessToken}`,"content-type":"application/json",...extra},
    body:JSON.stringify(body)});
  try {
    const denied=await send("preview",{raw:"synthetic loopback task"},{origin:"https://outside.test"});
    expect(denied.status).toBe(403); expect(f.calls()).toBe(0);
    const preview=await (await send("preview",{raw:"synthetic loopback task"})).json();
    expect(f.calls()).toBe(0);
    const generated=await send("generate",{id:preview.id,digest:preview.digest,confirmed:true});
    expect(generated.status).toBe(200);
    const text=await generated.text();
    expect(text).toContain("tokenjuice-ai-work-draft-v1"); expect(text).not.toContain("TEST_PROVIDER_KEY");
    expect(generated.headers.get("cache-control")).toBe("no-store");
    expect(f.calls()).toBe(2); expect(f.reserved()).toBe(1);
  } finally { server.stop(true); f.sessions.dispose(); }
});
test("streamed body limits apply even without a Content-Length header", async()=>{
  const f=fixture(); let cancelled=false;
  const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode("x".repeat(20001)));},
    cancel(){cancelled=true;} });
  const req=new Request(`${origin}/api/summary/generate`,{method:"POST",headers:{origin,
    authorization:`Bearer ${accessToken}`,"content-type":"application/json"},body:stream,duplex:"half"});
  expect((await f.api(req)).status).toBe(413); expect(cancelled).toBe(true);
  expect(f.calls()).toBe(0); expect(f.reserved()).toBe(0); f.sessions.dispose();
});
test("HTTP in-flight capacity bounds requests and releases slots after completion", async()=>{
  let count=0, entered, release;
  const ready=new Promise(resolve=>{entered=resolve;}), waiting=new Promise(resolve=>{release=resolve;});
  const methods={preview(){return {ok:true};},async generate(){if (++count===3) entered(); await waiting; return {ok:true};},review(){},discard(){}};
  const api=createLocalSummaryApi({origin,accessToken,sessions:methods});
  const jobs=Array.from({length:3},()=>api(request("generate",{id:"b".repeat(64),digest:"c".repeat(64),confirmed:true})));
  await ready;
  expect((await api(request("preview",{raw:"test"}))).status).toBe(429);
  release(); expect((await Promise.all(jobs)).map(response=>response.status)).toEqual([200,200,200]);
  expect((await api(request("preview",{raw:"test"}))).status).toBe(200);
});
