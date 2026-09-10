# Vesteganahuiyaa

<p align="center">
  <img src="assets/icon.png" alt="Vesteganahuiyaa mascot" width="160" />
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=nerdslab.vesteganahuiyaa">
    <img src="https://img.shields.io/visual-studio-marketplace/v/nerdslab.vesteganahuiyaa?label=VS%20Code%20Marketplace&color=blue" alt="VS Code Marketplace version" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=nerdslab.vesteganahuiyaa">
    <img src="https://img.shields.io/visual-studio-marketplace/i/nerdslab.vesteganahuiyaa?label=installs" alt="Installs" />
  </a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
</p>

Accountability and healthy-focus companion for VS Code. Set one mission, watch its deadline, and get called out (nicely) if you drift.

**[Install from the VS Code Marketplace →](https://marketplace.visualstudio.com/items?itemName=nerdslab.vesteganahuiyaa)**

## Status

Milestones 1–2 done — mission tracking plus real focus-time tracking:

- `Vesteganahuiyaa: Create Mission` — asks for a mission name and a future deadline.
- Active mission is shown in the status bar (name, time remaining, today's focused minutes **on this mission** plus today's total **across all missions**) and survives closing/reopening VS Code.
- `Vesteganahuiyaa: Start Focus Session` — starts (or resumes, if paused) tracking for the active mission.
- `Vesteganahuiyaa: Pause Focus Session` / `Vesteganahuiyaa: End Focus Session`.
- Focus time only accumulates while you're active in the editor (typing, navigating, scrolling, switching terminals). After 5 minutes with no supported activity signal, counting pauses automatically; it resumes the moment activity returns.
- `Vesteganahuiyaa: Complete Mission` — stops any running session, marks the mission done, records whether it was on time.
- `Vesteganahuiyaa: Open Dashboard` — placeholder until the full webview dashboard lands.
- `Vesteganahuiyaa: Reset Local Data` — wipes local mission data (confirmation required).

- Deadline reminders — a heads-up nudge (softer sound + wiggle mascot popup) at 60/30/10 minutes before the deadline, in case you actually finished but forgot to run "Complete Mission". Each lead time fires once per mission.
- Overdue alert — the moment an active mission's deadline passes, you get a custom alert sound plus an animated mascot popup (shake) with a **Complete Mission** button. Fires exactly once per mission (a restart won't re-trigger it), and also checks on VS Code startup in case the deadline passed while it was closed.
- Break reminders — once you've focused continuously for a mission's break threshold (3 hours by default), you get a softer sound plus an animated mascot popup (wiggle) with **Take a Break** (pauses the session) or **Snooze 5 min**. Going idle for 5+ minutes counts as a natural break and resets the counter too, so it won't double-nag.
- Mission complete gets its own celebration — a confetti + bounce mascot popup with a randomized, hopefully-funny congrats message instead of a plain toast.

No full dashboard webview yet — see `PRD.md` for the full spec and milestone order.

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
