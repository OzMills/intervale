import type { JsonObject, JsonValue } from '../domain/json';
import { evaluateSessionTiming } from '../domain/session/timing';
import type { SessionRecord } from '../domain/session/types';
import type { ReportRecord } from '../persistence/records';

export type FocusPresentationState =
  'ready' | 'running' | 'paused' | 'pending-resolution' | 'recovery';

export function focusPresentationState(session: SessionRecord | null): FocusPresentationState {
  if (!session) return 'ready';

  switch (session.state) {
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'readyToResolve':
    case 'resolving':
      return 'pending-resolution';
    case 'recoveryRequired':
      return 'recovery';
    case 'resolved':
      return 'ready';
  }
}

export function remainingWholeSeconds(session: SessionRecord, nowWallClockMs: number): number {
  const timing = evaluateSessionTiming(session, nowWallClockMs);
  return Math.max(0, Math.ceil(timing.remainingSeconds));
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    return hours + ':' + mm + ':' + ss;
  }

  return mm + ':' + ss;
}

export function reportNumber(
  report: ReportRecord,
  group: 'rewardBundle' | 'progressDeltas',
  key: string,
): number {
  const value = report.summary[group];
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    return 0;
  }

  const nested = (value as JsonObject)[key];
  return typeof nested === 'number' && Number.isFinite(nested) ? nested : 0;
}

export function reportEventIds(report: ReportRecord): string[] {
  const value = report.summary.eventIds;
  if (!Array.isArray(value)) return [];

  return value.filter((entry: JsonValue): entry is string => typeof entry === 'string');
}
