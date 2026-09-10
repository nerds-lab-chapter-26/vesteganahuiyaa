import { MissionService } from '../mission/missionService';
import { DEADLINE_REMINDER_THRESHOLDS_MINUTES, isOverdue } from '../mission/missionTypes';
import { playBreakReminderSound } from './soundPlayer';
import { showAnimatedPopup } from '../ui/animatedPopup';

/**
 * "Don't forget" nudges for an approaching (not yet missed) deadline —
 * separate from `deadlineAlert.ts`'s once-only alert for a deadline that
 * has already passed. Someone may finish the actual work and simply
 * forget to run "Complete Mission"; this catches that case before the
 * deadline turns into an overdue alert.
 *
 * Fires once per lead-time threshold (60/30/10 minutes left) per mission,
 * guarded by `deadlineRemindersFired` the same way `overdueAlertedAt`
 * guards the overdue alert.
 */
export async function checkDeadlineReminder(missionService: MissionService): Promise<void> {
  const mission = missionService.getActiveMission();
  if (!mission || isOverdue(mission)) return;

  const minutesLeft = (new Date(mission.deadline).getTime() - Date.now()) / 60_000;
  const alreadyFired = mission.deadlineRemindersFired ?? [];

  const dueThresholds = DEADLINE_REMINDER_THRESHOLDS_MINUTES.filter(
    (threshold) => minutesLeft <= threshold && !alreadyFired.includes(threshold)
  );
  if (dueThresholds.length === 0) return;

  // If several thresholds are already in the past at once (e.g. VS Code was
  // closed for a while), mark them all fired but only show one popup.
  const loudestThreshold = Math.max(...dueThresholds);
  await missionService.markDeadlineRemindersFired(mission.id, [...alreadyFired, ...dueThresholds]);

  playBreakReminderSound();
  await showAnimatedPopup({
    kind: 'wiggle',
    title: 'Deadline coming up',
    message: `⏳ "${mission.name}" is due in about ${formatThreshold(loudestThreshold)}. Finished already? Don't forget to mark it complete!`,
    buttons: [{ id: 'ok', label: 'Got it' }],
  });
}

function formatThreshold(minutes: number): string {
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${minutes}m`;
}
