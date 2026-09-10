import * as vscode from 'vscode';
import { MissionService } from '../mission/missionService';
import { isOverdue } from '../mission/missionTypes';
import { playOverdueAlertSound } from './soundPlayer';
import { showAnimatedPopup } from '../ui/animatedPopup';

/**
 * §7.5 "Overdue" urgency level, minimal version: fires the alert sound +
 * a notification exactly once, the moment a mission first crosses its
 * deadline while still active. Uses `overdueAlertedAt` (persisted on the
 * mission) as the once-only guard — a restart won't re-fire it, and a
 * fresh mission always starts unalerted (FR-04's "no duplicate" discipline
 * applied to deadlines instead of break reminders).
 */
export async function checkOverdueAlert(missionService: MissionService): Promise<void> {
  const mission = missionService.getActiveMission();
  if (!mission || mission.overdueAlertedAt || !isOverdue(mission)) return;

  await missionService.markOverdueAlerted(mission.id);
  playOverdueAlertSound();

  const choice = await showAnimatedPopup({
    kind: 'shake',
    title: 'Overdue!',
    message: `⏰ "${mission.name}" is overdue. No more excuses — wrap it up or push the deadline.`,
    buttons: [{ id: 'complete', label: 'Complete Mission' }],
  });
  if (choice === 'complete') {
    await vscode.commands.executeCommand('nerdslab.completeMission');
  }
}
