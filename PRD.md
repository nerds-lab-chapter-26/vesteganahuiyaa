# KalSeNahi — Product Requirements Document

**Product type:** Visual Studio Code Extension  
**Document status:** MVP specification  
**Version:** 1.0  
**Author:** Maryam Saba  

## 1. Product Summary

KalSeNahi is an accountability and healthy-focus extension for Visual Studio Code. It helps developers convert intentions into deadline-based tasks, measure actual active coding time, receive increasingly urgent reminders, and take healthy breaks after long work sessions.

The extension is designed for developers who repeatedly create plans but struggle to start, stay consistent, or finish before a deadline. Its personality is supportive, strict, and funny rather than corporate or judgmental.

## 2. Problem Statement

Developers often write schedules outside their development environment, then forget or ignore them while working. Ordinary to-do applications know that a task exists, but they do not understand whether the user is actively coding, idle, or approaching burnout.

The product must solve two connected problems:

1. **Lack of accountability:** A developer decides to complete something but receives no contextual pressure as the deadline approaches.
2. **Unhealthy work sessions:** A developer may code continuously for several hours without taking a meaningful break.

## 3. Product Goal

Help a developer select one meaningful task, work on it consistently, finish it before its deadline, and avoid unhealthy continuous coding sessions.

## 4. Success Criteria

The MVP is successful when a user can:

- Create a task with a title and deadline inside VS Code.
- See the active task and remaining time without opening another application.
- Start and stop a focus session.
- Have only active work counted toward focused time.
- Receive a break reminder after reaching the configured continuous-work limit.
- Mark the task complete and see its final progress.
- Close and reopen VS Code without losing task or session data.

## 5. Target Users

### Primary user

A student, junior developer, freelancer, or job seeker who spends significant time in VS Code but struggles with procrastination and self-created deadlines.

### User characteristics

- Uses VS Code as the main development environment.
- Works independently without a manager checking daily progress.
- Needs direct, visible reminders.
- Appreciates humorous language.
- Wants accountability without complicated project-management software.

## 6. Core User Story

> As a developer who struggles to follow personal schedules, I want VS Code to remember my current task, deadline, and focused working time so that I feel accountable and finish the task without overworking continuously.

## 7. MVP Scope

The first release will support **one active task at a time**. This constraint is intentional.

### 7.1 Task creation

The extension must ask for:

- Task title — required, 3–120 characters.
- Deadline date and time — required and must be in the future.
- Daily focus target — optional; default 120 minutes.
- Break threshold — optional; default 180 minutes.

The task can be created from the Command Palette using:

`KalSeNahi: Create Task`

### 7.2 Task display

After creation, the VS Code status bar must show:

- Short task title.
- Days or hours remaining.
- Focused time recorded today.

Example:

`$(clock) Build auth | 2d left | 47m today`

Clicking the status-bar item must open the extension dashboard.

### 7.3 Focus session

The user must explicitly start a focus session using either the dashboard or:

`KalSeNahi: Start Focus Session`

While a session is active, the extension must:

- Count time only while the user is considered active.
- Pause counting after 5 minutes without supported editor activity.
- Resume counting when activity returns.
- Persist accumulated time at least once per minute.
- Prevent more than one simultaneous session.

Supported activity signals for the MVP:

- Text document changes.
- Active editor changes.
- Text editor selection changes.
- Execution of extension-observable VS Code commands.
- Integrated terminal state changes where available.

The extension must not record typed text, source code, terminal content, filenames, or clipboard contents.

### 7.4 Break reminder

When continuous active time reaches the break threshold, the extension must display a break experience.

The reminder must include:

- A funny message.
- A lightweight animation in a VS Code webview.
- `Take 10-minute break` action.
- `Remind me in 5 minutes` action.
- `End focus session` action.

Example messages:

- “Your spine has left the chat.”
- “Laptop ko nahi, khud ko bhi charge kar lo.”
- “Three hours. Even your bugs need space.”
- “Hydration is not a framework, but install it anyway.”

If the user chooses a 10-minute break, active time must pause and a break countdown must begin. When the countdown ends, the extension should notify the user that work may resume.

### 7.5 Deadline urgency

The dashboard and notifications must use four urgency levels:

| Level | Condition | Behaviour |
| --- | --- | --- |
| Normal | More than 3 days remain | Calm reminder |
| Attention | 1–3 days remain | Stronger wording and amber state |
| Urgent | Less than 24 hours remain | Urgent wording and red state |
| Overdue | Deadline has passed | Overdue state and completion/reschedule actions |

The MVP will show these reminders inside VS Code. Email reminders belong to Phase 2 because emails must work even when VS Code is closed.

### 7.6 Task completion

The user must be able to mark the active task complete. The extension must store:

- Completion timestamp.
- Total focused minutes.
- Whether completion occurred before or after the deadline.

After completion, the user may create a new active task.

### 7.7 Dashboard

The MVP dashboard will be a VS Code webview containing:

- Active task title.
- Deadline and time remaining.
- Today’s focus time.
- Total task focus time.
- Current focus-session state.
- Start, pause, resume, and end controls.
- Complete and reschedule actions.

## 8. Required Commands

The extension must register these commands:

- `KalSeNahi: Create Task`
- `KalSeNahi: Open Dashboard`
- `KalSeNahi: Start Focus Session`
- `KalSeNahi: Pause Focus Session`
- `KalSeNahi: End Focus Session`
- `KalSeNahi: Complete Task`
- `KalSeNahi: Reschedule Task`
- `KalSeNahi: Reset Local Data`

The reset command must require explicit confirmation.

## 9. Data Model

```ts
type TaskStatus = "active" | "completed" | "overdue";

interface Task {
  id: string;
  title: string;
  createdAt: string;
  deadline: string;
  completedAt?: string;
  status: TaskStatus;
  dailyTargetMinutes: number;
  breakThresholdMinutes: number;
  totalFocusedSeconds: number;
}

interface FocusSession {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt?: string;
  focusedSeconds: number;
  idleSeconds: number;
  state: "running" | "paused" | "completed";
}

interface DailyFocusSummary {
  date: string;
  taskId: string;
  focusedSeconds: number;
  sessionCount: number;
}
```

All MVP data must be stored locally using VS Code `globalState`. Secrets must never be stored in the task model.

## 10. Functional Requirements

### FR-01 — Create task

The system must reject empty titles and past deadlines. A second active task cannot be created until the current task is completed, rescheduled, or archived.

### FR-02 — Restore state

The system must restore the active task, accumulated focus time, and status-bar display after VS Code restarts.

### FR-03 — Track active time

The system must separate elapsed session time from focused time and must not count idle periods as focused work.

### FR-04 — Trigger break

The system must show only one break reminder when the threshold is reached. Snoozing must not create duplicate timers.

### FR-05 — Update deadline state

The system must recalculate deadline urgency on activation and at least every 15 minutes while VS Code remains open.

### FR-06 — Complete task

The system must stop any running session before completing a task.

### FR-07 — Protect privacy

The system must not transmit user activity or project information in the MVP.

## 11. Non-Functional Requirements

- **Performance:** Background tracking must have negligible effect on editor responsiveness.
- **Reliability:** Timers must recover sensibly after extension-host restart.
- **Privacy:** No source-code or keystroke content may be collected.
- **Accessibility:** Controls must be keyboard accessible and readable in light and dark themes.
- **Compatibility:** Initial target is the current stable VS Code desktop release on Windows, macOS, and Linux.
- **Maintainability:** Timer, storage, task, notification, and webview responsibilities must remain separate modules.

## 12. Suggested Technical Architecture

```text
src/
├── extension.ts
├── commands/
│   └── registerCommands.ts
├── task/
│   ├── taskService.ts
│   └── taskTypes.ts
├── focus/
│   ├── activityTracker.ts
│   ├── focusTimer.ts
│   └── idleDetector.ts
├── reminders/
│   ├── breakReminder.ts
│   └── deadlineReminder.ts
├── storage/
│   └── localStore.ts
├── statusBar/
│   └── statusBarController.ts
└── webview/
    ├── dashboardPanel.ts
    └── breakPanel.ts
```

Recommended MVP stack:

- TypeScript
- VS Code Extension API
- esbuild for bundling
- Vitest or Mocha for unit tests
- Plain HTML/CSS/JavaScript for the first webview

React is not required for the first dashboard. It may be introduced only if the webview becomes complex enough to justify it.

## 13. Email Reminder — Phase 2

Email cannot depend only on the extension because VS Code may be closed when a reminder becomes due. Phase 2 therefore requires a remote scheduler.

Suggested flow:

```text
Extension → authenticated API → task database → scheduled job → email provider
```

Suggested services:

- Supabase Auth and PostgreSQL for account/task sync.
- Supabase scheduled Edge Function or another cron-capable backend.
- Resend or SendGrid for email delivery.

Phase 2 email rules:

- User must explicitly opt in and verify the email address.
- User must select a timezone.
- Reminder frequency must be configurable.
- Every email must include an unsubscribe/disable-reminders action.
- API keys must remain on the backend, never inside the published extension.
- Do not send an email every day merely saying that time passed; include task name, time remaining, and an actionable next step.

Example schedule:

| Remaining time | Email behaviour |
| --- | --- |
| More than 7 days | No default email |
| 7 days | First reminder |
| 3 days | Progress warning |
| 1 day | Urgent reminder |
| Overdue | One overdue email, then stop unless user opts into repeats |

## 14. Out of Scope for MVP

The following must not be built in Version 1:

- Authentication or cloud sync.
- Email delivery.
- AI-generated task planning.
- GitHub commit analysis.
- Team collaboration or accountability partners.
- Multiple simultaneous tasks.
- Cross-device dashboards.
- Productivity scoring based on lines of code.
- Marketplace payments or premium plans.

## 15. Edge Cases

- VS Code closes during a running session.
- The extension host restarts unexpectedly.
- The system clock or timezone changes.
- The task deadline passes while VS Code is closed.
- The user remains idle longer than the break threshold.
- The user snoozes repeatedly.
- The user starts a focus session without an active task.
- The task is completed while its timer is running.
- Multiple VS Code windows use the same extension state.

For the MVP, only one window should own an active focus session. If a conflict is detected, the newer window must warn the user rather than silently double-counting time.

## 16. Acceptance Criteria

The MVP is ready only when all conditions below pass:

- [ ] A valid task can be created from the Command Palette.
- [ ] An invalid title or past deadline is rejected with a clear message.
- [ ] The active task appears in the status bar.
- [ ] A focus session can be started, paused, resumed, and ended.
- [ ] Five minutes of inactivity pauses focused-time accumulation.
- [ ] Returning activity resumes focused-time accumulation.
- [ ] A break reminder appears at the configured threshold.
- [ ] Snoozing creates no duplicate reminder.
- [ ] Completing a task stops the active timer.
- [ ] Task and time data survive a VS Code restart.
- [ ] No source text, terminal content, or filenames are persisted.
- [ ] The webview works in both light and dark VS Code themes.
- [ ] Timer and storage logic have automated tests.
- [ ] The extension can be packaged into a `.vsix` file.

## 17. Development Milestones

### Milestone 1 — Extension foundation

- Scaffold TypeScript extension.
- Register commands.
- Add typed storage wrapper.
- Create and restore one task.

**Done when:** A task survives a VS Code restart.

### Milestone 2 — Focus tracking

- Implement session state machine.
- Track supported activity signals.
- Implement five-minute idle rule.
- Persist daily and total focus time.

**Done when:** A controlled manual test correctly separates active and idle time.

### Milestone 3 — Accountability interface

- Add status-bar item.
- Add deadline urgency calculation.
- Build minimal dashboard.
- Add completion and rescheduling.

**Done when:** The complete task lifecycle works without editing stored data manually.

### Milestone 4 — Healthy-break experience

- Add threshold calculation.
- Build animated break webview.
- Add break, snooze, and end-session actions.
- Prevent duplicate reminders.

**Done when:** A shortened test threshold reliably triggers exactly one reminder.

### Milestone 5 — Quality and release

- Add unit tests.
- Test restart and clock-related edge cases.
- Add extension icon, README, changelog, and privacy statement.
- Package `.vsix` and perform a clean local installation.

**Done when:** All MVP acceptance criteria pass.

## 18. Testing Strategy

Unit-test these independently:

- Deadline urgency calculation.
- Daily progress calculation.
- Idle/active state transitions.
- Focus timer accumulation.
- Break threshold and snooze behaviour.
- Storage serialization and migration.

Manual integration tests must include:

- Reloading the VS Code window during a session.
- Closing and reopening VS Code.
- Temporarily setting idle and break thresholds to seconds.
- Opening multiple VS Code windows.
- Switching between light and dark themes.

## 19. Privacy Statement for MVP

KalSeNahi stores task details and focus summaries locally in VS Code. It does not read or upload source-code contents, terminal text, clipboard data, or keystrokes. The MVP does not send analytics or user data to any remote server.

## 20. Release Definition

Version `0.1.0` is a private/local MVP. It should first be installed through a `.vsix` package and used for at least seven days before public Marketplace submission.

During the seven-day dogfooding period, record only:

- Missed or duplicate reminders.
- Incorrect focus-time calculations.
- Crashes or lost state.
- Moments where the interface was confusing.

Do not add new features during this period unless they fix a blocker.

## 21. First Implementation Task

The first coding session must complete only this vertical slice:

1. Scaffold the TypeScript VS Code extension.
2. Register `KalSeNahi: Create Task`.
3. Ask for a task title.
4. Ask for a future deadline.
5. Store the task in `globalState`.
6. Restore and display the task after reloading VS Code.

No timer, animation, React dashboard, backend, authentication, or email work should begin until this slice is complete and tested.

