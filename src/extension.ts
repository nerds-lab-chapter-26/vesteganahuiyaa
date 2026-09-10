import * as vscode from 'vscode';
import { LocalStore } from './storage/localStore';
import { MissionService } from './mission/missionService';
import { StatusBarController } from './statusBar/statusBarController';
import { registerCommands } from './commands/registerCommands';

const URGENCY_REFRESH_INTERVAL_MS = 60_000; // FR-05: recalc at least every 15 min; 1 min is cheap and precise.

export function activate(context: vscode.ExtensionContext): void {
  const store = new LocalStore(context);
  const missionService = new MissionService(store);
  const statusBar = new StatusBarController(missionService);

  registerCommands(context, missionService, statusBar);

  statusBar.refresh();
  context.subscriptions.push(statusBar);

  const interval = setInterval(() => statusBar.refresh(), URGENCY_REFRESH_INTERVAL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });
}

export function deactivate(): void {
  // Nothing to tear down yet — no timers or listeners live outside
  // context.subscriptions, which VS Code disposes automatically.
}
