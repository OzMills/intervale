import type { JsonObject } from '../json';

export type SessionState =
  | 'running'
  | 'paused'
  | 'readyToResolve'
  | 'resolving'
  | 'resolved'
  | 'recoveryRequired';

export interface RunningSegment {
  startedAtWallClockMs: number;
  endedAtWallClockMs: number;
  creditedSeconds: number;
}

export type ClockAnomalyKind =
  | 'backwards-wall-clock'
  | 'large-forward-wall-clock'
  | 'invalid-timing-state';

export interface ClockAnomalyRecord {
  kind: ClockAnomalyKind;
  observedAtWallClockMs: number;
  segmentStartedAtWallClockMs: number | null;
  rawElapsedMs: number | null;
}

export interface SessionRecord {
  id: string;
  state: SessionState;
  intendedDurationSeconds: number;
  activityType: string;
  activitySnapshot: JsonObject;
  activityParameters: JsonObject;
  loadoutSnapshot: JsonObject;
  consumableSnapshot: JsonObject;
  taskLabel: string | null;
  rootSeed: string;
  simulationVersion: number;
  contentVersion: string;
  schemaVersionAtStart: number;
  createdAt: string;
  createdAtWallClockMs: number;
  startedAtWallClockMs: number;
  completedRunningSegments: RunningSegment[];
  currentRunningStartedAtWallClockMs: number | null;
  creditedSecondsAtStop: number | null;
  clockAnomalies: ClockAnomalyRecord[];
  resolvedAt: string | null;
  resultHash: string | null;
  reportId: string | null;
}
