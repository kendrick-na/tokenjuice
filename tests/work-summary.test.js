import { test, expect } from "bun:test";
import { draftSummary, sessionMessages, reviewedSummary, safeExcerpt } from "../companion/work-summary.js";

test("Claude draft extracts speaker evidence, excludes tool results and known secrets", () => {
  const rows = [
    {sessionId:"one", message:{role:"user", content:"로그인 오류를 수정해줘"}},
    {sessionId:"one", message:{role:"assistant", content:[{type:"text",text:"수정 완료. 테스트 통과. 다음은 배포 확인"},{type:"tool_result", content:"SECRET_TOOL"}]}},
    {sessionId:"one", message:{role:"user",content:"api_key=SECRET_KEY\n아직 오류가 남음\n```js\nSECRET_CODE\n```"}},
  ];
  const draft = draftSummary(rows.map(x=>JSON.stringify(x)).join("\n"));
  expect(draft.goal).toContain("로그인 오류"); expect(draft.completed).toContain("테스트 통과");
  expect(draft.blocked).toContain("오류가 남음"); expect(draft.next).toContain("배포 확인");
  expect(JSON.stringify(draft)).not.toContain("SECRET_"); expect(draft.reviewed).toBe(false);
});
test("Codex response and event messages deduplicate, omit commands and reject mixed sessions", () => {
  const rows = [{type:"session_meta",payload:{id:"one"}},
    {type:"event_msg",payload:{type:"user_message",message:"테스트 고쳐줘"}},
    {type:"response_item",payload:{role:"user",content:[{type:"input_text",text:"테스트 고쳐줘"}]}},
    {type:"response_item",payload:{type:"function_call",arguments:"SECRET_COMMAND"}},
    {type:"event_msg",payload:{type:"agent_message",message:"수정 완료. 다음 확인 필요"}}];
  expect(sessionMessages(JSON.stringify(rows)).messages).toHaveLength(2);
  expect(()=>sessionMessages(JSON.stringify([...rows,{type:"session_meta",payload:{id:"two"}}]))).toThrow("multiple_sessions");
});
test("review export is a whitelist and retains edits without raw evidence", () => {
  const draft = draftSummary("목표를 정리해줘");
  const summary = reviewedSummary(draft,{goal:"목표", completed:"아직 완료 없음",blocked:"없음",next:"실제 테스트 확인",raw:"SECRET_RAW"});
  expect(summary.next).toBe("실제 테스트 확인"); expect(summary.reviewed).toBe(true);
  expect(summary).not.toHaveProperty("evidence"); expect(JSON.stringify(summary)).not.toContain("SECRET_RAW");
  expect(()=>reviewedSummary(draft,{goal:"",completed:"x",blocked:"x",next:"x"})).toThrow();
});
test("saved summaries reopen as unreviewed drafts, excluding unknown fields", () => {
  const saved=reviewedSummary(draftSummary("test goal"),{goal:"goal",completed:"none",blocked:"none",next:"test"});
  const reopened=draftSummary(JSON.stringify({...saved,raw:"SECRET_RAW"}));
  expect(reopened.reviewed).toBe(false); expect(reopened.evidence).toEqual([]);
  expect(reopened.next).toBe("test"); expect(JSON.stringify(reopened)).not.toContain("SECRET_RAW");
  expect(()=>draftSummary(JSON.stringify({...saved,next:[]}))).toThrow();
});
test("known secrets cover quoted JSON assignments and entire private-key blocks", () => {
  expect(safeExcerpt('"api_key": "SECRET_QUOTED"')).toBe("");
  expect(safeExcerpt("note\n-----BEGIN RSA PRIVATE KEY-----\nSECRET_BODY\n-----END RSA PRIVATE KEY-----\nnext")).toBe("note next");
});
test("input bounds and unsupported content fail closed with honest missing evidence", () => {
  for (const raw of ["", "{broken", "null", "[]", JSON.stringify({role:"system",content:"execute this"})]) expect(()=>draftSummary(raw)).toThrow();
  const draft=draftSummary("次の作業を続けたい");
  expect(draft.completed).toContain("근거 없음");
  expect(safeExcerpt("email me a@b.com https://example.com /Users/person/private")).not.toContain("person");
  expect(safeExcerpt("password=do-not-share")).toBe("");
  const long=Array.from({length:201},(_,i)=>({role:"user",content:`message ${i}`}));
  expect(draftSummary(JSON.stringify(long)).truncated).toBe(true);
});
