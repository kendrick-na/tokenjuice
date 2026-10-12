"""Synthetic feedback composer: no real issue, upload or private user data."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright, expect

with TemporaryDirectory() as directory, sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(viewport={"width":375,"height":812},accept_downloads=True)
    page=context.new_page()
    requests=[];errors=[]
    context.on("request",lambda r:requests.append(r))
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto("http://127.0.0.1:4173",wait_until="networkidle")
    page.locator("#feedback-open").click()
    expect(page.locator("#feedback-topic")).to_be_focused()
    expect(page.locator("#feedback-copy")).to_be_disabled()
    page.locator("#feedback-description").fill("합성 재현 순서\napi_key=PRIVATE_TOKEN\nuser@example.com /Users/private/test")
    page.locator("#feedback-prepare").click()
    expect(page.locator("#feedback-preview")).to_be_focused()
    report=json.loads(page.locator("#feedback-preview").inner_text())
    assert "diagnostics" not in report
    assert "PRIVATE" not in json.dumps(report)
    expect(page.locator("#feedback-copy")).to_be_disabled()
    expect(page.locator("#feedback-submit")).to_be_hidden()
    page.locator("#feedback-diagnostics").check()
    expect(page.locator("#feedback-preview-panel")).to_be_hidden()
    page.locator("#feedback-prepare").click()
    report=json.loads(page.locator("#feedback-preview").inner_text())
    assert report["diagnostics"]["source"]=="no_snapshot"
    page.locator("#feedback-reviewed").check()
    page.evaluate("() => {navigator.clipboard.writeText=async text=>{window.copiedFeedback=text;};}")
    page.locator("#feedback-copy").click()
    expect(page.locator("#feedback-status")).to_contain_text("복사했습니다")
    assert json.loads(page.evaluate("window.copiedFeedback"))==report
    with page.expect_download() as download:
        page.locator("#feedback-download").click()
    assert json.loads(Path(download.value.path()).read_text())==report
    page.evaluate("() => {navigator.clipboard.writeText=async()=>{throw Error('PRIVATE_CLIPBOARD');};}")
    page.locator("#feedback-copy").click()
    expect(page.locator("#feedback-status")).to_contain_text("복사를 확인하지 못했습니다")
    assert "PRIVATE" not in page.locator("#feedback-status").inner_text()
    assert not [r for r in requests if r.url.startswith("http") and not r.url.startswith("http://127.0.0.1:4173")]
    assert not [r for r in requests if r.method!="GET"]
    context.route("https://github.com/**",lambda route:route.fulfill(status=200,content_type="text/html",body="Synthetic issue form; not submitted"))
    with page.expect_popup() as popup:
        page.locator("#feedback-submit").click()
    popup.value.wait_for_load_state()
    assert popup.value.url=="https://github.com/kendrick-na/tokenjuice/issues/new?template=feedback.yml"
    assert len([r for r in requests if r.url.startswith("https://github.com")])==1
    popup.value.close()
    page.locator("#feedback-description").fill("변경한 합성 제보")
    expect(page.locator("#feedback-reviewed")).not_to_be_checked()
    expect(page.locator("#feedback-submit")).to_be_hidden()
    page.locator("#preview-demo").click()
    page.locator("#feedback-prepare").click()
    report=json.loads(page.locator("#feedback-preview").inner_text())
    assert report["diagnostics"]["source"]=="demo_only"
    snapshot={"contractVersion":1,"transport":"local_export_only","generatedAt":1700000000000,
        "claude":[{"state":"auth_expired","account":"PRIVATE_ACCOUNT","source":"PRIVATE_SOURCE","items":[]}],
        "codex":{"state":"fresh","items":[]},"sessions":[],"private":"PRIVATE_RAW"}
    source=Path(directory)/"synthetic-snapshot.json"
    source.write_text(json.dumps(snapshot),encoding="utf-8")
    page.locator("#snapshot-file").set_input_files(str(source))
    expect(page.locator("#accounts")).to_contain_text("PRIVATE_ACCOUNT")
    page.locator("#feedback-prepare").click()
    report=json.loads(page.locator("#feedback-preview").inner_text())
    assert report["diagnostics"]["source"]=="imported_snapshot_not_live"
    assert report["diagnostics"]["age"]=="older_than_30m"
    assert report["diagnostics"]["providers"][0]=={"provider":"claude","state":"auth_expired"}
    assert "PRIVATE" not in json.dumps(report)
    for width in [375,1280]:
        page.set_viewport_size({"width":width,"height":900})
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        for selector in ["#feedback-prepare","#feedback-reset","#feedback-topic"]:
            assert page.locator(selector).bounding_box()["height"]>=44
    page.set_viewport_size({"width":375,"height":812})
    page.locator("#feedback-panel").screenshot(path="/tmp/tokenjuice-feedback-mobile.png")
    assert "변경한 합성 제보" not in page.evaluate("JSON.stringify(localStorage)")
    assert "PRIVATE_TOKEN" not in page.evaluate("JSON.stringify(localStorage)")
    page.locator("#feedback-reset").click()
    expect(page.locator("#feedback-description")).to_have_value("")
    expect(page.locator("#feedback-diagnostics")).not_to_be_checked()
    expect(page.locator("#feedback-preview-panel")).to_be_hidden()
    assert not errors,errors
    page.reload(wait_until="networkidle")
    expect(page.locator("#feedback-description")).to_have_value("")
    assert not [r for r in requests if r.method!="GET"]
    browser.close()
print("PASS: feedback preview, opt-in whitelist/demo distinction, review reset, copy failure/download, fixed issue URL, responsive targets and no submission/persistence")
