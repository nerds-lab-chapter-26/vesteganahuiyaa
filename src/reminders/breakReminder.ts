import * as vscode from 'vscode';
import { FocusTimer } from '../focus/focusTimer';
import { MissionService } from '../mission/missionService';
import { playBreakReminderSound } from './soundPlayer';
import { showAnimatedPopup } from '../ui/animatedPopup';

/**
 * §7.4 break reminders, minimal version: once continuous focused time
 * crosses the mission's `breakThresholdMinutes`, nudge the user once —
 * sound + notification with "Take a Break" / "Snooze". No repeat nagging
 * until the user acts, snoozes, or naturally goes idle (mirrors the
 * overdue-alert once-only discipline in `deadlineAlert.ts`).
 */
export function registerBreakReminder(
  focusTimer: FocusTimer,
  missionService: MissionService
): vscode.Disposable {
  return focusTimer.onBreakDue(() => {
    void showBreakPrompt(focusTimer, missionService);
  });
}

async function showBreakPrompt(focusTimer: FocusTimer, missionService: MissionService): Promise<void> {
  playBreakReminderSound();

  const mission = missionService.getActiveMission();
  const label = mission ? `"${mission.name}"` : 'this mission';
  const choice = await showAnimatedPopup({
    kind: 'wiggle',
    title: 'Break time?',
    message: `🧘 You've been heads-down on ${label} for a while. Time for a quick break?`,
    buttons: [
      { id: 'break', label: 'Take a Break' },
      { id: 'snooze', label: 'Snooze 5 min' },
    ],
  });

  if (choice === 'break') {
    await focusTimer.takeBreak();
  } else if (choice === 'snooze') {
    await focusTimer.snoozeBreak();
  }
}
