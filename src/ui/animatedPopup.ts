import * as vscode from 'vscode';

/**
 * VS Code's built-in `showInformationMessage`/`showWarningMessage` toasts
 * are static text with no way to animate them. For the three "moment"
 * events that deserve personality (mission complete, break reminder,
 * overdue alert), we use a small Webview panel instead so the mascot can
 * actually move.
 */
export type PopupKind = 'celebrate' | 'wiggle' | 'shake';

export interface PopupButton {
  id: string;
  label: string;
}

export interface PopupOptions {
  kind: PopupKind;
  title: string;
  message: string;
  buttons: PopupButton[];
}

let extensionUri: vscode.Uri | undefined;

/** Must be called once from `activate()` before any popup is shown. */
export function initAnimatedPopups(context: vscode.ExtensionContext): void {
  extensionUri = context.extensionUri;
}

/**
 * Shows the animated popup and resolves with the id of the button the
 * user clicked, or undefined if they closed the panel without choosing.
 */
export function showAnimatedPopup(options: PopupOptions): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (!extensionUri) {
      resolve(undefined);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'nerdslabPopup',
      options.title,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, localResourceRoots: [extensionUri], retainContextWhenHidden: false }
    );

    const iconUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'icon.png'));

    let settled = false;
    const settle = (value: string | undefined) => {
      if (settled) return;
      settled = true;
      resolve(value);
      panel.dispose();
    };

    panel.webview.onDidReceiveMessage((msg) => {
      if (msg?.type === 'choice') settle(msg.id);
    });
    panel.onDidDispose(() => settle(undefined));

    panel.webview.html = buildHtml(options, iconUri, panel.webview.cspSource);
  });
}

function buildHtml(options: PopupOptions, iconUri: vscode.Uri, cspSource: string): string {
  const buttonsHtml = options.buttons
    .map((b) => `<button data-id="${escapeHtml(b.id)}">${escapeHtml(b.label)}</button>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource}; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
${sharedStyles()}
${animationStyles(options.kind)}
</style>
</head>
<body>
  <div class="card">
    <div class="stage">
      <img src="${iconUri}" class="mascot ${options.kind}" alt="mascot" />
      ${options.kind === 'celebrate' ? confettiMarkup() : ''}
    </div>
    <p class="message">${escapeHtml(options.message)}</p>
    <div class="buttons">${buttonsHtml}</div>
  </div>
<script>
  const vscode = acquireVsCodeApi();
  document.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      vscode.postMessage({ type: 'choice', id: btn.getAttribute('data-id') });
    });
  });
</script>
</body>
</html>`;
}

function sharedStyles(): string {
  return `
    body {
      display: flex; align-items: center; justify-content: center;
      height: 100vh; margin: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      overflow: hidden;
    }
    .card { text-align: center; }
    .stage { position: relative; display: inline-block; }
    .mascot { width: 120px; height: 120px; }
    .message { font-size: 1.1em; margin: 16px 0; max-width: 320px; }
    .buttons { display: flex; gap: 8px; justify-content: center; }
    button {
      padding: 6px 14px; border: none; border-radius: 4px; cursor: pointer;
      background: var(--vscode-button-background); color: var(--vscode-button-foreground);
      font-size: 0.95em;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
  `;
}

function animationStyles(kind: PopupKind): string {
  switch (kind) {
    case 'celebrate':
      return `
        .mascot.celebrate { animation: pop-bounce 900ms cubic-bezier(.28,1.8,.5,1) both; }
        @keyframes pop-bounce {
          0% { transform: scale(0.3) translateY(40px); opacity: 0; }
          60% { transform: scale(1.15) translateY(-10px); opacity: 1; }
          80% { transform: scale(0.95) translateY(4px); }
          100% { transform: scale(1) translateY(0); }
        }
        .confetti {
          position: absolute; top: -16px; width: 8px; height: 8px; opacity: 0.9;
          animation: fall 1600ms ease-in forwards;
        }
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(160px) rotate(360deg); opacity: 0; }
        }
      `;
    case 'wiggle':
      return `
        .mascot.wiggle { animation: wiggle 1400ms ease-in-out infinite; }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-8deg); }
          40% { transform: rotate(6deg); }
          60% { transform: rotate(-4deg); }
          80% { transform: rotate(3deg); }
        }
      `;
    case 'shake':
      return `
        .mascot.shake { animation: shake 500ms ease-in-out 3; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px) rotate(-3deg); }
          75% { transform: translateX(10px) rotate(3deg); }
        }
      `;
  }
}

function confettiMarkup(): string {
  const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a78bfa', '#7bd389'];
  return Array.from({ length: 14 }, (_, i) => {
    const left = Math.round(Math.random() * 100);
    const delay = Math.round(Math.random() * 300);
    const color = colors[i % colors.length];
    return `<div class="confetti" style="left:${left}%; background:${color}; animation-delay:${delay}ms;"></div>`;
  }).join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
