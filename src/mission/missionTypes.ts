export type MissionStatus = 'active' | 'completed';

/**
 * `status` never stores "overdue" — overdue is a derived, point-in-time
 * comparison of `deadline` against now (see `isOverdue`), not a persisted
 * state. That keeps a mission's stored status truthful even if VS Code was
 * closed when the deadline passed.
 */
export interface Mission {
  id: string;
  name: string;
  createdAt: string; // ISO 8601
  deadline: string; // ISO 8601
  completedAt?: string; // ISO 8601
  status: MissionStatus;
  dailyTargetMinutes: number;
  breakThresholdMinutes: number;
  totalFocusedSeconds: number;
  /**
   * Set the first (and only) time the overdue sound/notification fires for
   * this mission. Persisted so a VS Code restart doesn't re-alert, and a
   * fresh mission (new id) always starts unalerted.
   */
  overdueAlertedAt?: string; // ISO 8601
  /**
   * Which "deadline approaching" lead-time thresholds (in minutes) have
   * already nudged the user for this mission — so a restart, or checking
   * again a minute later, doesn't repeat the same reminder.
   */
  deadlineRemindersFired?: number[];
}

/** Lead times (minutes before the deadline) at which an approaching-deadline nudge fires. */
export const DEADLINE_REMINDER_THRESHOLDS_MINUTES = [60, 30, 10];

export const DEFAULT_DAILY_TARGET_MINUTES = 120;
export const DEFAULT_BREAK_THRESHOLD_MINUTES = 180;

export const MISSION_NAME_MIN_LENGTH = 3;
export const MISSION_NAME_MAX_LENGTH = 120;

export function isOverdue(mission: Mission, now: Date = new Date()): boolean {
  return mission.status === 'active' && new Date(mission.deadline).getTime() < now.getTime();
}

export function completedOnTime(mission: Mission): boolean {
  if (!mission.completedAt) return false;
  return new Date(mission.completedAt).getTime() <= new Date(mission.deadline).getTime();
}
