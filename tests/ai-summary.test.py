"""Local generation UI with synthetic data and a fake provider only."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright, expect

with TemporaryDirectory() as directory, sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1280,"height":900})
    errors=[];requests=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.on("request",lambda request:requests.append(request))
    page.goto("http://127.0.0.1:4181",wait_until="networkidle")
    expect(page.locator("#file")).to_be_enabled()
    source=Path(directory)/"session.txt"
    source.write_text("합성 작업 목표\napi_key=SECRET_RAW",encoding="utf-8")
    page.locator("#file").set_input_files(str(source))
    page.locator("#preview-panel").wait_for(state="visible")
    page.get_by_text("기술 정보 · 전체 전송 JSON과 시스템 지시",exact=True).click()
    expect(page.locator("#payload")).to_be_visible()
    assert "SECRET_RAW" not in page.locator("#payload").inner_text()
    assert "count_tokens" in page.locator("#payload").inner_text()
    page.get_by_text("기술 정보 · 전체 전송 JSON과 시스템 지시",exact=True).click()
    assert "USD" in page.locator("#policy").inner_text()
    assert page.locator("#generate").is_disabled()
    assert not [r for r in requests if r.url.endswith("/generate")]
    page.locator("#consent").check()
    page.locator("#generate").click()
    page.locator("#review-panel").wait_for(state="visible")
    assert len([r for r in requests if r.url.endswith("/generate")])==1
    assert page.locator("#generate").is_disabled()
    assert page.locator("#save").is_disabled()
    page.locator("#reviewed").check()
    page.locator("#next").fill("실제 파일과 테스트 확인")
    assert not page.locator("#reviewed").is_checked()
    assert page.locator("#save").is_disabled()
    page.locator("#reviewed").check()
    with page.expect_download() as result:page.locator("#save").click()
    saved=json.loads(Path(result.value.path()).read_text(encoding="utf-8"))
    assert saved["format"]=="tokenjuice-ai-work-summary-v1"
    assert saved["next"]=="실제 파일과 테스트 확인"
    assert "evidence" not in saved and "SECRET" not in json.dumps(saved)
    assert not [r for r in requests if r.url.endswith("/review")]
    for width,height in [(1280,900),(375,812),(812,375)]:
        page.set_viewport_size({"width":width,"height":height})
        assert page.evaluate("document.documentElement.scrollWidth<=window.innerWidth")
        assert page.locator("#save").bounding_box()["height"]>=44
    page.set_viewport_size({"width":1280,"height":900})
    page.screenshot(path="/tmp/tokenjuice-ai-summary-desktop.png",full_page=True)
    page.set_viewport_size({"width":375,"height":812})
    page.screenshot(path="/tmp/tokenjuice-ai-summary-mobile.png",full_page=True)
    page.emulate_media(reduced_motion="reduce")
    page.evaluate("document.documentElement.style.fontSize='32px'")
    assert page.evaluate("document.documentElement.scrollWidth<=window.innerWidth")
    source.write_text("{broken",encoding="utf-8")
    page.locator("#file").set_input_files(str(source))
    expect(page.locator("#file")).to_be_enabled()
    assert page.locator("#next").input_value()==saved["next"]
    assert page.evaluate("localStorage.length===0 && sessionStorage.length===0")
    assert all(r.url.startswith("http://127.0.0.1:4181/") for r in requests)
    page.route("**/api/summary/discard",lambda route:route.fulfill(status=409,content_type="application/json",body='{"error":"approval_unavailable"}'))
    page.locator("#clear").click()
    page.locator("#review-panel").wait_for(state="hidden")
    assert page.locator("#payload").inner_text()==""
    assert "서버 삭제는 확인하지 못했습니다" in page.locator("#status").inner_text()
    assert not errors,errors
    browser.close()
print("PASS: local preview/consent/generation/review/export, duplicate guard, failed-file preservation, responsive layout, clear and no external browser requests")
