import * as vscode from 'vscode';
import { LocalStore } from './storage/localStore';
import { MissionService } from './mission/missionService';
import { FocusTimer } from './focus/focusTimer';
import { StatusBarController } from './statusBar/statusBarController';
import { registerCommands } from './commands/registerCommands';

const URGENCY_REFRESH_INTERVAL_MS = 60_000; // FR-05: recalc at least every 15 min; 1 min is cheap and precise.

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const store = new LocalStore(context);
  const missionService = new MissionService(store);
  const focusTimer = new FocusTimer(store);

  // NFR "Reliability": if the extension host died while a session was
  // running, freeze it as paused rather than guessing at lost time.
  await focusTimer.recoverInterruptedSession();

  const statusBar = new StatusBarController(missionService, focusTimer);

  registerCommands(context, missionService, focusTimer, statusBar);

  statusBar.refresh();
  context.subscriptions.push(statusBar, focusTimer);

  const interval = setInterval(() => statusBar.refresh(), URGENCY_REFRESH_INTERVAL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });
}

export function deactivate(): void {
  // Nothing to tear down manually — everything lives in
  // context.subscriptions, which VS Code disposes automatically.
}
