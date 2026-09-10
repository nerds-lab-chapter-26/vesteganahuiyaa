import * as vscode from 'vscode';
import { MissionService, MissionValidationError } from '../mission/missionService';
import { StatusBarController } from '../statusBar/statusBarController';
import { completedOnTime } from '../mission/missionTypes';
import { FocusTimer, FocusTimerError } from '../focus/focusTimer';
import { showAnimatedPopup } from '../ui/animatedPopup';

const DEADLINE_FORMAT_HINT = 'YYYY-MM-DD HH:mm (24h, local time), e.g. 2026-09-15 18:00';

const ON_TIME_MESSAGES = [
  (name: string) => `🏆 "${name}" — done, and on time. Certified legend behavior.`,
  (name: string) => `🎉 "${name}" complete! Look at you, beating the clock like it's nothing.`,
  (name: string) => `⭐ "${name}" is a wrap — early enough to actually relax now. Go treat yourself.`,
  (name: string) => `🥳 Nailed it. "${name}" done before the deadline even noticed.`,
];

const LATE_MESSAGES = [
  (name: string) => `✅ "${name}" is done — a little late, but hey, done beats undone every time.`,
  (name: string) => `🎯 "${name}" complete! Fashionably late, but you still showed up. Respect.`,
  (name: string) => `💪 Finished "${name}". Not on time, but you didn't quit — that counts for a lot.`,
];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

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
  focusTimer: FocusTimer,
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
      const active = missionService.getActiveMission();
      if (!active) {
        vscode.window.showInformationMessage('No active mission to complete.');
        return;
      }

      // FR-06: stop any running session before completing.
      await focusTimer.end();

      const mission = await missionService.completeMission();
      if (!mission) return;
      statusBar.refresh();
      void showAnimatedPopup({
        kind: 'celebrate',
        title: 'Mission complete!',
        message: pickRandom(completedOnTime(mission) ? ON_TIME_MESSAGES : LATE_MESSAGES)(mission.name),
        buttons: [{ id: 'ok', label: 'Nice' }],
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nerdslab.startFocusSession', async () => {
      const mission = missionService.getActiveMission();
      if (!mission) {
        vscode.window.showInformationMessage('No active mission yet. Run "NerdsLab: Create Mission" first.');
        return;
      }
      try {
        await focusTimer.start(mission.id);
        statusBar.refresh();
        vscode.window.showInformationMessage(`Focus session started for "${mission.name}". Go.`);
      } catch (err) {
        const message = err instanceof FocusTimerError ? err.message : 'Could not start focus session.';
        vscode.window.showWarningMessage(message);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nerdslab.pauseFocusSession', async () => {
      const session = await focusTimer.pause();
      statusBar.refresh();
      vscode.window.showInformationMessage(
        session ? 'Focus session paused.' : 'No running focus session to pause.'
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nerdslab.endFocusSession', async () => {
      const session = await focusTimer.end();
      statusBar.refresh();
      vscode.window.showInformationMessage(
        session
          ? `Focus session ended — ${Math.round(session.focusedSeconds / 60)}m focused this session.`
          : 'No focus session to end.'
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
      const { session, todayFocusedSecondsForMission, todayFocusedSecondsOverall } = focusTimer.getStatus();
      const sessionLine = session ? ` | session: ${session.state}` : ' | no session running';
      // Full webview dashboard (§7.7) lands in Milestone 3.
      vscode.window.showInformationMessage(
        `${mission.name} — deadline ${new Date(mission.deadline).toLocaleString()} | ` +
          `${Math.round(todayFocusedSecondsForMission / 60)}m on this mission today, ` +
          `${Math.round(todayFocusedSecondsOverall / 60)}m overall today${sessionLine}`
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

      await focusTimer.end();
      await missionService.resetAll();
      statusBar.refresh();
      vscode.window.showInformationMessage('NerdsLab local data has been reset.');
    })
  );
}
