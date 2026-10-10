"""Synthetic-only selected file/summary handoff acceptance."""
import json,time
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright,expect
with TemporaryDirectory() as directory,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":375,"height":812})
    errors=[];requests=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.on("request",lambda request:requests.append(request.url))
    page.goto("http://127.0.0.1:4173/",wait_until="networkidle")
    page.locator("#work-panel > summary").click()
    summary=Path(directory)/"summary.txt";summary.write_text("현재 목표. 수정 완료 주장. 다음은 테스트.",encoding="utf-8")
    page.locator("#work-file").set_input_files(str(summary))
    expect(page.locator("#work-editor")).to_be_visible()
    page.locator(".work-files-panel > summary").click()
    evidence={"format":"tokenjuice-worktree-evidence-v1","privacy":"explicit_relative_paths","reviewed":True,
        "createdAt":int(time.time()*1000)-7200000,"head":"a"*40,"branch":"feature/hand-off","excluded":0,
        "files":[{"path":"src/한글 파일.js","indexStatus":" ","worktreeStatus":"M","raw":"SECRET"},
            {"path":"do-not-share.js","indexStatus":"?","worktreeStatus":"?"},
            {"path":".env","indexStatus":"?","worktreeStatus":"?"}],"raw":"SECRET"}
    source=Path(directory)/"files.json";source.write_text(json.dumps(evidence),encoding="utf-8")
    page.locator("#work-files-input").set_input_files(str(source))
    expect(page.locator("#work-files-content")).to_be_visible()
    assert page.locator("#work-files-list input").count()==2
    assert "1시간 이상" in page.locator("#work-files-meta").inner_text()
    assert "SECRET" not in page.locator("#work-panel").inner_text()
    assert not page.locator("#work-files-review").is_checked()
    assert page.locator("#work-package").is_disabled()
    page.locator("#work-files-list input").first.check()
    page.locator("#work-files-review").check();page.locator("#work-review").check()
    expect(page.locator("#work-package")).to_be_enabled()
    with page.expect_download() as result:page.locator("#work-package").click()
    package=json.loads(Path(result.value.path()).read_text(encoding="utf-8"))
    assert len(package["worktree"]["files"])==1
    assert "do-not-share.js" not in json.dumps(package) and "SECRET" not in json.dumps(package)
    with page.expect_download() as result:page.locator("#work-download").click()
    basic=json.loads(Path(result.value.path()).read_text(encoding="utf-8"))
    assert basic["format"]=="tokenjuice-work-summary-v1" and "worktree" not in basic
    page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}})")
    page.locator("#work-copy").click();page.wait_for_function("typeof window.copied==='string'")
    assert "src/한글 파일.js" in page.evaluate("window.copied")
    assert "완료/테스트 증거 아님" in page.evaluate("window.copied")
    page.locator("#work-next").fill("파일 상태 재확인")
    assert not page.locator("#work-files-review").is_checked() and not page.locator("#work-review").is_checked()
    assert page.locator("#work-package").is_disabled()
    before=page.locator("#work-files-meta").inner_text()
    source.write_text("{broken",encoding="utf-8")
    page.locator("#work-files-input").set_input_files(str(source))
    expect(page.locator("#work-files-feedback")).to_contain_text("기존 목록은 유지")
    assert before==page.locator("#work-files-meta").inner_text()
    summary.write_text(json.dumps(package),encoding="utf-8")
    page.locator("#work-file").set_input_files(str(summary))
    expect(page.locator("#work-files-list input")).to_have_count(1)
    assert not page.locator("#work-files-list input").is_checked()
    assert not page.locator("#work-files-review").is_checked() and not page.locator("#work-review").is_checked()
    page.locator("#work-files-list input").focus();page.keyboard.press("Space")
    assert page.locator("#work-files-list input").is_checked()
    for width,height in [(375,812),(812,375),(1280,900)]:
        page.set_viewport_size({"width":width,"height":height})
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    page.set_viewport_size({"width":375,"height":812})
    page.locator(".work-files-panel").screenshot(path="/tmp/tokenjuice-work-files-mobile.png")
    page.emulate_media(reduced_motion="reduce");page.evaluate("document.documentElement.style.fontSize='32px'")
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    assert page.locator(".work-file-row").bounding_box()["height"]>=44
    assert page.locator("#work-files-remove").bounding_box()["height"]>=44
    page.locator("#work-files-remove").click()
    assert page.locator("#work-files-content").is_hidden()
    page.locator("#work-review").check();expect(page.locator("#work-copy")).to_be_enabled()
    # Clearing while an asynchronous file read is pending must not resurrect data.
    source.write_text(json.dumps(evidence),encoding="utf-8")
    page.evaluate("""() => {const original=File.prototype.text;File.prototype.text=async function(){await new Promise(resolve=>window.releaseFile=resolve);return original.call(this);};} """)
    page.locator("#work-files-input").set_input_files(str(source))
    expect(page.locator("#work-files-open")).to_be_disabled()
    page.locator("#work-clear").click();page.evaluate("window.releaseFile()")
    expect(page.locator("#work-files-open")).to_be_enabled()
    assert page.locator("#work-editor").is_hidden()
    assert page.locator("#work-files-list input").count()==0
    assert page.evaluate("localStorage.length===0 && sessionStorage.length===0")
    assert all(url.startswith("http://127.0.0.1:4173") for url in requests)
    assert not errors,errors
    browser.close()
print("PASS: selected file/summary package, review reset, sensitive-path exclusion, malformed preservation, reopen, keyboard, mobile, clear and no upload")
