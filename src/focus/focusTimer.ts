import * as vscode from 'vscode';
import { LocalStore } from '../storage/localStore';
import { ActivityTracker } from './activityTracker';
import { Clock, systemClock } from '../core/clock';
import { FocusSession, IDLE_THRESHOLD_MS, TICK_INTERVAL_MS, todayLocalDate } from './focusTypes';

export class FocusTimerError extends Error {}

export interface FocusStatus {
  session: FocusSession | null;
  isIdle: boolean;
  todayFocusedSeconds: number;
}

/**
 * Owns the focus-session state machine (§7.3 / FR-03). Ticks on an
 * interval rather than reacting to individual activity events, so idle
 * detection is a simple forward comparison: "has it been >= 5 minutes
 * since the last activity signal?" at the moment of each tick. This means
 * the first 5 minutes of a gap are counted as focused (matching the PRD's
 * literal wording, "pause counting AFTER 5 minutes without activity") —
 * there's no retroactive discarding of already-ticked time.
 */
export class FocusTimer implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private readonly activityTracker: ActivityTracker;
  private readonly activitySub: vscode.Disposable;
  private tickHandle: ReturnType<typeof setInterval> | undefined;

  private lastActivityAt: number;
  private isIdle = false;
  private isNewSession = false;

  constructor(
    private store: LocalStore,
    private clock: Clock = systemClock
  ) {
    this.lastActivityAt = this.clock.now();
    this.activityTracker = new ActivityTracker();
    this.activitySub = this.activityTracker.onActivity(() => {
      this.lastActivityAt = this.clock.now();
    });

    const session = this.store.getCurrentSession();
    if (session?.state === 'running') {
      this.startTicking();
    }
  }

  getStatus(): FocusStatus {
    const session = this.store.getCurrentSession();
    const today = todayLocalDate();
    const todayFocusedSeconds = session
      ? this.store.getDailyFocusedSeconds(today, session.missionId)
      : 0;
    return { session, isIdle: this.isIdle, todayFocusedSeconds };
  }

  async start(missionId: string): Promise<FocusSession> {
    const existing = this.store.getCurrentSession();
    if (existing && existing.state !== 'completed') {
      if (existing.missionId !== missionId) {
        throw new FocusTimerError('A focus session for a different mission is already active.');
      }
      if (existing.state === 'paused') {
        const resumed: FocusSession = { ...existing, state: 'running' };
        await this.store.saveCurrentSession(resumed);
        this.lastActivityAt = this.clock.now();
        this.startTicking();
        this._onDidChange.fire();
        return resumed;
      }
      throw new FocusTimerError('A focus session is already running.');
    }

    const session: FocusSession = {
      id: `session_${this.clock.now()}_${Math.random().toString(36).slice(2, 8)}`,
      missionId,
      startedAt: new Date(this.clock.now()).toISOString(),
      focusedSeconds: 0,
      idleSeconds: 0,
      state: 'running',
    };
    await this.store.saveCurrentSession(session);
    this.lastActivityAt = this.clock.now();
    this.isIdle = false;
    this.isNewSession = true;
    this.startTicking();
    this._onDidChange.fire();
    return session;
  }

  async pause(): Promise<FocusSession | undefined> {
    const session = this.store.getCurrentSession();
    if (!session || session.state !== 'running') return undefined;

    const paused: FocusSession = { ...session, state: 'paused' };
    await this.store.saveCurrentSession(paused);
    this.stopTicking();
    this._onDidChange.fire();
    return paused;
  }

  async end(): Promise<FocusSession | undefined> {
    const session = this.store.getCurrentSession();
    if (!session || session.state === 'completed') return undefined;

    this.stopTicking();
    const ended: FocusSession = {
      ...session,
      state: 'completed',
      endedAt: new Date(this.clock.now()).toISOString(),
    };
    await this.store.saveCurrentSession(ended);
    this._onDidChange.fire();
    return ended;
  }

  /**
   * Called once at activation if a session was left "running" from a
   * previous window (e.g. the extension host crashed or was killed).
   * We don't know how much real time passed while VS Code was closed, so
   * the safe move is to freeze it as paused rather than silently counting
   * — or discarding — an unknown gap (NFR: "recover sensibly").
   */
  async recoverInterruptedSession(): Promise<FocusSession | undefined> {
    const session = this.store.getCurrentSession();
    if (!session || session.state !== 'running') return undefined;

    const paused: FocusSession = { ...session, state: 'paused' };
    await this.store.saveCurrentSession(paused);
    return paused;
  }

  private startTicking(): void {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => {
      this.tick().catch((err) => console.error('[NerdsLab] focus tick failed', err));
    }, TICK_INTERVAL_MS);
  }

  private stopTicking(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = undefined;
    }
  }

  private async tick(): Promise<void> {
    const session = this.store.getCurrentSession();
    if (!session || session.state !== 'running') {
      this.stopTicking();
      return;
    }

    const now = this.clock.now();
    const tickSeconds = TICK_INTERVAL_MS / 1000;
    const idleGapMs = now - this.lastActivityAt;
    const currentlyIdle = idleGapMs >= IDLE_THRESHOLD_MS;
    this.isIdle = currentlyIdle;

    const updated: FocusSession = {
      ...session,
      focusedSeconds: session.focusedSeconds + (currentlyIdle ? 0 : tickSeconds),
      idleSeconds: session.idleSeconds + (currentlyIdle ? tickSeconds : 0),
    };

    const newSessionStarted = this.isNewSession;
    this.isNewSession = false;

    await this.store.recordFocusedSeconds(
      updated.missionId,
      todayLocalDate(),
      currentlyIdle ? 0 : tickSeconds,
      updated,
      newSessionStarted
    );
    this._onDidChange.fire();
  }

  dispose(): void {
    this.stopTicking();
    this.activitySub.dispose();
    this.activityTracker.dispose();
    this._onDidChange.dispose();
  }
}
