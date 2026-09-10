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
}

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
