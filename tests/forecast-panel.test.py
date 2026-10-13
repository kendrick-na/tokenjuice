"""Separate local estimates from quota; synthetic browser fixtures only."""
import json,time
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright,expect

with TemporaryDirectory() as directory,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":375,"height":812})
    page.add_init_script("""
      window.offset=0;const now=Date.now.bind(Date);Date.now=()=>now()+window.offset;
      const interval=window.setInterval.bind(window);
      window.setInterval=(fn,ms,...args)=>{if(ms===60000)window.ageTick=fn;return interval(fn,ms,...args);};
    """)
    errors=[];requests=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.on("request",lambda request:requests.append(request))
    page.goto("http://127.0.0.1:4173/",wait_until="networkidle")
    now=int(time.time()*1000)
    forecast={"kind":"local_pace_estimate","beforeReset":True,"exhaustionAt":now+120*60000}
    payload={"state":"fresh","lastSuccessAt":now,"items":[{"name":"5-hour","used":25,"forecast":forecast}]}
    snapshot={"contractVersion":1,"transport":"local_export_only","generatedAt":now,"claude":[payload],
      "codex":{"state":"fresh","lastSuccessAt":now,"items":[{"name":"Weekly","used":40}]}}
    source=Path(directory)/"snapshot.json"
    def load(value):
        source.write_text(json.dumps(value),encoding="utf-8")
        page.locator("#snapshot-file").set_input_files(str(source))
    load(snapshot)
    panel=page.locator("#forecast-panel")
    expect(panel).to_be_visible()
    assert page.locator("#accounts .forecast,#accounts .pace-row").count()==0
    expect(panel).to_contain_text("로컬 소진 예상")
    expect(panel).to_contain_text("공식 한도가 아닙니다")
    expect(panel.locator(".pace-state")).to_have_text("리셋 전 소진 예상")
    expect(panel.locator(".pace-time")).to_contain_text("예상 소진")
    assert "시각 없음" not in panel.locator(".pace-time").inner_text()
    panel.screenshot(path="/tmp/tokenjuice-forecast-current-mobile.png")
    page.set_viewport_size({"width":1280,"height":900})
    page.screenshot(path="/tmp/tokenjuice-forecast-desktop.png",full_page=True)
    page.set_viewport_size({"width":375,"height":812})
    expect(page.locator("#priority-card h1")).to_contain_text("리셋 전 소진 예상")
    page.locator("#priority-action").click()
    expect(panel).to_be_focused()
    assert page.locator("#quota-claude-0 .metric-line strong").evaluate("(el)=>el.firstChild.textContent")=="75"
    expect(page.locator("#quota-claude-0 .metric-line small")).to_have_text("% 남음")
    expect(page.locator("#quota-claude-0 .recovery")).to_contain_text("로컬 소진 예상")
    expect(page.locator("#quota-claude-0 .recovery")).not_to_contain_text("계속 작업해도 좋습니다")
    page.locator("#forecast-history").focus()
    page.keyboard.press("Enter")
    assert page.locator("#history-panel").evaluate("(el)=>el.open")
    expect(page.locator("#history-file")).to_be_focused()
    # Age tick changes annotations, not the imported snapshot or focused input.
    stored=page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')")
    page.evaluate("window.offset=31*60000;window.ageTick()")
    expect(panel.locator(".pace-state")).to_have_text("과거 추정")
    expect(panel.locator(".pace-time")).to_contain_text("당시 예상 소진")
    expect(panel).to_contain_text("새 스냅샷")
    expect(page.locator("#history-file")).to_be_focused()
    assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')")==stored
    page.evaluate("window.offset=0;window.dispatchEvent(new Event('focus'))")
    expect(panel.locator(".pace-state")).to_have_text("과거 추정")
    load(snapshot)
    expect(panel.locator(".pace-state")).to_have_text("리셋 전 소진 예상")
    # Forecast's own deadline can pass before the 30-minute snapshot TTL.
    forecast["exhaustionAt"]=now+5*60000
    load(snapshot)
    page.evaluate("window.offset=6*60000;window.ageTick()")
    expect(panel.locator(".pace-state")).to_have_text("예상 시각 지남")
    expect(page.locator("#priority-card h1")).to_have_text("소진 예상 재확인 필요")
    expect(page.locator("#priority-card")).to_contain_text("실제 소진 여부는 확인되지 않았습니다")
    page.evaluate("window.offset=0;window.dispatchEvent(new Event('focus'))")
    expect(panel.locator(".pace-state")).to_have_text("예상 시각 지남")
    # Failed/fallback observations cannot promote their attached estimates.
    for state in ["fallback","stale","auth_expired","rate_limited","unavailable"]:
        snapshot["claude"][0]["state"]=state
        load(snapshot)
        expect(panel).to_be_hidden()
    snapshot["claude"][0]["state"]="fresh"
    forecast["exhaustionAt"]=None
    load(snapshot)
    expect(panel.locator(".pace-time")).to_have_text("소진 예상 시각 없음")
    for width,height in [(375,812),(812,375),(1280,900)]:
        page.set_viewport_size({"width":width,"height":height})
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    page.set_viewport_size({"width":375,"height":812})
    panel.screenshot(path="/tmp/tokenjuice-forecast-mobile.png")
    page.emulate_media(reduced_motion="reduce")
    page.evaluate("document.documentElement.style.fontSize='32px'")
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    assert not [r for r in requests if r.method!="GET"]
    assert not [r for r in requests if r.url.startswith("http") and not r.url.startswith("http://127.0.0.1:4173/")]
    assert not errors,errors
    browser.close()
print("PASS: separate estimate/quota/history, explicit timing/unknown, expiry/rollback, keyboard/focus/storage, mobile/large text and no collection")
