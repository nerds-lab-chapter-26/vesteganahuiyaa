# Changelog

## [Unreleased]

### Added

- Extension scaffold (TypeScript + esbuild).
- `Vesteganahuiyaa: Create Mission` with name and future-deadline validation.
- Local persistence of the active mission via `globalState`; restored after restart.
- Status bar item showing mission name and time remaining, with overdue highlighting.
- `Vesteganahuiyaa: Complete Mission`, `Vesteganahuiyaa: Open Dashboard` (placeholder), `Vesteganahuiyaa: Reset Local Data`.
- Focus timer: `Start/Pause/End Focus Session` commands, activity tracker (text edits, editor/selection changes, scrolling, terminal signals, window focus), 5-minute idle auto-pause, per-day and per-mission focus totals persisted via `globalState`.
- Status bar now shows today's focused minutes and a running/idle/paused indicator.
- Interrupted sessions (extension host crash/kill) are recovered as paused on next activation instead of silently losing or guessing at elapsed time.
