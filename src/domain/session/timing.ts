import type {
  ClockAnomalyRecord,
  RunningSegment,
  SessionRecord,
} from './types';

const LARGE_FORWARD_ABSOLUTE_MS = 24 * 60 * 60 * 1000;
const LARGE_FORWARD_DURATION_MULTIPLIER = 10;
const TIMING_EPSILON_SECONDS = 0.000_001;

export interface SessionTimingEvaluation {
  creditedSeconds: number;
  completedCreditedSeconds: number;
  currentEligibleSeconds: number;
  remainingSeconds: number;
  naturallyComplete: boolean;
  requiresRecovery: boolean;
  observations: ClockAnomalyRecord[];
}

function isFiniteNonnegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function segmentIsValid(segment: RunningSegment): boolean {
  if (
    !isFiniteNonnegative(segment.startedAtWallClockMs) ||
    !isFiniteNonnegative(segment.endedAtWallClockMs) ||
    !isFiniteNonnegative(segment.creditedSeconds)
  ) {
    return false;
  }

  if (segment.endedAtWallClockMs < segment.startedAtWallClockMs) return false;

  const elapsedSeconds =
    (segment.endedAtWallClockMs - segment.startedAtWallClockMs) / 1000;

  return segment.creditedSeconds <= elapsedSeconds + TIMING_EPSILON_SECONDS;
}

export function completedCreditedSeconds(session: SessionRecord): number {
  return session.completedRunningSegments.reduce(
    (total, segment) => total + segment.creditedSeconds,
    0,
  );
}

function timingStateIsValid(session: SessionRecord): boolean {
  if (!session.completedRunningSegments.every(segmentIsValid)) return false;

  const completed = completedCreditedSeconds(session);
  if (
    !isFiniteNonnegative(session.intendedDurationSeconds) ||
    session.intendedDurationSeconds <= 0 ||
    completed > session.intendedDurationSeconds + TIMING_EPSILON_SECONDS
  ) {
    return false;
  }

  if (session.state === 'running') {
    return session.currentRunningStartedAtWallClockMs !== null;
  }

  return session.currentRunningStartedAtWallClockMs === null;
}

function anomalyAlreadyRecorded(
  session: SessionRecord,
  kind: ClockAnomalyRecord['kind'],
  segmentStartedAtWallClockMs: number | null,
): boolean {
  return session.clockAnomalies.some(
    (anomaly) =>
      anomaly.kind === kind &&
      anomaly.segmentStartedAtWallClockMs === segmentStartedAtWallClockMs,
  );
}

export function evaluateSessionTiming(
  session: SessionRecord,
  nowWallClockMs: number,
): SessionTimingEvaluation {
  const completed = completedCreditedSeconds(session);
  const observations: ClockAnomalyRecord[] = [];

  if (!timingStateIsValid(session) || !isFiniteNonnegative(nowWallClockMs)) {
    if (!anomalyAlreadyRecorded(session, 'invalid-timing-state', null)) {
      observations.push({
        kind: 'invalid-timing-state',
        observedAtWallClockMs: Math.max(0, nowWallClockMs),
        segmentStartedAtWallClockMs: session.currentRunningStartedAtWallClockMs,
        rawElapsedMs: null,
      });
    }

    return {
      creditedSeconds: Math.min(session.intendedDurationSeconds, Math.max(0, completed)),
      completedCreditedSeconds: Math.max(0, completed),
      currentEligibleSeconds: 0,
      remainingSeconds: Math.max(0, session.intendedDurationSeconds - Math.max(0, completed)),
      naturallyComplete: completed >= session.intendedDurationSeconds,
      requiresRecovery: true,
      observations,
    };
  }

  let currentEligibleSeconds = 0;

  if (session.state === 'running' && session.currentRunningStartedAtWallClockMs !== null) {
    const startedAt = session.currentRunningStartedAtWallClockMs;
    const rawElapsedMs = nowWallClockMs - startedAt;

    if (
      rawElapsedMs < 0 &&
      !anomalyAlreadyRecorded(session, 'backwards-wall-clock', startedAt)
    ) {
      observations.push({
        kind: 'backwards-wall-clock',
        observedAtWallClockMs: nowWallClockMs,
        segmentStartedAtWallClockMs: startedAt,
        rawElapsedMs,
      });
    }

    const largeForwardThresholdMs = Math.max(
      LARGE_FORWARD_ABSOLUTE_MS,
      session.intendedDurationSeconds * 1000 * LARGE_FORWARD_DURATION_MULTIPLIER,
    );

    if (
      rawElapsedMs > largeForwardThresholdMs &&
      !anomalyAlreadyRecorded(session, 'large-forward-wall-clock', startedAt)
    ) {
      observations.push({
        kind: 'large-forward-wall-clock',
        observedAtWallClockMs: nowWallClockMs,
        segmentStartedAtWallClockMs: startedAt,
        rawElapsedMs,
      });
    }

    const nonnegativeElapsedSeconds = Math.max(0, rawElapsedMs) / 1000;
    currentEligibleSeconds = Math.min(
      Math.max(0, session.intendedDurationSeconds - completed),
      nonnegativeElapsedSeconds,
    );
  }

  const creditedSeconds = Math.min(
    session.intendedDurationSeconds,
    Math.max(0, completed + currentEligibleSeconds),
  );

  return {
    creditedSeconds,
    completedCreditedSeconds: completed,
    currentEligibleSeconds,
    remainingSeconds: Math.max(0, session.intendedDurationSeconds - creditedSeconds),
    naturallyComplete:
      creditedSeconds + TIMING_EPSILON_SECONDS >= session.intendedDurationSeconds,
    requiresRecovery: false,
    observations,
  };
}

export interface ClosedRunningSegment {
  segment: RunningSegment | null;
  creditedSeconds: number;
  anomalies: ClockAnomalyRecord[];
}

export function closeCurrentRunningSegment(
  session: SessionRecord,
  nowWallClockMs: number,
): ClosedRunningSegment {
  const evaluation = evaluateSessionTiming(session, nowWallClockMs);

  if (evaluation.requiresRecovery) {
    return {
      segment: null,
      creditedSeconds: evaluation.creditedSeconds,
      anomalies: evaluation.observations,
    };
  }

  if (session.state !== 'running' || session.currentRunningStartedAtWallClockMs === null) {
    return {
      segment: null,
      creditedSeconds: evaluation.creditedSeconds,
      anomalies: evaluation.observations,
    };
  }

  const creditedSeconds = evaluation.currentEligibleSeconds;
  if (creditedSeconds <= 0) {
    return {
      segment: null,
      creditedSeconds: evaluation.creditedSeconds,
      anomalies: evaluation.observations,
    };
  }

  const startedAt = session.currentRunningStartedAtWallClockMs;
  const endedAt = startedAt + creditedSeconds * 1000;

  return {
    segment: {
      startedAtWallClockMs: startedAt,
      endedAtWallClockMs: endedAt,
      creditedSeconds,
    },
    creditedSeconds: evaluation.creditedSeconds,
    anomalies: evaluation.observations,
  };
}

export function mergeClockAnomalies(
  session: SessionRecord,
  observations: readonly ClockAnomalyRecord[],
): ClockAnomalyRecord[] {
  const merged = [...session.clockAnomalies];

  for (const observation of observations) {
    const exists = merged.some(
      (existing) =>
        existing.kind === observation.kind &&
        existing.segmentStartedAtWallClockMs === observation.segmentStartedAtWallClockMs,
    );

    if (!exists) merged.push(observation);
  }

  return merged;
}
