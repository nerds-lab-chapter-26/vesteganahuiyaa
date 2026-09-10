export type FocusSessionState = 'running' | 'paused' | 'completed';

export interface FocusSession {
  id: string;
  missionId: string;
  startedAt: string; // ISO 8601
  endedAt?: string; // ISO 8601
  focusedSeconds: number;
  idleSeconds: number;
  state: FocusSessionState;
}

export interface DailyFocusSummary {
  date: string; // YYYY-MM-DD, local time
  missionId: string;
  focusedSeconds: number;
  sessionCount: number;
}

/** §7.3 — pause counting after 5 minutes without supported editor activity. */
export const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * How often the timer re-evaluates active-vs-idle and accumulates time.
 * Persistence happens on every tick too (well under the "at least once per
 * minute" requirement) — writes are tiny JSON, so this is cheap.
 */
export const TICK_INTERVAL_MS = 15 * 1000;

export function todayLocalDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
