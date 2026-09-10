import * as vscode from 'vscode';
import { MissionService } from '../mission/missionService';
import { isOverdue } from '../mission/missionTypes';
import { FocusTimer } from '../focus/focusTimer';

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

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)}m`;
}

/**
 * §7.2 — status bar is the always-visible surface: mission name, time
 * remaining, and today's focused time (`$(clock) Build auth | 2d left | 47m today`).
 */
export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(
    private missionService: MissionService,
    private focusTimer: FocusTimer
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    missionService.onDidChange(() => this.refresh());
    focusTimer.onDidChange(() => this.refresh());
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

    const { session, isIdle, todayFocusedSeconds } = this.focusTimer.getStatus();
    const overdue = isOverdue(mission);

    let sessionBadge = '';
    if (session?.state === 'running') {
      sessionBadge = isIdle ? ' $(debug-pause)' : ' $(record)';
    } else if (session?.state === 'paused') {
      sessionBadge = ' $(debug-pause)';
    }

    this.item.text =
      `$(clock) ${mission.name} | ${formatTimeRemaining(mission.deadline)} | ` +
      `${formatMinutes(todayFocusedSeconds)} today${sessionBadge}`;

    const tooltipLines = [`Deadline: ${new Date(mission.deadline).toLocaleString()}`];
    if (session?.state === 'running') {
      tooltipLines.push(isIdle ? 'Focus session running (idle — not counting)' : 'Focus session running');
    } else if (session?.state === 'paused') {
      tooltipLines.push('Focus session paused');
    } else {
      tooltipLines.push('No focus session — run "NerdsLab: Start Focus Session"');
    }
    this.item.tooltip = tooltipLines.join('\n');
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
