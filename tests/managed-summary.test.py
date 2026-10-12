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
    page.goto("http://127.0.0.1:4183",wait_until="networkidle")
    expect(page.locator("#file")).to_be_enabled()
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
    page.route("**/api/summary/policy",lambda route:route.fulfill(status=401,content_type="application/json",body='{"error":"authentication_required"}'))
    page.locator("#connect").click()
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
