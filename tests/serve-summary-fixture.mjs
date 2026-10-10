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
let stopping=false;
const stop=async()=>{if(stopping)return;stopping=true;await service.stop();rmSync(directory,{recursive:true,force:true});};
process.on("SIGINT",stop);process.on("SIGTERM",stop);
