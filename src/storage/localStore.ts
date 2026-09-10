import * as vscode from 'vscode';
import { Mission } from '../mission/missionTypes';
import { DailyFocusSummary, FocusSession } from '../focus/focusTypes';

const STORE_KEY = 'nerdslab.store';
export const SCHEMA_VERSION = 2;

export interface StoreShape {
  schemaVersion: number;
  activeMissionId: string | null;
  missions: Record<string, Mission>;
  currentSession: FocusSession | null;
  /** Keyed by `${date}:${missionId}` for O(1) lookup/merge. */
  dailySummaries: Record<string, DailyFocusSummary>;
}

function emptyStore(): StoreShape {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeMissionId: null,
    missions: {},
    currentSession: null,
    dailySummaries: {},
  };
}

function dailyKey(date: string, missionId: string): string {
  return `${date}:${missionId}`;
}

/**
 * Thin typed wrapper around VS Code's `globalState`. All NerdsLab data
 * lives under one key so schema migrations (bumping SCHEMA_VERSION and
 * transforming old shapes) have a single place to happen, in `read()`.
 */
export class LocalStore {
  constructor(private context: vscode.ExtensionContext) {}

  private read(): StoreShape {
    const raw = this.context.globalState.get<StoreShape>(STORE_KEY);
    if (!raw) {
      return emptyStore();
    }
    // v1 -> v2: focus tracking fields didn't exist yet. Backfill rather
    // than discard existing mission data.
    if (raw.schemaVersion < 2) {
      return {
        ...raw,
        schemaVersion: SCHEMA_VERSION,
        currentSession: raw.currentSession ?? null,
        dailySummaries: raw.dailySummaries ?? {},
      };
    }
    return raw;
  }

  private async write(next: StoreShape): Promise<void> {
    await this.context.globalState.update(STORE_KEY, next);
  }

  getActiveMission(): Mission | undefined {
    const store = this.read();
    return store.activeMissionId ? store.missions[store.activeMissionId] : undefined;
  }

  getAllMissions(): Mission[] {
    return Object.values(this.read().missions);
  }

  async saveMission(mission: Mission): Promise<void> {
    const store = this.read();
    store.missions[mission.id] = mission;
    if (mission.status === 'active') {
      store.activeMissionId = mission.id;
    }
    await this.write(store);
  }

  async clearActiveMission(): Promise<void> {
    const store = this.read();
    store.activeMissionId = null;
    await this.write(store);
  }

  getCurrentSession(): FocusSession | null {
    return this.read().currentSession;
  }

  async saveCurrentSession(session: FocusSession | null): Promise<void> {
    const store = this.read();
    store.currentSession = session;
    await this.write(store);
  }

  getDailyFocusedSeconds(date: string, missionId: string): number {
    return this.read().dailySummaries[dailyKey(date, missionId)]?.focusedSeconds ?? 0;
  }

  /** Sum of focused seconds across every mission for a given day. */
  getDailyFocusedSecondsAllMissions(date: string): number {
    return Object.values(this.read().dailySummaries)
      .filter((summary) => summary.date === date)
      .reduce((total, summary) => total + summary.focusedSeconds, 0);
  }

  /**
   * Atomically adds `seconds` to both the mission's running total and
   * today's daily summary, and persists the session snapshot alongside —
   * one write covers everything the timer needs to survive a restart.
   */
  async recordFocusedSeconds(
    missionId: string,
    date: string,
    seconds: number,
    session: FocusSession | null,
    newSessionStarted: boolean
  ): Promise<void> {
    const store = this.read();

    const mission = store.missions[missionId];
    if (mission) {
      mission.totalFocusedSeconds += seconds;
      store.missions[missionId] = mission;
    }

    if (seconds > 0) {
      const key = dailyKey(date, missionId);
      const existing = store.dailySummaries[key];
      store.dailySummaries[key] = {
        date,
        missionId,
        focusedSeconds: (existing?.focusedSeconds ?? 0) + seconds,
        sessionCount: (existing?.sessionCount ?? 0) + (newSessionStarted ? 1 : 0),
      };
    }

    store.currentSession = session;
    await this.write(store);
  }

  async resetAll(): Promise<void> {
    await this.write(emptyStore());
  }
}
