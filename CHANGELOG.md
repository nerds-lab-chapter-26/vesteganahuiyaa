# Changelog

## [Unreleased]

## [0.2.1] - 2026-09-10

### Fixed

- Deadline reminder always showed "1h" for the time left, even on a short mission where all lead-time thresholds (60/30/10 min) crossed at once. Now shows the mission's actual remaining time.

## [0.2.0] - 2026-09-10

### Added

- Overdue alert: a system sound plus a notification (with a **Complete Mission** button) the moment an active mission's deadline passes. Fires exactly once per mission and also checks on startup.
- Break reminders: a system sound plus a notification (**Take a Break** / **Snooze 5 min**) once continuous focused time crosses the mission's break threshold (3 hours by default). Going idle, pausing, or acting on the reminder resets the continuous-focus counter.
- Animated mascot popups: mission complete (confetti + bounce), break reminder (wiggle), and overdue alert (shake) now show an animated Webview popup with the mascot instead of a plain notification toast.
- Deadline reminders: a nudge (wiggle popup + sound) at 60/30/10 minutes before an active mission's deadline, in case the work is already done but "Complete Mission" was never run. Fires once per lead-time threshold, per mission.
- Overdue alert now plays a bundled custom alert sound instead of the OS's default system sound.
- Mission-complete popup text is now randomized and (hopefully) funnier/more rewarding instead of a single static line.

### Fixed

- Status bar's "today" time was reading the last focus session's mission id instead of the currently active mission's id, so it could show a previous (completed) mission's focused time after starting a new one. Now shows two numbers: focused time on the active mission today, and focused time across all missions today.

## [0.1.0]

### Added

- Extension scaffold (TypeScript + esbuild).
- `Vesteganahuiyaa: Create Mission` with name and future-deadline validation.
- Local persistence of the active mission via `globalState`; restored after restart.
- Status bar item showing mission name and time remaining, with overdue highlighting.
- `Vesteganahuiyaa: Complete Mission`, `Vesteganahuiyaa: Open Dashboard` (placeholder), `Vesteganahuiyaa: Reset Local Data`.
- Focus timer: `Start/Pause/End Focus Session` commands, activity tracker (text edits, editor/selection changes, scrolling, terminal signals, window focus), 5-minute idle auto-pause, per-day and per-mission focus totals persisted via `globalState`.
- Status bar now shows today's focused minutes and a running/idle/paused indicator.
- Interrupted sessions (extension host crash/kill) are recovered as paused on next activation instead of silently losing or guessing at elapsed time.
