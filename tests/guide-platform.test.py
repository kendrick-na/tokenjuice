"""Synthetic platform hints; never install, download, sign in or submit."""
import json
from playwright.sync_api import sync_playwright, expect

IPHONE="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(user_agent=IPHONE,viewport={"width":375,"height":812},is_mobile=True)
    page=context.new_page()
    page.goto("http://127.0.0.1:4173/guide.html",wait_until="networkidle")
    expect(page.locator("#platform-guidance")).to_contain_text("모바일")
    expect(page.locator('[data-install-platform="mac"]')).to_be_hidden()
    expect(page.locator('[data-install-platform="windows"]')).to_be_hidden()
    requests=[];context.on("request",lambda r:requests.append(r))
    page.locator('[data-platform-choice="windows"]').click()
    expect(page.locator('[data-install-platform="windows"]')).to_be_visible()
    expect(page.locator('[data-install-platform="mac"]')).to_be_hidden()
    expect(page.locator('[data-platform-choice="windows"]')).to_have_attribute("aria-pressed","true")
    expect(page.locator("#platform-guidance")).to_contain_text("직접 선택")
    assert page.locator('[data-download-platform="windows"]').get_attribute("href")=="https://github.com/kendrick-na/tokenjuice/releases/download/v1.2.2/tokenjuice.exe"
    page.locator('[data-platform-choice="mac"]').focus()
    page.keyboard.press("Enter")
    expect(page.locator('[data-install-platform="mac"]')).to_be_visible()
    expect(page.locator('[data-install-platform="windows"]')).to_be_hidden()
    assert not requests
    context.close()
    for ua,platform,touch,expected in [
        ("Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)","MacIntel",0,"mac"),
        ("Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)","MacIntel",2,"mobile"),
        ("Mozilla/5.0 (Windows NT 10.0; Win64; x64)","Win32",0,"windows"),
        ("Mozilla/5.0 (Linux; Android 15)","Linux",5,"mobile"),
        ("Mozilla/5.0 (X11; Linux x86_64)","Linux",0,"other")]:
        context=browser.new_context(user_agent=ua,viewport={"width":375,"height":812})
        context.add_init_script(f"""Object.defineProperty(navigator,'platform',{{value:{json.dumps(platform)}}});
          Object.defineProperty(navigator,'userAgentData',{{value:{{platform:{json.dumps(platform)}}}}});
          Object.defineProperty(navigator,'maxTouchPoints',{{value:{touch}}});""")
        page=context.new_page()
        page.goto("http://127.0.0.1:4173/guide.html",wait_until="networkidle")
        expect(page.locator(f'[data-platform-choice="{expected}"]')).to_have_attribute("aria-pressed","true")
        assert page.locator('[data-install-platform="mac"]').is_visible()==(expected in ["mac","other"])
        assert page.locator('[data-install-platform="windows"]').is_visible()==(expected in ["windows","other"])
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        assert page.locator('[data-platform-choice="mac"]').bounding_box()["height"]>=44
        context.close()
    context=browser.new_context(viewport={"width":1280,"height":900})
    page=context.new_page()
    requests=[];context.on("request",lambda r:requests.append(r))
    page.goto("http://127.0.0.1:4173",wait_until="networkidle")
    expect(page.locator("#install-entry")).to_be_visible()
    expect(page.locator("#welcome-preview")).to_contain_text("예시 · 실제 데이터 아님")
    assert page.locator("#install-entry").bounding_box()["height"]>=44
    bounds=page.locator("#welcome-preview").bounding_box()
    assert bounds["y"]+bounds["height"]<=900
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    assert not [r for r in requests if r.url.startswith("http") and not r.url.startswith("http://127.0.0.1:4173")]
    assert not page.evaluate("localStorage.length")
    page.screenshot(path="/tmp/tokenjuice-welcome-desktop.png",full_page=False)
    page.set_viewport_size({"width":375,"height":812})
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    page.screenshot(path="/tmp/tokenjuice-welcome-mobile.png",full_page=False)
    page.locator("#install-entry").click()
    expect(page).to_have_url("http://127.0.0.1:4173/guide.html")
    page.locator('[data-platform-choice="mobile"]').click()
    page.screenshot(path="/tmp/tokenjuice-guide-mobile.png",full_page=True)
    context.close()
    browser.close()
print("PASS: mobile-before-Mac/iPad touch hints, manual keyboard platform selection, fixed downloads, first-fold install/explicit demo and no automatic install or collection")
