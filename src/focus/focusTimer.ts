import * as vscode from 'vscode';
import { LocalStore } from '../storage/localStore';
import { ActivityTracker } from './activityTracker';
import { Clock, systemClock } from '../core/clock';
import {
  BREAK_SNOOZE_MINUTES,
  FocusSession,
  IDLE_THRESHOLD_MS,
  TICK_INTERVAL_MS,
  todayLocalDate,
} from './focusTypes';
import { DEFAULT_BREAK_THRESHOLD_MINUTES } from '../mission/missionTypes';

export class FocusTimerError extends Error {}

export interface FocusStatus {
  session: FocusSession | null;
  isIdle: boolean;
  /** Today's focused seconds for the currently active mission only. */
  todayFocusedSecondsForMission: number;
  /** Today's focused seconds across every mission (active + completed today). */
  todayFocusedSecondsOverall: number;
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

  private readonly _onBreakDue = new vscode.EventEmitter<void>();
  /** Fires once when continuous focus crosses the mission's break threshold. */
  readonly onBreakDue = this._onBreakDue.event;

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

    // Keyed off the active mission, not `session.missionId` — a
    // "completed" session lingers in storage (see `end()`) until the next
    // one starts, so using the session's own mission id here would leak
    // the previous mission's daily total onto a brand-new mission.
    const activeMission = this.store.getActiveMission();
    const todayFocusedSecondsForMission = activeMission
      ? this.store.getDailyFocusedSeconds(today, activeMission.id)
      : 0;
    const todayFocusedSecondsOverall = this.store.getDailyFocusedSecondsAllMissions(today);

    return { session, isIdle: this.isIdle, todayFocusedSecondsForMission, todayFocusedSecondsOverall };
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
      secondsSinceBreak: 0,
      breakAlertPending: false,
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

    // Any pause — manual or via a break reminder — ends the current
    // continuous-focus stretch, so the next run starts counting fresh.
    const paused: FocusSession = {
      ...session,
      state: 'paused',
      secondsSinceBreak: 0,
      breakAlertPending: false,
    };
    await this.store.saveCurrentSession(paused);
    this.stopTicking();
    this._onDidChange.fire();
    return paused;
  }

  /** "Take a Break" from a break-reminder prompt — just pauses the session. */
  async takeBreak(): Promise<FocusSession | undefined> {
    return this.pause();
  }

  /**
   * "Snooze" a break reminder — rewinds the continuous-focus counter so
   * the reminder fires again after another `BREAK_SNOOZE_MINUTES`, instead
   * of resetting it fully or nagging on every subsequent tick.
   */
  async snoozeBreak(): Promise<void> {
    const session = this.store.getCurrentSession();
    if (!session) return;

    const snoozeSeconds = BREAK_SNOOZE_MINUTES * 60;
    const rewound = Math.max(0, (session.secondsSinceBreak ?? 0) - snoozeSeconds);
    await this.store.saveCurrentSession({
      ...session,
      secondsSinceBreak: rewound,
      breakAlertPending: false,
    });
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
    const wasIdle = this.isIdle;
    this.isIdle = currentlyIdle;

    // Going idle counts as taking a natural break — start the next
    // continuous-focus stretch from zero rather than treating the gap
    // itself as unbroken focus.
    const justWentIdle = currentlyIdle && !wasIdle;
    const secondsSinceBreak = justWentIdle
      ? 0
      : (session.secondsSinceBreak ?? 0) + (currentlyIdle ? 0 : tickSeconds);

    const updated: FocusSession = {
      ...session,
      focusedSeconds: session.focusedSeconds + (currentlyIdle ? 0 : tickSeconds),
      idleSeconds: session.idleSeconds + (currentlyIdle ? tickSeconds : 0),
      secondsSinceBreak,
      breakAlertPending: justWentIdle ? false : (session.breakAlertPending ?? false),
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

    if (!currentlyIdle && !updated.breakAlertPending) {
      const mission = this.store.getActiveMission();
      const thresholdSeconds =
        (mission?.breakThresholdMinutes ?? DEFAULT_BREAK_THRESHOLD_MINUTES) * 60;
      if (updated.secondsSinceBreak >= thresholdSeconds) {
        await this.store.saveCurrentSession({ ...updated, breakAlertPending: true });
        this._onBreakDue.fire();
      }
    }
  }

  dispose(): void {
    this.stopTicking();
    this.activitySub.dispose();
    this.activityTracker.dispose();
    this._onDidChange.dispose();
    this._onBreakDue.dispose();
  }
}
