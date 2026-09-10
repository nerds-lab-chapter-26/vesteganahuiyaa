import * as vscode from 'vscode';
import { MissionService } from '../mission/missionService';
import { isOverdue } from '../mission/missionTypes';

function formatTimeRemaining(deadlineIso: string, now: Date = new Date()): string {
  const diffMs = new Date(deadlineIso).getTime() - now.getTime();
  if (diffMs <= 0) {
    return 'overdue';
  }
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${Math.max(minutes, 0)}m left`;
}

/**
 * §7.2 — status bar is the always-visible surface: mission name + time
 * remaining. Focused-time-today will be appended once the focus timer
 * (Milestone 2) exists; for this slice it just reflects mission state.
 */
export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(private missionService: MissionService) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    missionService.onDidChange(() => this.refresh());
  }

  refresh(): void {
    const mission = this.missionService.getActiveMission();

    if (!mission) {
      this.item.text = '$(clock) NerdsLab: No active mission';
      this.item.tooltip = 'Click to create a mission';
      this.item.command = 'nerdslab.createMission';
      this.item.backgroundColor = undefined;
      this.item.show();
      return;
    }

    const overdue = isOverdue(mission);
    this.item.text = `$(clock) ${mission.name} | ${formatTimeRemaining(mission.deadline)}`;
    this.item.tooltip = `Deadline: ${new Date(mission.deadline).toLocaleString()}`;
    this.item.command = 'nerdslab.openDashboard';
    this.item.backgroundColor = overdue
      ? new vscode.ThemeColor('statusBarItem.errorBackground')
      : undefined;
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
