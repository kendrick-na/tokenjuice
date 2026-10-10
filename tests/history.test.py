"""History import and chart acceptance; synthetic observations only."""
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
    page.locator("#history-panel > summary").click()
    expect(page.locator("#history-file")).to_be_enabled()
    stamp=int(time.time()*1000)-1000
    source=Path(directory)/"history.json"
    observations=[{"key":"0:5-hour","at":stamp-delta,"used":used,"secret":"SECRET"}
        for delta,used in [(7200000,10),(6600000,25),(6000000,5),(600000,20),(0,30)]]
    source.write_text(json.dumps({"format":"tokenjuice-forecast-history-v1","observations":observations,"prompt":"SECRET"}),encoding="utf-8")
    page.locator("#history-file").set_input_files(str(source))
    page.locator("#history-content").wait_for(state="visible")
    assert page.locator("#history-chart circle").count()==5
    assert page.locator("#history-chart polyline").count()==2
    assert "현재 사용량이 아닙니다" in page.locator("#history-summary").inner_text()
    assert "SECRET" not in page.locator("#history-panel").inner_text()
    page.get_by_text("정확한 관측 표 보기",exact=True).click()
    assert page.locator("#history-rows tr").count()==5
    assert page.locator("#history-clear").bounding_box()["height"]>=44
    for width,height in [(375,812),(812,375),(1280,900)]:
        page.set_viewport_size({"width":width,"height":height})
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    page.set_viewport_size({"width":375,"height":812})
    page.locator("#history-panel").screenshot(path="/tmp/tokenjuice-history-mobile.png")
    page.emulate_media(reduced_motion="reduce")
    page.evaluate("document.documentElement.style.fontSize='32px'")
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    source.write_text("{broken",encoding="utf-8")
    page.locator("#history-file").set_input_files(str(source))
    expect(page.locator("#history-feedback")).to_contain_text("기존 화면은 유지")
    assert page.locator("#history-chart circle").count()==5
    source.write_text(json.dumps({"format":"tokenjuice-codex-forecast-history-v1","observations":[
        {"key":"cw_"+"a"*64,"at":stamp,"used":50},{"key":"cw_"+"b"*64,"at":stamp,"used":80}]}),encoding="utf-8")
    page.locator("#history-file").set_input_files(str(source))
    expect(page.locator("#history-feedback")).to_contain_text("Codex")
    page.locator("#history-series").select_option("1")
    assert "80%" in page.locator("#history-summary").inner_text()
    assert "cw_" not in page.locator("#history-panel").inner_text()
    assert page.evaluate("localStorage.length===0 && sessionStorage.length===0")
    page.locator("#history-clear").click()
    assert page.locator("#history-content").is_hidden()
    assert page.locator("#history-chart circle").count()==0
    assert all(url.startswith("http://127.0.0.1:4173/") for url in requests)
    assert not errors,errors
    browser.close()
print("PASS: history imports, gaps/decreases, accessible table, malformed-file preservation, Codex period selection, mobile/large text, clear and no upload")
