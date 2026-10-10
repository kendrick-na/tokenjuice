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
    page.locator("#work-review").check()
    page.locator("#work-next").fill("다음은 테스트를 실행한다")
    assert not page.locator("#work-review").is_checked()
    assert page.locator("#work-download").is_disabled()
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
    assert page.evaluate("localStorage.length") == 0
    assert not [request for request in outgoing if request.method != "GET" or request.post_data]
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.screenshot(path="/tmp/tokenjuice-work-summary-review.png", full_page=True)
    page.locator("#work-clear").click()
    assert page.locator("#work-editor").is_hidden()
    assert page.locator("#work-evidence").inner_text() == ""
    assert not errors, errors
    browser.close()
print("PASS: local draft, review gate, edited export, invalid-file preservation, clear, 375px and no data upload")
