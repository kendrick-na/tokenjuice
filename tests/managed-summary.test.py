"""Synthetic gateway/browser only; no private conversation or real login/API."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright, expect

with TemporaryDirectory() as directory, sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1280,"height":900})
    errors=[]; requests=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.on("request",lambda request:requests.append(request))
    page.on("dialog",lambda dialog:dialog.accept())
    page.goto("http://127.0.0.1:4183",wait_until="networkidle")
    expect(page.locator("#file")).to_be_enabled()
    expect(page.locator("#quota")).to_contain_text("2/2회 남음")
    assert "API 키 입력이 필요하지 않습니다" in page.locator("#status").inner_text()
    source=Path(directory)/"session.jsonl"
    source.write_text(json.dumps({"sessionId":"PRIVATE_ID","type":"user","message":{"role":"user","content":"합성 목표 확인\napi_key=PRIVATE_SECRET"}},ensure_ascii=False)+"\n"+
                      json.dumps({"sessionId":"PRIVATE_ID","message":{"role":"assistant","content":"완료 주장 검토 필요"}},ensure_ascii=False)+"\n"+
                      json.dumps({"message":{"role":"tool","content":"PRIVATE_TOOL"}}),encoding="utf-8")
    page.locator("#file").set_input_files(str(source))
    page.locator("#upload-panel").wait_for(state="visible")
    excerpt=page.locator("#local-excerpt").inner_text()
    assert "PRIVATE" not in excerpt
    assert not [r for r in requests if r.url.endswith("/preview") or r.url.endswith("/generate")]
    assert page.locator("#upload").is_disabled()
    page.locator("#upload-consent").focus();page.keyboard.press("Space")
    page.locator("#upload").click()
    page.locator("#preview-panel").wait_for(state="visible")
    uploads=[r for r in requests if r.url.endswith("/preview")]
    assert len(uploads)==1
    uploaded=json.loads(uploads[0].post_data)
    assert uploaded["raw"]==excerpt and uploaded["confirmed"] is True
    assert uploaded["policyVersion"]=="test-v1" and "PRIVATE" not in uploads[0].post_data
    assert "사용자 청구서가 아닙니다" in page.locator("#model-policy").inner_text()
    assert not [r for r in requests if r.url.endswith("/generate")]
    assert page.locator("#generate").is_disabled()
    page.locator("#generate-consent").check();page.locator("#generate").click()
    page.locator("#review-panel").wait_for(state="visible")
    expect(page.locator("#quota")).to_contain_text("1/2회 남음")
    assert len([r for r in requests if r.url.endswith("/generate")])==1
    assert page.locator("#generate").is_disabled() and page.locator("#save").is_disabled()
    page.locator("#reviewed").check();page.locator("#next").fill("실제 변경과 테스트 확인 후 다음 작업")
    assert not page.locator("#reviewed").is_checked()
    page.locator("#reviewed").check()
    with page.expect_download() as result:page.locator("#save").click()
    saved=json.loads(Path(result.value.path()).read_text(encoding="utf-8"))
    assert saved["method"]=="cloud_generative_user_reviewed"
    assert saved["privacy"]=="reviewed_cloud_excerpt"
    assert saved["next"]=="실제 변경과 테스트 확인 후 다음 작업"
    assert "evidence" not in saved and "PRIVATE" not in json.dumps(saved)
    assert not [r for r in requests if r.url.endswith("/review")]
    reopened=page.evaluate("async raw => (await import('/companion/work-summary.js')).draftSummary(raw)",json.dumps(saved))
    assert reopened["method"]=="cloud_generative" and reopened["reviewed"] is False
    for width,height in [(375,812),(812,375),(1280,900)]:
        page.set_viewport_size({"width":width,"height":height})
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        assert page.locator("#save").bounding_box()["height"]>=44
    page.set_viewport_size({"width":375,"height":812})
    page.screenshot(path="/tmp/tokenjuice-managed-summary-mobile.png",full_page=True)
    page.emulate_media(reduced_motion="reduce")
    page.evaluate("document.documentElement.style.fontSize='32px'")
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    source.write_text("{broken",encoding="utf-8");page.locator("#file").set_input_files(str(source))
    expect(page.locator("#file")).to_be_enabled()
    assert page.locator("#next").input_value()==saved["next"]
    page.route("**/auth/logout",lambda route:route.fulfill(status=503,content_type="application/json",body='{"error":"logout_unavailable"}'))
    page.locator("#logout").click()
    expect(page.locator("#status")).to_contain_text("서버 로그아웃을 확인하지 못했습니다")
    assert page.locator("#file").is_disabled() and page.locator("#save").is_enabled()
    assert page.locator("#next").input_value()==saved["next"]
    page.locator("#connect").click();expect(page.locator("#file")).to_be_enabled()
    page.unroute("**/auth/logout")
    page.evaluate("""() => {
      const original=File.prototype.text;
      File.prototype.text=function(){return this.name==='delayed.txt'
        ?new Promise(resolve=>{window.releaseDelayedFile=resolve;}):original.call(this);};
    }""")
    delayed=Path(directory)/"delayed.txt";delayed.write_text("로그아웃 뒤 반영하면 안 되는 새 선택",encoding="utf-8")
    page.locator("#file").set_input_files(str(delayed))
    page.wait_for_function("typeof window.releaseDelayedFile==='function'")
    page.locator("#logout").click()
    expect(page.locator("#status")).to_contain_text("서버 세션에서 로그아웃했습니다")
    page.evaluate("async()=>{window.releaseDelayedFile('뒤늦은 선택');await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)}")
    assert page.locator("#next").input_value()==saved["next"] and page.locator("#save").is_enabled()
    page.locator("#connect").click()
    expect(page.locator("#status")).to_contain_text("계정 로그인 확인")
    pending_policy=[]
    page.route("**/api/summary/policy",lambda route:pending_policy.append(route))
    with page.expect_request("**/api/summary/policy"):
        page.locator("#connect").click()
    expect(page.locator("#connect")).to_be_disabled()
    # A held response proves the in-progress state independently of timing.
    expect(page.locator("#status")).to_contain_text("계정 연결과 요약 권한을 다시 확인 중입니다")
    expect(page.locator("#status")).not_to_contain_text("계정 로그인 확인이 필요")
    assert page.locator("#next").input_value()==saved["next"]
    expect(page.locator("#quota")).to_contain_text("남은 요청 횟수 확인 불가")
    assert page.locator("#save").is_disabled()
    assert len(pending_policy)==1
    pending_policy[0].fulfill(status=401,content_type="application/json",body='{"error":"authentication_required"}')
    expect(page.locator("#connect")).to_be_enabled()
    expect(page.locator("#save")).to_be_enabled()
    expect(page.locator("#status")).to_contain_text("계정 로그인 확인")
    assert page.locator("#file").is_disabled()
    assert page.locator("#next").input_value()==saved["next"]
    assert page.locator("#save").is_enabled()
    assert len([r for r in requests if r.url.endswith("/preview")])==1
    assert len([r for r in requests if r.url.endswith("/generate")])==1
    page.route("**/api/summary/discard",lambda route:route.fulfill(status=401,content_type="application/json",body='{"error":"authentication_required"}'))
    page.locator("#clear").click()
    expect(page.locator("#status")).to_contain_text("서버 삭제는 확인하지 못했")
    assert page.locator("#review-panel").is_hidden()
    assert page.evaluate("localStorage.length===0 && sessionStorage.length===0")
    assert all(r.url.startswith("http://127.0.0.1:4183/") for r in requests)
    assert not errors,errors
    browser.close()
print("PASS: managed cloud local excerpt/no-upload before consent, exact upload, separate generation consent, review/export/reopen, auth failure preservation, responsive/keyboard and no external browser calls")

with TemporaryDirectory() as directory, sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":375,"height":812})
    requests=[];errors=[]
    page.on("request",lambda request:requests.append(request))
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.goto("http://127.0.0.1:4183",wait_until="networkidle")
    page.request.post("http://127.0.0.1:4183/test/session",headers={"origin":"http://127.0.0.1:4183","content-type":"application/json"},data="{}")
    page.locator("#connect").click();expect(page.locator("#file")).to_be_enabled()
    expect(page.locator("#quota")).to_contain_text("1/2회 남음")
    source=Path(directory)/"session.txt"
    source.write_text("두 번째 합성 작업 확인",encoding="utf-8")
    page.locator("#file").set_input_files(str(source));page.locator("#upload-panel").wait_for(state="visible")
    page.locator("#upload-consent").check();page.locator("#upload").click()
    page.locator("#preview-panel").wait_for(state="visible")
    page.locator("#generate-consent").check();page.locator("#generate").click()
    page.locator("#review-panel").wait_for(state="visible")
    expect(page.locator("#quota")).to_contain_text("0/2회 남음")
    source.write_text("한도 소진 후 새 합성 발췌",encoding="utf-8")
    page.locator("#file").set_input_files(str(source));page.locator("#upload-panel").wait_for(state="visible")
    page.locator("#upload-consent").check();page.locator("#upload").click()
    page.locator("#preview-panel").wait_for(state="visible")
    page.locator("#generate-consent").check()
    assert page.locator("#generate").is_disabled()
    assert len([r for r in requests if r.url.endswith("/generate")])==1
    page.evaluate("window.savedNow=Date.now;Date.now=()=>window.savedNow()+180000")
    page.locator("#connect").click()
    expect(page.locator("#quota")).to_contain_text("오래된 관측 · 다시 확인 필요")
    assert "UTC" in page.locator("#quota").inner_text()
    assert len([r for r in requests if r.url.endswith("/generate")])==1
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    assert all(r.url.startswith("http://127.0.0.1:4183/") for r in requests)
    assert not errors,errors
    browser.close()
print("PASS: actual synthetic attempt exhaustion, zero distinct from unknown, no new generation at fresh zero, stale observation labels and no automatic provider retry")

with TemporaryDirectory() as directory, sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":375,"height":812})
    page.on("dialog",lambda dialog:dialog.accept())
    page.request.post("http://127.0.0.1:4183/test/session",headers={"origin":"http://127.0.0.1:4183","content-type":"application/json"},data='{"scenario":"race"}')
    page.goto("http://127.0.0.1:4183",wait_until="networkidle")
    source=Path(directory)/"session.txt";source.write_text("지연 합성 생성 검증",encoding="utf-8")
    page.locator("#file").set_input_files(str(source));page.locator("#upload-panel").wait_for(state="visible")
    page.locator("#upload-consent").check();page.locator("#upload").click();page.locator("#preview-panel").wait_for(state="visible")
    pending=[]
    page.route("**/api/summary/generate",lambda route:pending.append(route))
    page.locator("#generate-consent").check();page.locator("#generate").click()
    expect(page.locator("#logout")).to_be_enabled()
    page.locator("#logout").click();expect(page.locator("#status")).to_contain_text("서버 세션에서 로그아웃했습니다")
    assert len(pending)==1
    pending[0].fulfill(status=200,content_type="application/json",body=json.dumps({"method":"cloud_generative","summary":{field:{"text":"늦게 도착한 합성 초안"} for field in ["goal","completed","blocked","next"]}}))
    page.evaluate("async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)}")
    assert page.locator("#review-panel").is_hidden()
    assert "로그아웃했습니다" in page.locator("#status").inner_text()
    assert page.locator("#file").is_disabled()
    page.locator("#connect").click();expect(page.locator("#status")).to_contain_text("계정 로그인 확인")
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    browser.close()
print("PASS: real synthetic session logout route, failed logout and editor preservation, logged-out API denial and late generation response discard")
