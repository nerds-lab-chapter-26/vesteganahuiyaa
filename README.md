# Vesteganahuiyaa

<p align="center">
  <img src="assets/icon.png" alt="Vesteganahuiyaa mascot" width="160" />
</p>

Accountability and healthy-focus companion for VS Code. Set one mission, watch its deadline, and get called out (nicely) if you drift.

## Status

Milestones 1–2 done — mission tracking plus real focus-time tracking:

- `Vesteganahuiyaa: Create Mission` — asks for a mission name and a future deadline.
- Active mission is shown in the status bar (name, time remaining, today's focused minutes) and survives closing/reopening VS Code.
- `Vesteganahuiyaa: Start Focus Session` — starts (or resumes, if paused) tracking for the active mission.
- `Vesteganahuiyaa: Pause Focus Session` / `Vesteganahuiyaa: End Focus Session`.
- Focus time only accumulates while you're active in the editor (typing, navigating, scrolling, switching terminals). After 5 minutes with no supported activity signal, counting pauses automatically; it resumes the moment activity returns.
- `Vesteganahuiyaa: Complete Mission` — stops any running session, marks the mission done, records whether it was on time.
- `Vesteganahuiyaa: Open Dashboard` — placeholder until the full webview dashboard lands.
- `Vesteganahuiyaa: Reset Local Data` — wipes local mission data (confirmation required).

No break reminders or dashboard UI yet — see `PRD.md` for the full spec and milestone order.

### What counts as "activity"

Text edits, active-editor switches, text selection, scrolling, terminal open/switch/command runs (where VS Code exposes that), and regaining window focus. There's no VS Code API to see raw terminal keystrokes, so a long unattended interactive terminal session (an SSH shell, a REPL with no further commands) will still read as idle after 5 minutes — a known MVP limitation, not a bug.

## Data & privacy

Everything is stored locally via VS Code's `globalState`. Nothing leaves your machine — no accounts, no network calls, no telemetry.

## Development

```bash
npm install
npm run compile   # or: npm run watch
```

Then press `F5` in VS Code to launch an Extension Development Host.

## Package

```bash
npm run package   # produces a .vsix via vsce
```
