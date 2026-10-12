// Synthetic provider only. Used by browser acceptance, never reads environment API keys.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startSummaryService } from "../scripts/ai-summary-service.mjs";
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
let stopping=false;
const stop=async()=>{if(stopping)return;stopping=true;await Promise.all([service.stop(),local.stop()]);rmSync(directory,{recursive:true,force:true});};
process.on("SIGINT",stop);process.on("SIGTERM",stop);
