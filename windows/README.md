# tokenjuice — Windows tray

Claude Code / Codex usage batteries in the Windows system tray.

```powershell
.\install.ps1
```

Full docs: see the [Windows section](../README.md#windows) in the main README.

## Files

| File | What it is |
|---|---|
| `tokenjuice_tray.py` | The tray app. Renderer only — no usage logic. |
| `install.ps1` | Checks bun/Python, installs deps, registers autostart, launches. |
| `build-exe.ps1` | Builds `dist\tokenjuice.exe` via PyInstaller. |
| `requirements.txt` | `pystray` + `pillow`. |

## Design note

All usage maths live in `../claude-codex-battery.5s.js` — the same engine the
macOS build uses. This app shells out to it with `--json` and draws the result.

That split is deliberate. A second implementation of "how much Claude do I have
left" would drift from the macOS one the first time either changed, and then the
two platforms would quietly disagree. The engine is the single source of truth;
this file owns pixels and nothing else.

Consequences worth knowing:

- **bun is required**, even for the exe. The exe bundles Python, not bun.
- **`claude-codex-battery.5s.js` must sit next to the exe** (or one directory up
  when running from source). See `find_engine()`.
- The engine is spawned every 5s with `CREATE_NO_WINDOW`; without that flag
  Windows flashes a console window on each poll.

## Known risks

Both platforms read Claude Code's local files, and Anthropic documents that
format as unstable:

> "The entry format is internal to Claude Code and changes between versions, so
> scripts that parse these files directly can break on any release."
> — [Claude Code docs, Manage sessions](https://code.claude.com/docs/en/sessions)

Session **context** batteries are the part that depends on it. If the format
changes, sessions are skipped silently and the limit batteries keep working —
verified by feeding the engine a transcript with the usage fields removed. So a
breaking release costs you the `S` batteries, not the whole app.

The `/api/oauth/usage` endpoint used by API mode is likewise undocumented (it is
what Claude Code's own `/status` calls) and is rate-limited per token, which is
why the engine caches responses for 60s and prefers the local cache.

## Debugging

```powershell
python tokenjuice_tray.py --once            # one reading, as text
python tokenjuice_tray.py --once --topics   # include prompt topics
bun ..\claude-codex-battery.5s.js --json    # raw engine output
```

If `--once` works but the tray icon never appears, the icon is almost certainly
hidden: click the **^** arrow by the clock and drag tokenjuice to the taskbar.
