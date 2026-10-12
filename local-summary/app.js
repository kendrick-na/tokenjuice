import { reviewedSummary } from "/work-summary.js";
const get=id=>document.getElementById(id), fields=["goal","completed","blocked","next"];
let token=null, preview=null, draft=null, busy=false, consumed=false, expiryTimer;
const notice=text=>{get("status").textContent=text;};
function validateSession(value){
  const fail=()=>{throw new Error("로컬 서버의 연결 정보를 확인하지 못했습니다. 파일·발췌를 전송하지 않았습니다. 실행 주소와 서버 설정을 확인하세요.");};
  if(!value||typeof value!=="object"||Array.isArray(value)
    ||typeof value.accessToken!=="string"||!/^[a-f0-9]{64}$/.test(value.accessToken)
    ||!["anthropic","ollama_local"].includes(value.provider)
    ||typeof value.model!=="string"||value.model.length>128||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value.model))fail();
  if(value.provider==="ollama_local"){
    if(!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*:[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value.model)
      ||/cloud/i.test(value.model)||value.model.includes(".."))fail();
  }else if(!Number.isFinite(value.dailyMaxUSD)||value.dailyMaxUSD<=0)fail();
  return {accessToken:value.accessToken,provider:value.provider,model:value.model,dailyMaxUSD:value.dailyMaxUSD};
}
function controls(){
  get("file").disabled=busy||!token; get("clear").disabled=busy||!preview;
  get("generate").disabled=busy||!preview||consumed||Date.now()>=preview.expiresAt||!get("consent").checked;
  get("save").disabled=busy||!draft||!get("reviewed").checked;
}
const errors={approval_unavailable:"미리보기가 만료됐습니다. 파일을 다시 선택해 새로 확인하세요.",
  local_summary_busy:"이 서버에서 로컬 요약이 이미 실행 중입니다. 완료 후 다시 승인하세요.",
  local_cloud_disabled_required:"Ollama 클라우드 꺼짐을 확인하지 못했습니다. 대화는 보내지 않았습니다. 로컬 설정과 지원 버전을 확인하세요.",
  local_model_unavailable:"설정한 로컬 모델이 설치 목록에 없습니다. 자동 다운로드하지 않았습니다.",
  local_model_verification_failed:"로컬 모델 digest·크기·원격 여부가 설정과 다릅니다. 대화는 보내지 않았습니다.",
  incomplete_local_summary:"로컬 응답이 불완전하거나 근거 형식이 맞지 않습니다. 자동 재시도하지 않습니다.",
  approval_already_used:"이미 사용한 승인입니다. 파일을 다시 선택해 새로 확인하세요.",
  daily_summary_budget_exceeded:"오늘 예약 예산을 모두 사용했습니다. 자동 재시도하지 않습니다.",
  summary_http_429:"제공자가 요청을 제한했습니다. 자동 재시도하지 않습니다. 잠시 뒤 새 미리보기로 확인하세요.",
  invalid_budget_policy:"가격 확인 시각이나 예산 정책이 유효하지 않습니다. 서버 설정을 확인하세요.",
  invalid_request_body:"지원하는 한 대화 파일과 입력 항목을 확인하세요.",
  invalid_field:"네 항목을 모두 1~4,000자로 작성하세요.",
  authentication_required:"로컬 서버 연결이 바뀌었습니다. 검토한 내용을 따로 보관한 뒤 페이지를 다시 여세요."};
async function api(route,body){
  let response,result;
  try{
    response=await fetch(`/api/summary/${route}`,{method:"POST",credentials:"same-origin",redirect:"error",signal:AbortSignal.timeout(100000),headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify(body)});
    result=await response.json();
  }catch{throw new Error("로컬 서버 응답을 확인하지 못했습니다. 이미 전송한 요청은 실행됐을 수 있으며 자동 재시도하지 않았습니다. 편집 내용은 유지합니다.");}
  if(!result||typeof result!=="object"||Array.isArray(result))throw new Error("로컬 서버 응답 형식을 확인하지 못했습니다. 자동 재시도하지 않았습니다.");
  if(!response.ok)throw new Error(Object.hasOwn(errors,result.error)?errors[result.error]:"요청에 실패했습니다. 자동 재시도하지 않았습니다. 입력과 서버 설정을 확인하고 새 미리보기를 만드세요."); return result;
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
    get("payload").textContent=JSON.stringify({provider:preview.provider,endpoint:preview.endpoint,countEndpoint:preview.countEndpoint,modelDigest:preview.modelDigest,checks:preview.checks,payload:preview.payload},null,2);
    get("excerpt").textContent=preview.evidence.map(item=>`[${item.id}] ${item.role==="user"?"사용자":"AI 발언 — 사실 검증 아님"}\n${item.text}`).join("\n\n");
    const b=preview.budget;
    const local=preview.provider==="ollama_local";
    get("policy").textContent=local
      ? `이 컴퓨터의 Ollama · ${preview.payload.model} · 선택 발언 최대 4096 bytes · 출력 최대 ${preview.payload.options.num_predict} 토큰 · ${preview.truncated?"일부 발언 누락":"선택된 발언 범위"}. 메모리·전력·시간을 사용합니다. 서버는 클라우드 꺼짐과 설치 모델을 확인한 뒤 실행하며 요금이나 의미 품질을 보증하지 않습니다.`
      : `Anthropic · ${preview.payload.model} · 요청 예약 최대 USD ${b.maxUSD} · 입력/출력 100만 토큰당 USD ${b.inputUSDPerMillion}/${b.outputUSDPerMillion} · 가격 확인 ${new Date(b.verifiedAt).toLocaleString()} · ${preview.truncated?"일부 발언 누락":"선택된 발언 범위"}. 사전 토큰 수는 추정치이며 실제 청구는 다를 수 있습니다.`;
    document.querySelector("#preview-panel .warning").textContent=local
      ? "알려진 비밀값만 제거합니다. 민감정보를 직접 확인하세요. 승인한 발언은 이 컴퓨터의 Ollama에 전달합니다. 로컬 daemon의 설정·동작은 별도로 신뢰해야 하며 TokenJuice는 모델을 설치하거나 클라우드로 우회하지 않습니다."
      : "알려진 비밀값만 제거합니다. 민감정보가 남을 수 있으므로 아래 내용을 직접 확인하세요. 승인하면 토큰 계산과 요약 요청이 Anthropic으로 전송됩니다. 제공자 보존 정책은 별도이며 절대 청구액 상한을 보장하지 않습니다.";
    get("consent").nextSibling.textContent=local
      ? " 처리 위치·모델·전송 내용·기기 자원 사용을 확인했고 이번 로컬 요약 요청에 동의합니다"
      : " 전송 내용·제공자·모델·비용 조건을 확인했고 이번 요청 전송에 동의합니다";
    get("preview-panel").hidden=false;
    clearInterval(expiryTimer);expiryTimer=setInterval(()=>{get("expiry").textContent=`승인 미리보기 남은 시간 ${Math.max(0,Math.ceil((preview?.expiresAt-Date.now())/1000))}초`;controls();},1000);
    notice(local?"아직 모델 요청 전입니다. 처리 위치·전송 내용·자원 조건을 읽고 이번 요청에만 동의하세요.":"아직 외부 전송 전입니다. 전송 내용과 비용 조건을 읽고 이번 요청에만 동의하세요.");get("consent").focus();
  }finally{get("file").value="";}
}));
get("consent").addEventListener("change",controls);
get("generate").addEventListener("click",()=>run(async()=>{
  if(!preview||consumed||!get("consent").checked||Date.now()>=preview.expiresAt)return;
  consumed=true;notice(preview.provider==="ollama_local"?"로컬 상태·모델을 확인하고 동의한 발언으로 요약 중입니다. 새 선택과 지우기는 잠기며 중복 실행하지 않습니다.":"동의한 발언으로 토큰 계산·요약을 요청 중입니다. 이 동안 지우기/새 파일 선택은 잠깁니다. 중복 실행하지 않습니다.");
  draft=await api("generate",{id:preview.id,digest:preview.digest,confirmed:true});
  for(const field of fields)get(field).value=draft.summary[field].text;
  get("evidence").textContent=JSON.stringify({summary:draft.summary,evidence:draft.evidence},null,2);
  get("cost").textContent=draft.method==="local_generative"
    ? `이 컴퓨터에서 생성 · 입력/출력 토큰 ${draft.usage.input_tokens??"확인 불가"}/${draft.usage.output_tokens??"확인 불가"} · 메모리·전력·시간 사용. 모델에 unload를 요청하지만 즉시 자원 해제를 보증하지 않습니다. 클라우드 청구액을 계산하지 않습니다.`
    : `이번 요청의 일일 예약 USD ${preview.budget.maxUSD} · 생성 사전 계산 USD ${draft.cost.estimatedReservedUSD.toFixed(6)} · 토큰 기준 계산 ${draft.cost.actualTokenCostUSD===null?"확인 불가":`USD ${draft.cost.actualTokenCostUSD.toFixed(6)}`} · 청구서가 아닙니다. 실패에도 일일 예약액은 유지합니다.`;
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
  try{result=reviewedSummary({format:"tokenjuice-work-draft-v1",method:draft.method},values);}
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
  notice("로컬 서버 연결을 확인 중입니다. 아직 파일이나 발췌를 전송하지 않았습니다.");
  let response;
  try{response=await fetch("/api/session",{method:"POST",credentials:"same-origin",redirect:"error",signal:AbortSignal.timeout(10000),headers:{"content-type":"application/json","x-tokenjuice-client":"local-summary"},body:"{}"});}
  catch{throw new Error("로컬 서버에 연결하지 못했습니다. 파일·발췌를 전송하지 않았습니다. 실행 주소와 서버 설정을 확인하세요.");}
  if(!response.ok)throw new Error("이 서버의 화면에서만 연결할 수 있습니다. 로컬 실행 주소를 확인하세요.");
  let data;
  try{data=await response.json();}catch{throw new Error("로컬 서버의 연결 정보를 확인하지 못했습니다. 파일·발췌를 전송하지 않았습니다. 실행 주소와 서버 설정을 확인하세요.");}
  const session=validateSession(data);token=session.accessToken;
  get("connection-help").hidden=true;
  const local=session.provider==="ollama_local";
  get("active-mode").textContent=local
    ? "현재 실행: 고급 로컬 Ollama 후보. 모델 설치가 필요한 선택 경로이며 기본 추적과 무관합니다."
    : "현재 실행: 개인 API 키 개발 후보. TokenJuice 운영형 클라우드와 다르며 API 비용은 키 소유자가 부담합니다.";
  document.querySelector(".badge").textContent=local?"이 컴퓨터의 모델 · 선택 승인":"로컬 서버 · 클라우드 선택 전송";
  if(local)document.querySelector("footer").textContent="메모리 전용 대화 처리 · 다운로드는 직접 관리 · 실행 중이 아닌 서버 세션은 최대 5분 후 만료 · 생성 취소/즉시 자원 해제 보장 아님";
  notice(local?`로컬 Ollama 모드 · ${session.model}. 모델 설치·전송은 자동 실행하지 않습니다. 파일 선택 후 내용을 확인하고 승인하세요.`:`로컬 서버 연결됨 · ${session.model} · 오늘 예약 예산 USD ${session.dailyMaxUSD}. 파일을 선택해도 승인 전에는 제공자에게 보내지 않습니다.`);
});
