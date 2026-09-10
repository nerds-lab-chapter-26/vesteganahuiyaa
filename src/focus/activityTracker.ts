import * as vscode from 'vscode';

/**
 * Wires up every activity signal the MVP is allowed to observe (§7.3) and
 * fires `onActivity` whenever one occurs. Deliberately does NOT read typed
 * text, terminal content, filenames, or selections themselves — only that
 * *an* event happened (§FR-07 / privacy statement).
 *
 * Supported signals:
 * - Text document changes
 * - Active editor changes
 * - Text editor selection changes
 * - Editor scrolling (visible-range changes) — reading code counts as work
 * - Window gaining OS focus — returning to VS Code is itself a signal
 * - Terminal open/close/switch, and shell command start/end where the API
 *   is available (added in VS Code 1.93; feature-detected so this still
 *   runs on older versions per the ^1.85.0 compatibility target)
 *
 * NOTE: there is no VS Code API to observe raw terminal keystrokes, so a
 * long-running interactive terminal session (a REPL, `ssh`, etc.) with no
 * shell-integration events will still read as idle after 5 minutes. This
 * is a known MVP limitation, not a bug — see PRD §7.3 edge cases.
 */
export class ActivityTracker implements vscode.Disposable {
  private readonly _onActivity = new vscode.EventEmitter<void>();
  readonly onActivity = this._onActivity.event;

  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    const ping = () => this._onActivity.fire();

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(ping),
      vscode.window.onDidChangeActiveTextEditor(ping),
      vscode.window.onDidChangeTextEditorSelection(ping),
      vscode.window.onDidChangeTextEditorVisibleRanges(ping),
      vscode.window.onDidOpenTerminal(ping),
      vscode.window.onDidChangeActiveTerminal(ping),
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) ping();
      })
    );

    // Terminal shell-integration events (VS Code >= 1.93). Feature-detect
    // rather than bumping the minimum engine version, since these are a
    // nice-to-have signal, not load-bearing.
    const win = vscode.window as unknown as {
      onDidStartTerminalShellExecution?: vscode.Event<unknown>;
      onDidEndTerminalShellExecution?: vscode.Event<unknown>;
    };
    if (typeof win.onDidStartTerminalShellExecution === 'function') {
      this.disposables.push(win.onDidStartTerminalShellExecution(ping));
    }
    if (typeof win.onDidEndTerminalShellExecution === 'function') {
      this.disposables.push(win.onDidEndTerminalShellExecution(ping));
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this._onActivity.dispose();
  }
}
