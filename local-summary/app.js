import { reviewedSummary } from "/work-summary.js";
const get=id=>document.getElementById(id), fields=["goal","completed","blocked","next"];
let token=null, preview=null, draft=null, busy=false, consumed=false, expiryTimer;
const notice=text=>{get("status").textContent=text;};
function controls(){
  get("file").disabled=busy||!token; get("clear").disabled=busy||!preview;
  get("generate").disabled=busy||!preview||consumed||Date.now()>=preview.expiresAt||!get("consent").checked;
  get("save").disabled=busy||!draft||!get("reviewed").checked;
}
const errors={approval_unavailable:"미리보기가 만료됐습니다. 파일을 다시 선택해 새로 확인하세요.",
  approval_already_used:"이미 사용한 승인입니다. 파일을 다시 선택해 새로 확인하세요.",
  daily_summary_budget_exceeded:"오늘 예약 예산을 모두 사용했습니다. 자동 재시도하지 않습니다.",
  summary_http_429:"제공자가 요청을 제한했습니다. 자동 재시도하지 않습니다. 잠시 뒤 새 미리보기로 확인하세요.",
  invalid_budget_policy:"가격 확인 시각이나 예산 정책이 유효하지 않습니다. 서버 설정을 확인하세요.",
  invalid_request_body:"지원하는 한 대화 파일과 입력 항목을 확인하세요.",
  invalid_field:"네 항목을 모두 1~4,000자로 작성하세요.",
  authentication_required:"로컬 서버 연결이 바뀌었습니다. 검토한 내용을 따로 보관한 뒤 페이지를 다시 여세요."};
async function api(route,body){
  const response=await fetch(`/api/summary/${route}`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify(body)});
  const result=await response.json(); if(!response.ok)throw new Error(errors[result.error]||"요청에 실패했습니다. 자동 재시도하지 않았습니다. 입력과 서버 설정을 확인하고 새 미리보기를 만드세요."); return result;
}
async function run(action){if(busy)return;busy=true;controls();try{await action();}catch(error){notice(error.message||"로컬 서버에 연결할 수 없습니다. 다시 실행한 뒤 미리보기를 확인하세요.");}finally{busy=false;controls();}}
get("file").addEventListener("change",()=>run(async()=>{
  const file=get("file").files?.[0];if(!file)return;
  try{
    if(file.size>8*1024*1024)throw new Error("8 MiB 이하의 한 대화 파일을 선택하세요. 기존 초안은 유지했습니다.");
    notice("이 컴퓨터에서 전송 미리보기를 준비 중입니다. 제공자에게는 보내지 않았습니다.");
    const raw=await file.text();const nextPreview=await api("preview",{raw});
    if(preview)await api("discard",{id:preview.id}).catch(()=>{});
    clearInterval(expiryTimer);preview=nextPreview;draft=null;consumed=false;get("review-panel").hidden=true;
    get("consent").checked=false;get("reviewed").checked=false;
    get("payload").textContent=JSON.stringify({provider:preview.provider,endpoint:preview.endpoint,countEndpoint:preview.countEndpoint,payload:preview.payload},null,2);
    get("excerpt").textContent=preview.evidence.map(item=>`[${item.id}] ${item.role==="user"?"사용자":"AI 발언 — 사실 검증 아님"}\n${item.text}`).join("\n\n");
    const b=preview.budget;
    get("policy").textContent=`Anthropic · ${preview.payload.model} · 요청 예약 최대 USD ${b.maxUSD} · 입력/출력 100만 토큰당 USD ${b.inputUSDPerMillion}/${b.outputUSDPerMillion} · 가격 확인 ${new Date(b.verifiedAt).toLocaleString()} · ${preview.truncated?"일부 발언 누락":"선택된 발언 범위"}. 사전 토큰 수는 추정치이며 실제 청구는 다를 수 있습니다.`;
    get("preview-panel").hidden=false;
    clearInterval(expiryTimer);expiryTimer=setInterval(()=>{get("expiry").textContent=`승인 미리보기 남은 시간 ${Math.max(0,Math.ceil((preview?.expiresAt-Date.now())/1000))}초`;controls();},1000);
    notice("아직 외부 전송 전입니다. 전송 내용과 비용 조건을 읽고 이번 요청에만 동의하세요.");get("consent").focus();
  }finally{get("file").value="";}
}));
get("consent").addEventListener("change",controls);
get("generate").addEventListener("click",()=>run(async()=>{
  if(!preview||consumed||!get("consent").checked||Date.now()>=preview.expiresAt)return;
  consumed=true;notice("동의한 발언으로 토큰 계산·요약을 요청 중입니다. 이 동안 지우기/새 파일 선택은 잠깁니다. 중복 실행하지 않습니다.");
  draft=await api("generate",{id:preview.id,digest:preview.digest,confirmed:true});
  for(const field of fields)get(field).value=draft.summary[field].text;
  get("evidence").textContent=JSON.stringify({summary:draft.summary,evidence:draft.evidence},null,2);
  get("cost").textContent=`이번 요청의 일일 예약 USD ${preview.budget.maxUSD} · 생성 사전 계산 USD ${draft.cost.estimatedReservedUSD.toFixed(6)} · 토큰 기준 계산 ${draft.cost.actualTokenCostUSD===null?"확인 불가":`USD ${draft.cost.actualTokenCostUSD.toFixed(6)}`} · 청구서가 아닙니다. 실패에도 일일 예약액은 유지합니다.`;
  get("reviewed").checked=false;get("review-panel").hidden=false;notice("AI 초안이 도착했습니다. 실제 작업·근거·비밀값을 확인하고 수정한 뒤 저장하세요.");get("goal").focus();
}));
for(const field of fields)get(field).addEventListener("input",()=>{get("reviewed").checked=false;controls();});
get("reviewed").addEventListener("change",controls);
get("save").addEventListener("click",()=>run(async()=>{
  if(!preview||!draft||!get("reviewed").checked)return;
  const values=Object.fromEntries(fields.map(field=>[field,get(field).value]));
  // Local re-review/export remains available after the server's memory session
  // expires. Edited handoff notes are not transmitted back to the server.
  let result;
  try{result=reviewedSummary({format:"tokenjuice-work-draft-v1",method:"cloud_generative"},values);}
  catch{throw new Error("네 항목을 모두 1~4,000자로 작성하고 비밀값을 제거하세요. 저장하지 않았습니다.");}
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download="tokenjuice-ai-work-summary.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  notice("검토한 네 항목만 저장했습니다. 원문·근거·키는 포함하지 않습니다. 실제 변경 파일과 함께 새 세션에 직접 전달하세요.");
}));
get("clear").addEventListener("click",()=>run(async()=>{
  let serverCleared=true;
  if(preview)try{await api("discard",{id:preview.id});}catch{serverCleared=false;}
  preview=null;draft=null;consumed=false;clearInterval(expiryTimer);
  for(const field of fields)get(field).value="";
  for(const id of ["payload","excerpt","evidence","policy","cost","expiry"])get(id).textContent="";
  get("consent").checked=false;get("reviewed").checked=false;get("preview-panel").hidden=true;get("review-panel").hidden=true;
  notice(serverCleared?"화면과 서버 초안을 지웠습니다. 일일 비용 예약액과 다운로드 파일은 지우지 않습니다."
    :"화면 초안은 지웠습니다. 서버 삭제는 확인하지 못했습니다. 실행 중이 아닌 서버 세션은 최대 5분 뒤 만료됩니다. 다운로드 파일과 비용 예약액은 유지합니다.");get("file").focus();
}));
run(async()=>{
  const response=await fetch("/api/session",{method:"POST",headers:{"content-type":"application/json","x-tokenjuice-client":"local-summary"},body:"{}"});
  if(!response.ok)throw new Error("이 서버의 화면에서만 연결할 수 있습니다. 로컬 실행 주소를 확인하세요.");
  const session=await response.json();token=session.accessToken;
  notice(`로컬 서버 연결됨 · ${session.model} · 오늘 예약 예산 USD ${session.dailyMaxUSD}. 파일을 선택해도 승인 전에는 제공자에게 보내지 않습니다.`);
});
