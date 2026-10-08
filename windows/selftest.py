#!/usr/bin/env python3
"""
Windows tray self-test.

Exists because the maintainer develops on macOS, where pystray cannot select its
win32 backend and the ICO path Windows actually consumes is never exercised. CI
runs this on a real Windows runner; it also works on macOS for the parts that
are platform-independent.

    python selftest.py

Exits non-zero with the failing assertion on the first problem.
"""

from __future__ import annotations

import sys

import tokenjuice_tray as t

CASES = {
    "healthy": [95.0],
    "mixed": [45.0, 30.0],
    "three": [8.0, 15.0, 60.0],
    "empty": [0.0],
    "nodata": [None],
    "tiny": [2.0],
}


def group(bars):
    return [{"label": "C", "color": t.CLAUDE_ORANGE, "bars": bars}]


def check_icons() -> None:
    biggest = max(t.ICON_SIZES)
    for name, bars in CASES.items():
        for size in t.ICON_SIZES:
            f = t.render_frame(group(bars), False, size)
            assert f.size == (size, size), f"{name}@{size}: got {f.size}"
        icon = t.render_icon(group(bars))
        assert icon.size == (biggest, biggest), f"{name}: base is {icon.size}"
    err = t.render_icon([], error=True)
    assert err.size == (biggest, biggest), f"error icon: {err.size}"
    print(f"  icons rendered at {t.ICON_SIZES} for {len(CASES)} states + error")


def check_ico() -> None:
    """
    The real pystray path. Windows loads the .ICO with LR_DEFAULTSIZE and picks a
    frame by DPI (100%=16, 125%=20, 150%=24), so a single-frame ICO gets upscaled
    and looks blurry on the 125%/150% laptops most people have.
    """
    from PIL import Image
    from pystray._util import serialized_image

    with serialized_image(t.render_icon(group([45.0])), "ICO") as path:
        sizes = sorted(Image.open(path).info["sizes"])
    assert (16, 16) in sizes, f"no 16px frame: {sizes}"
    assert len(sizes) > 1, f"single frame, Windows would upscale: {sizes}"
    print(f"  ICO frames: {sizes}")


def check_degenerate() -> None:
    """Missing or partial engine output must degrade, never crash the tray."""
    payloads = [
        {},
        {"claude": []},
        {"claude": [{"account": "X", "items": [], "reason": "login"}]},
        {"claude": [{"account": "X", "items": [], "reason": "needs-api"}]},
        {"claude": [{"account": "X", "items": [{"name": "5-hour", "used": 25}], "state": "rate_limited"}]},
        {"codex": [{"name": "Weekly", "used": 25}], "codexStatus": {"state": "stale"}},
        {"sessions": [{"pct": 99, "mtime": 0, "name": "n", "used": 1, "win": 2}]},
    ]
    for p in payloads:
        g = t.build_groups(p)
        t.render_icon(g)
        t.render_icon(g, error=True)
        t.build_tooltip(g, None)
    for reason in ("needs-api", "login", "rate-limit", None, "unrecognised"):
        assert t.explain_no_limits(reason), f"no explanation for {reason!r}"
    assert t.explain_no_limits(None, "auth_expired"), "no explanation for auth_expired"
    assert t.explain_no_limits(None, "rate_limited"), "no explanation for rate_limited"
    assert t.state_display_label("stale") == "업데이트 필요"
    assert t.state_display_label("auth_expired") == "다시 연결 필요"
    assert "다시 로그인" in t.state_recovery_hint("auth_expired")
    stale = t.build_groups({"claude": [{"items": [{"used": 25}], "state": "rate_limited"}]})
    assert stale[0]["bars"] == [None], f"stale Claude value rendered as live: {stale}"
    stale_codex = t.build_groups({"codex": [{"used": 25}], "codexStatus": {"state": "stale"}})
    assert not any(g["label"] == "X" for g in stale_codex), f"stale Codex value rendered as live: {stale_codex}"
    print(f"  {len(payloads)} degenerate payloads OK")


def check_tooltip() -> None:
    # Windows truncates tray tooltips at 127 chars.
    many = [{"label": c, "color": 1, "bars": [88.0, 77.0]} for c in "ABCDEFGHIJ"]
    tip = t.build_tooltip(many, None)
    assert len(tip) <= 127, f"tooltip {len(tip)} > 127"
    # An all-blank group would read as a fault; the menu carries the reason.
    assert t.build_tooltip(group([None]), None) == t.APP_NAME
    print(f"  tooltip {len(tip)} chars (limit 127), blank groups omitted")


def check_cost_menu() -> None:
    """A monetary Copilot report must never become a quota-looking battery."""
    app = t.TrayApp()
    app.data = {
        "claude": [], "sessions": [], "codex": [],
        "copilot": {"enabled": True, "state": "fresh", "amountUsd": 12.5, "budgetUsd": 20, "usedPct": 62.5},
    }
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert any("monthly spend, not quota" in label for label in labels), labels
    assert any("voluntary budget" in label for label in labels), labels
    app.data["copilot"] = {"enabled": True, "state": "unavailable"}
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert any("usage unavailable" in label for label in labels), labels
    print("  Copilot cost menu states OK")


def check_local_provider_menu() -> None:
    """A configured local adapter is explicit and never masquerades as live when stale."""
    app = t.TrayApp()
    app.data = {
        "claude": [], "sessions": [], "codex": [],
        "providers": [{"id": "cursor", "label": "Cursor", "state": "fresh", "items": [{"name": "Monthly", "used": 42}]}],
    }
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert any("Cursor — local quota file" in label for label in labels), labels
    assert any("58% left" in label for label in labels), labels
    assert any("no token, cookie, command, or network access" in label for label in labels), labels
    app.data["providers"][0]["state"] = "stale"
    labels = [item.text for item in app._menu_items() if hasattr(item, "text")]
    assert any("업데이트 필요 · 실시간 숫자 없음" in label for label in labels), labels
    print("  local provider menu states OK")


def main() -> int:
    print(f"tokenjuice self-test on {sys.platform}")
    for fn in (check_icons, check_ico, check_degenerate, check_tooltip, check_cost_menu, check_local_provider_menu):
        print(f"- {fn.__name__}")
        fn()
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
