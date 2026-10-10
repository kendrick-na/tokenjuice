"""Synthetic-only browser acceptance of local drafts; never read real sessions."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright

with TemporaryDirectory() as directory, sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 375, "height": 812})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:4173", wait_until="networkidle")
    page.locator("#work-panel > summary").click()
    session = Path(directory) / "session.jsonl"
    session.write_text("\n".join(json.dumps(row) for row in [
        {"sessionId": "synthetic", "message": {"role": "user", "content": "로그인 오류를 수정해줘"}},
        {"sessionId": "synthetic", "message": {"role": "assistant", "content": "수정 완료. 다음은 실제 테스트 확인"}},
        {"sessionId": "synthetic", "message": {"role": "user", "content": "아직 오류 있음\napi_key=SECRET_KEY"}},
    ]), encoding="utf-8")
    outgoing = []
    page.on("request", lambda request: outgoing.append(request))
    page.locator("#work-file").set_input_files(str(session))
    page.locator("#work-editor").wait_for(state="visible")
    assert "로그인 오류" in page.locator("#work-goal").input_value()
    assert "수정 완료" in page.locator("#work-completed").input_value()
    assert "SECRET_KEY" not in page.locator("#work-evidence").inner_text()
    assert page.locator("#work-download").is_disabled()
    assert page.locator("#work-copy").is_disabled()
    page.locator("#work-review").check()
    page.locator("#work-next").fill("다음은 테스트를 실행한다")
    assert not page.locator("#work-review").is_checked()
    assert page.locator("#work-download").is_disabled()
    assert page.locator("#work-copy").is_disabled()
    page.locator("#work-review").check()
    with page.expect_download() as result:
        page.locator("#work-download").click()
    exported = json.loads(Path(result.value.path()).read_text(encoding="utf-8"))
    assert exported["next"] == "다음은 테스트를 실행한다"
    assert exported["reviewed"] is True and "evidence" not in exported
    assert "synthetic" not in json.dumps(exported)
    session.write_text(json.dumps(exported), encoding="utf-8")
    page.locator("#work-file").set_input_files(str(session))
    page.wait_for_function("document.querySelector('#work-file').value === ''")
    assert page.locator("#work-next").input_value() == exported["next"]
    assert page.locator("#work-evidence").inner_text() == ""
    assert not page.locator("#work-review").is_checked()
    before = page.locator("#work-goal").input_value()
    session.write_text("{broken", encoding="utf-8")
    page.locator("#work-file").set_input_files(str(session))
    page.wait_for_function("document.querySelector('#work-file').value === ''")
    assert page.locator("#work-goal").input_value() == before
    assert "기존 초안은 유지" in page.locator("#work-feedback").inner_text()
    cloud = {"format":"tokenjuice-ai-work-summary-v1", "method":"cloud_generative_user_reviewed",
        "privacy":"reviewed_cloud_excerpt", "reviewed":True, "createdAt":1,
        "goal":"AI 요약 목표", "completed":"완료 주장은 실제 테스트 확인 필요", "blocked":"없음", "next":"변경 파일 확인",
        "raw":"SECRET_RAW", "apiKey":"SECRET_KEY"}
    session.write_text(json.dumps(cloud), encoding="utf-8")
    page.locator("#work-file").set_input_files(str(session))
    page.wait_for_function("document.querySelector('#work-file').value === ''")
    assert "클라우드 AI 요약 파일" in page.locator("#work-source").inner_text()
    assert not page.locator("#work-review").is_checked()
    assert page.locator("#work-copy").is_disabled()
    page.locator("#work-next").fill("AI 요약에서 편집한 다음 행동")
    page.locator("#work-review").check()
    page.evaluate("Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:async text => {window.testCopied=text;}}})")
    page.locator("#work-copy").click()
    page.wait_for_function("typeof window.testCopied === 'string'")
    copied = page.evaluate("window.testCopied")
    assert "클라우드 AI 요약 파일" in copied and "AI 요약에서 편집한 다음 행동" in copied
    assert "실제 파일·테스트" in copied and "SECRET_" not in copied
    page.evaluate("() => { navigator.clipboard.writeText = async () => {throw new Error('denied');}; }")
    page.locator("#work-copy").click()
    page.wait_for_function("document.querySelector('#work-feedback').textContent.includes('클립보드 접근')")
    with page.expect_download() as result:
        page.locator("#work-download").click()
    saved_cloud = json.loads(Path(result.value.path()).read_text(encoding="utf-8"))
    assert saved_cloud["format"] == cloud["format"] and saved_cloud["privacy"] == cloud["privacy"]
    assert saved_cloud["next"] == "AI 요약에서 편집한 다음 행동"
    assert "SECRET_" not in json.dumps(saved_cloud)
    session.write_text(json.dumps({**cloud, "reviewed":False}), encoding="utf-8")
    page.locator("#work-file").set_input_files(str(session))
    page.wait_for_function("document.querySelector('#work-file').value === ''")
    assert page.locator("#work-next").input_value() == saved_cloud["next"]
    page.emulate_media(reduced_motion="reduce")
    for width, height in [(375,812), (812,375), (1280,900)]:
        page.set_viewport_size({"width":width,"height":height})
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        for selector in ["#work-copy", "#work-download", "#work-clear"]:
            assert page.locator(selector).bounding_box()["height"] >= 44
    page.set_viewport_size({"width":375,"height":812})
    page.locator("#work-review").focus()
    page.keyboard.press("Space")
    assert not page.locator("#work-review").is_checked()
    assert page.locator("#work-copy").is_disabled()
    assert page.evaluate("localStorage.length") == 0
    assert not [request for request in outgoing if request.method != "GET" or request.post_data]
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.screenshot(path="/tmp/tokenjuice-work-summary-review.png", full_page=True)
    page.locator("#work-clear").click()
    assert page.locator("#work-editor").is_hidden()
    assert page.locator("#work-evidence").inner_text() == ""
    assert page.locator("#work-source").inner_text() == ""
    assert not errors, errors
    browser.close()
print("PASS: local/AI file reopen, provenance, re-review/edit/export, handoff copy/denial, invalid-file preservation, clear, 375px and no upload")
