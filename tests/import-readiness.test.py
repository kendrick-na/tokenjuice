"""Synthetic import while the main module is deliberately delayed."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright, expect

with TemporaryDirectory() as directory, sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    pending = []
    page.route("**/app.js", lambda route: pending.append(route))
    page.goto("http://127.0.0.1:4173/", wait_until="commit")
    file = page.locator("#snapshot-file")
    file.wait_for(state="attached")
    # The input must not accept a selection before its change listener exists.
    expect(file).to_be_disabled()
    page.wait_for_function("document.readyState !== 'uninitialized'")
    assert pending, "the app module must still be held by this test"
    pending[0].continue_()
    page.wait_for_load_state("networkidle")
    expect(file).to_be_enabled()
    source = Path(directory) / "snapshot.json"
    source.write_text(json.dumps({"contractVersion":1,"generatedAt":1791390000000,
        "transport":"local_export_only","claude":[{"account":"Synthetic ready", "state":"fresh",
        "source":"fixture","items":[{"name":"5-hour","used":35}]}],
        "codex":{"state":"unavailable","items":[]}}),encoding="utf-8")
    file.set_input_files(str(source))
    expect(page.get_by_text("Synthetic ready",exact=True)).to_be_visible()
    browser.close()
print("PASS: delayed app module keeps import disabled until the handler is ready")
