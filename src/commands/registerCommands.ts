import * as vscode from 'vscode';
import { MissionService, MissionValidationError } from '../mission/missionService';
import { StatusBarController } from '../statusBar/statusBarController';
import { completedOnTime } from '../mission/missionTypes';

const DEADLINE_FORMAT_HINT = 'YYYY-MM-DD HH:mm (24h, local time), e.g. 2026-09-15 18:00';

function parseDeadline(value: string): Date | undefined {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const [, y, mo, d, h, mi] = match;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function promptForMissionName(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title: 'NerdsLab: Mission name',
    prompt: 'What are you committing to finish?',
    placeHolder: 'e.g. Build auth flow',
    ignoreFocusOut: true,
    validateInput: (value) => {
      const length = value.trim().length;
      if (length < 3) return 'Mission name must be at least 3 characters.';
      if (length > 120) return 'Mission name must be 120 characters or fewer.';
      return undefined;
    },
  });
}

async function promptForDeadline(): Promise<string | undefined> {
  const raw = await vscode.window.showInputBox({
    title: 'NerdsLab: Mission deadline',
    prompt: `When is this due? Format: ${DEADLINE_FORMAT_HINT}`,
    placeHolder: '2026-09-15 18:00',
    ignoreFocusOut: true,
    validateInput: (value) => {
      const parsed = parseDeadline(value);
      if (!parsed) return `Use the format ${DEADLINE_FORMAT_HINT}.`;
      if (parsed.getTime() <= Date.now()) return 'Deadline must be in the future.';
      return undefined;
    },
  });
  if (!raw) return undefined;
  return parseDeadline(raw)?.toISOString();
}

export function registerCommands(
  context: vscode.ExtensionContext,
  missionService: MissionService,
  statusBar: StatusBarController
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('nerdslab.createMission', async () => {
      const active = missionService.getActiveMission();
      if (active) {
        vscode.window.showWarningMessage(
          `Mission "${active.name}" is already active. Complete it first with "NerdsLab: Complete Mission".`
        );
        return;
      }

      const name = await promptForMissionName();
      if (!name) return;

      const deadlineIso = await promptForDeadline();
      if (!deadlineIso) return;

      try {
        const mission = await missionService.createMission(name, deadlineIso);
        statusBar.refresh();
        vscode.window.showInformationMessage(`Mission "${mission.name}" is on. No excuses.`);
      } catch (err) {
        const message = err instanceof MissionValidationError ? err.message : 'Could not create mission.';
        vscode.window.showErrorMessage(message);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nerdslab.completeMission', async () => {
      const mission = await missionService.completeMission();
      if (!mission) {
        vscode.window.showInformationMessage('No active mission to complete.');
        return;
      }
      statusBar.refresh();
      vscode.window.showInformationMessage(
        completedOnTime(mission)
          ? `Mission "${mission.name}" completed on time. Look at you.`
          : `Mission "${mission.name}" completed — late, but done beats undone.`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nerdslab.openDashboard', async () => {
      const mission = missionService.getActiveMission();
      if (!mission) {
        vscode.window.showInformationMessage('No active mission yet. Run "NerdsLab: Create Mission".');
        return;
      }
      // Full webview dashboard (§7.7) lands in Milestone 3.
      vscode.window.showInformationMessage(
        `${mission.name} — deadline ${new Date(mission.deadline).toLocaleString()}`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nerdslab.resetLocalData', async () => {
      const confirmed = await vscode.window.showWarningMessage(
        'This permanently deletes all NerdsLab mission data stored on this machine. Continue?',
        { modal: true },
        'Delete everything'
      );
      if (confirmed !== 'Delete everything') return;

      await missionService.resetAll();
      statusBar.refresh();
      vscode.window.showInformationMessage('NerdsLab local data has been reset.');
    })
  );
}
