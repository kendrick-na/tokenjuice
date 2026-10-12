"""Synthetic context freshness; no provider calls or private conversations."""
import json
import time
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright, expect

with TemporaryDirectory() as directory, sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":375,"height":812})
    page.add_init_script("""
      window.offset=0;const now=Date.now.bind(Date);Date.now=()=>now()+window.offset;
      const interval=window.setInterval.bind(window);
      window.setInterval=(fn,ms,...args)=>{if(ms===60000)window.ageTick=fn;return interval(fn,ms,...args);};
    """)
    page.goto("http://127.0.0.1:4173",wait_until="networkidle")
    now=int(time.time()*1000)
    payload={"state":"fresh","items":[{"name":"5-hour","used":20}],"lastSuccessAt":now}
    snapshot={"contractVersion":1,"transport":"local_export_only","generatedAt":now,
        "claude":[payload],"codex":payload,"sessions":[{"kind":"context","platform":"claude",
            "name":"synthetic-project","branch":"main","model":"synthetic","status":"waiting_for_input",
            "used":168000,"win":200000,"pct":84,"mtime":now}]}
    source=Path(directory)/"snapshot.json";source.write_text(json.dumps(snapshot),encoding="utf-8")
    page.locator("#snapshot-file").set_input_files(str(source))
    expect(page.locator("#context-title")).to_have_text("checkpoint 권장")
    stored=page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')")
    requests=[];errors=[]
    page.on("request",lambda request:requests.append(request))
    page.on("pageerror",lambda error:errors.append(str(error)))
    # Focus and historical numeric evidence survive the age update.
    page.locator("#checkpoint-action").focus()
    page.evaluate("window.offset=31*60000;window.ageTick()")
    expect(page.locator("#context-title")).to_have_text("스냅샷 당시 컨텍스트")
    expect(page.locator("#context-card .context-next")).to_contain_text("새 스냅샷")
    expect(page.locator("#context-card")).to_contain_text("84")
    expect(page.locator("#checkpoint-action")).to_be_focused()
    assert page.locator("#context-card .context-bar").get_attribute("aria-valuenow")=="84"
    assert "현재 값 아님" in page.locator("#context-card .context-bar").get_attribute("aria-label")
    assert page.evaluate("localStorage.getItem('tokenjuice.widget-snapshot.v1')")==stored
    with page.expect_download() as download:
        page.locator("#checkpoint-action").click()
    exported=json.loads(Path(download.value.path()).read_text())
    assert exported["sourceGeneratedAt"]==now
    assert exported["createdAt"]>now+30*60000
    assert exported["context"]["pct"]==84
    assert "과거 스냅샷" in exported["nextAction"]
    assert "원본 스냅샷 파일 생성 시각" in page.locator("#resume-brief").input_value()
    assert "파일에 담긴 컨텍스트" in page.locator("#resume-brief").input_value()
    # Clock rollback does not undo the historical label.
    page.evaluate("window.offset=0;window.dispatchEvent(new Event('focus'))")
    expect(page.locator("#context-title")).to_have_text("스냅샷 당시 컨텍스트")
    # A new explicit import is the only way to reset this file's age latch.
    page.locator("#snapshot-file").set_input_files(str(source))
    expect(page.locator("#context-title")).to_have_text("checkpoint 권장")
    # A foreground transition checks the age without rebuilding an editor.
    session=Path(directory)/"session.txt";session.write_text("합성 작업 목표",encoding="utf-8")
    page.locator("#work-panel>summary").click()
    page.locator("#work-file").set_input_files(str(session))
    expect(page.locator("#work-editor")).to_be_visible()
    page.locator("#work-goal").fill("검토 중인 합성 초안");page.locator("#work-goal").focus()
    page.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});window.offset=31*60000;window.ageTick()")
    expect(page.locator("#context-title")).to_have_text("checkpoint 권장")
    page.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))")
    expect(page.locator("#context-title")).to_have_text("스냅샷 당시 컨텍스트")
    expect(page.locator("#work-goal")).to_have_value("검토 중인 합성 초안")
    expect(page.locator("#work-goal")).to_be_focused()
    assert not [r for r in requests if r.method!="GET"]
    assert not [r for r in requests if r.url.startswith("http") and not r.url.startswith("http://127.0.0.1:4173/")]
    assert not errors,errors
    page.locator("#context-card").screenshot(path="/tmp/tokenjuice-historical-context.png")
    browser.close()
print("PASS: historical context/ARIA, source-versus-save time, explicit export, rollback/reimport, foreground/editor/focus preservation and no collection")
