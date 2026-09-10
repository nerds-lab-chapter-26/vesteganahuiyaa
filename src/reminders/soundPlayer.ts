import { exec } from 'child_process';
import * as path from 'path';

let extensionPath: string | undefined;

/** Must be called once from `activate()` before any sound is played. */
export function initSoundPlayer(extPath: string): void {
  extensionPath = extPath;
}

/**
 * Best-effort, fire-and-forget alert sound. Never throws: a missing
 * player/sound on some machine should degrade to silence, not break the
 * reminder flow (NFR: negligible impact, no crash).
 */
export function playOverdueAlertSound(): void {
  playSystemSound(buildOverdueCommand());
}

/** Softer/friendlier sound than the overdue alert — a nudge, not a warning. */
export function playBreakReminderSound(): void {
  playSystemSound(buildBreakReminderCommand());
}

function playSystemSound(command: string | undefined): void {
  try {
    if (!command) return;
    exec(command, (err) => {
      if (err) console.error('[NerdsLab] alert sound failed to play', err);
    });
  } catch (err) {
    console.error('[NerdsLab] alert sound threw synchronously', err);
  }
}

/** The bundled "faaah" clip used for the overdue alert — a deadline was missed. */
function overdueSoundFile(): string | undefined {
  return extensionPath ? path.join(extensionPath, 'assets', 'sounds', 'faaah.mp3') : undefined;
}

function buildOverdueCommand(): string | undefined {
  const soundFile = overdueSoundFile();
  if (!soundFile) return buildFallbackOverdueCommand();

  switch (process.platform) {
    case 'win32': {
      // WPF's MediaPlayer (unlike System.Media.SoundPlayer) can play mp3.
      // There's no reliable synchronous "wait until done" without a fixed
      // sleep, so 3s covers a short alert clip; longer ones would get cut off.
      const psPath = soundFile.replace(/'/g, "''");
      return (
        'powershell -NoProfile -WindowStyle Hidden -Command ' +
        `"Add-Type -AssemblyName presentationCore; ` +
        `$p = New-Object system.windows.media.mediaplayer; ` +
        `$p.Open([uri]'${psPath}'); $p.Play(); Start-Sleep -Milliseconds 3000; $p.Close()"`
      );
    }
    case 'darwin':
      // afplay plays mp3 natively.
      return `afplay "${soundFile}"`;
    case 'linux':
      // mpg123/ffplay are common mp3-capable players; fall back to the
      // terminal bell if neither is installed.
      return (
        `mpg123 -q "${soundFile}" ` +
        `|| ffplay -nodisp -autoexit -loglevel quiet "${soundFile}" ` +
        `|| printf "\\a"`
      );
    default:
      return undefined;
  }
}

/** If the bundled sound file's path can't be resolved, fall back to the old system sound. */
function buildFallbackOverdueCommand(): string | undefined {
  switch (process.platform) {
    case 'win32':
      return (
        'powershell -NoProfile -WindowStyle Hidden -Command ' +
        '"[System.Media.SystemSounds]::Exclamation.Play(); Start-Sleep -Milliseconds 700"'
      );
    case 'darwin':
      return 'afplay /System/Library/Sounds/Basso.aiff';
    case 'linux':
      return (
        'paplay /usr/share/sounds/freedesktop/stereo/dialog-error.oga ' +
        '|| aplay /usr/share/sounds/alsa/Front_Center.wav ' +
        '|| printf "\\a"'
      );
    default:
      return undefined;
  }
}

function buildBreakReminderCommand(): string | undefined {
  switch (process.platform) {
    case 'win32':
      return (
        'powershell -NoProfile -WindowStyle Hidden -Command ' +
        '"[System.Media.SystemSounds]::Asterisk.Play(); Start-Sleep -Milliseconds 700"'
      );
    case 'darwin':
      return 'afplay /System/Library/Sounds/Ping.aiff';
    case 'linux':
      return (
        'paplay /usr/share/sounds/freedesktop/stereo/message.oga ' +
        '|| aplay /usr/share/sounds/alsa/Front_Left.wav ' +
        '|| printf "\\a"'
      );
    default:
      return undefined;
  }
}
