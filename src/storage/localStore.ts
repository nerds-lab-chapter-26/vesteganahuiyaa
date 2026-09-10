import * as vscode from 'vscode';
import { Mission } from '../mission/missionTypes';

const STORE_KEY = 'nerdslab.store';
export const SCHEMA_VERSION = 1;

export interface StoreShape {
  schemaVersion: number;
  activeMissionId: string | null;
  missions: Record<string, Mission>;
}

function emptyStore(): StoreShape {
  return { schemaVersion: SCHEMA_VERSION, activeMissionId: null, missions: {} };
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
    // Future schema migrations branch on raw.schemaVersion here.
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

  async resetAll(): Promise<void> {
    await this.write(emptyStore());
  }
}
