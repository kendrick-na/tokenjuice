# tokenjuice — Windows tray

Claude Code / Codex usage batteries in the Windows system tray.

Explicit local Codex profiles can be configured with `codexAccounts` and
`codexSelectedAccount` in the shared engine config; see the main README for
the schema. The menu shows each profile's alias/state and lets you choose the
profile used by the X icon and Pocket export. This changes display selection
only, never Codex login or credentials. Invalid profile configuration/selection
does not silently fall back to another account. Real account-to-root mapping
and physical Windows UI acceptance still require manual verification.

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

**Do not reimplement the usage calculations here.** That is why bun is a
requirement instead of this app reading `~/.claude` itself in Python, which would
drop the dependency and make the exe ~8x smaller. It was considered and
rejected: two copies of "how much Claude do I have left" means one of them
eventually goes stale, and a stale copy shows a *wrong number* — a user who
believes they have 20% left and gets cut off was lied to by the battery. A
smaller download is not worth that.

The engine is the single source of truth; this file owns pixels and nothing else.
Bundling bun into the exe would also work but costs 94MB (the Bun runtime is
~94MB on its own, and `--minify` does not change that), which is worse than
asking for a one-line install.

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

### Login recovery

If the tray reports an expired Claude login, sign in again in Claude Code yourself.
The Windows tray does not automatically renew login, including when the shared
config contains `autoRenew:true`; that execution path is macOS-only. Its recovery
text is an instruction, not a button that runs the CLI or changes credentials.
Old successful values remain labelled as historical, never live after auth failure.

```powershell
python tokenjuice_tray.py --once            # one reading, as text
python tokenjuice_tray.py --once --topics   # include prompt topics
bun ..\claude-codex-battery.5s.js --json    # raw engine output
```

If `--once` works but the tray icon never appears, the icon is almost certainly
hidden: click the **^** arrow by the clock and drag tokenjuice to the taskbar.
