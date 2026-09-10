import * as vscode from 'vscode';
import { LocalStore } from '../storage/localStore';
import {
  DEFAULT_BREAK_THRESHOLD_MINUTES,
  DEFAULT_DAILY_TARGET_MINUTES,
  Mission,
  MISSION_NAME_MAX_LENGTH,
  MISSION_NAME_MIN_LENGTH,
} from './missionTypes';

export class MissionValidationError extends Error {}

/**
 * Owns mission lifecycle rules (FR-01, FR-06). UI layers (commands, status
 * bar) never touch LocalStore directly — everything goes through here so
 * validation and the "one active mission" invariant can't be bypassed.
 */
export class MissionService {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private store: LocalStore) {}

  getActiveMission(): Mission | undefined {
    return this.store.getActiveMission();
  }

  hasActiveMission(): boolean {
    return this.getActiveMission() !== undefined;
  }

  getHistory(): Mission[] {
    return this.store.getAllMissions();
  }

  async createMission(
    name: string,
    deadlineIso: string,
    dailyTargetMinutes: number = DEFAULT_DAILY_TARGET_MINUTES,
    breakThresholdMinutes: number = DEFAULT_BREAK_THRESHOLD_MINUTES
  ): Promise<Mission> {
    if (this.hasActiveMission()) {
      throw new MissionValidationError(
        'A mission is already active. Complete it before starting a new one.'
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length < MISSION_NAME_MIN_LENGTH || trimmedName.length > MISSION_NAME_MAX_LENGTH) {
      throw new MissionValidationError(
        `Mission name must be ${MISSION_NAME_MIN_LENGTH}-${MISSION_NAME_MAX_LENGTH} characters.`
      );
    }

    const deadline = new Date(deadlineIso);
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
      throw new MissionValidationError('Mission deadline must be a valid date/time in the future.');
    }

    const mission: Mission = {
      id: `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      createdAt: new Date().toISOString(),
      deadline: deadline.toISOString(),
      status: 'active',
      dailyTargetMinutes,
      breakThresholdMinutes,
      totalFocusedSeconds: 0,
    };

    await this.store.saveMission(mission);
    this._onDidChange.fire();
    return mission;
  }

  async completeMission(): Promise<Mission | undefined> {
    const mission = this.getActiveMission();
    if (!mission) {
      return undefined;
    }

    const completed: Mission = {
      ...mission,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    await this.store.saveMission(completed);
    await this.store.clearActiveMission();
    this._onDidChange.fire();
    return completed;
  }

  async resetAll(): Promise<void> {
    await this.store.resetAll();
    this._onDidChange.fire();
  }
}
