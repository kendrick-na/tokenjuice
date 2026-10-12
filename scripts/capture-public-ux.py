"""Explicit, unauthenticated public first-fold research; never a release test."""
import json
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

TARGETS = {
    "limits": "https://getlimits.app/",
    "openusage": "https://openusage.sh/",
    "vibeusage": "https://vibeusage.com/",
    "ai-limits-tracker": "https://ailimits.app/",
    "claudecodeusage": "https://github.com/ClaudeCodeUsage/ClaudeCodeUsage",
    "tokenjuice": "https://kendrick-na.github.io/tokenjuice/",
}

if __name__ == "__main__":
    root=Path(__file__).resolve().parents[1]
    date=datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # A new folder per capture, preserving all earlier evidence.
    stamp=datetime.now(timezone.utc).strftime("%H%M%S")
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        for slug,url in TARGETS.items():
            for width,height in [(375,812),(1280,900)]:
                folder=root/"scratchpad"/f"ux-capture-{date}-{stamp}"/slug
                folder.mkdir(parents=True,exist_ok=True)
                context=browser.new_context(viewport={"width":width,"height":height},locale="en-US")
                page=context.new_page()
                try:
                    response=page.goto(url,wait_until="networkidle",timeout=20000)
                    # Inspect only after the rendered page settles; no sign-in,
                    # download CTA or provider connection is clicked.
                    metrics=page.evaluate("""() => ({
                      heading: document.querySelector('h1')?.innerText.slice(0,160) || null,
                      documentWidth: document.documentElement.scrollWidth,
                      foregroundLinks: [...document.querySelectorAll('a,button')].map(el => {
                        const box=el.getBoundingClientRect();
                        return {text:(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,60),
                          href:el.getAttribute('href'),y:Math.round(box.y),height:Math.round(box.height),
                          visible:box.width>0 && box.height>0 && box.y>=0 && box.bottom<=innerHeight};
                      }).filter(el=>el.visible && el.text).slice(0,8)
                    })""")
                    image=folder/f"first-fold-{width}.png"
                    page.screenshot(path=str(image),full_page=False)
                    print(json.dumps({"slug":slug,"url":url,"width":width,"height":height,
                        "http":response.status if response else None,"capturedAt":datetime.now(timezone.utc).isoformat(),
                        "image":str(image.relative_to(root)),**metrics},ensure_ascii=False),flush=True)
                except Exception as error:
                    # This capture failure says nothing about app correctness.
                    print(json.dumps({"slug":slug,"url":url,"width":width,"captured":False,
                        "errorType":type(error).__name__},ensure_ascii=False),flush=True)
                finally:context.close()
        browser.close()
