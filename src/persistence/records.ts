import type { JsonObject, JsonValue } from '../domain/json';
import type { SessionRecord } from '../domain/session/types';

export type { JsonObject, JsonValue } from '../domain/json';
export type { SessionRecord } from '../domain/session/types';

export type PersistentStorageStatus = 'unknown' | 'granted' | 'denied' | 'unsupported';

export interface MetaRecord {
  id: 'meta';
  saveSchemaVersion: number;
  contentVersion: string;
  installationId: string;
  stateRevision: number;
  createdAt: string;
  lastCommittedAt: string;
  persistentStorageStatus: PersistentStorageStatus;
}

export interface GameStateRecord {
  id: 'game';
  data: JsonObject;
}

export interface ReportRecord {
  id: string;
  sessionId: string;
  activityType: string;
  creditedSeconds: number;
  createdAt: string;
  headlineKey: string;
  summary: JsonObject;
  reportInputs: JsonValue[];
}

export interface EventLogRecord {
  sequence?: number;
  sessionId: string;
  reportId: string | null;
  eventType: string;
  payload: JsonObject;
}

export interface MigrationMetaRecord {
  id: string;
  appliedAt: string;
  fromVersion: number;
  toVersion: number;
}

export interface SavePayload {
  gameState: GameStateRecord;
  sessions: SessionRecord[];
  reports: ReportRecord[];
  eventLog: EventLogRecord[];
  migrationMeta: MigrationMetaRecord[];
}

export interface SnapshotRecord {
  id: string;
  createdAt: string;
  reason: 'import-recovery' | 'migration' | 'manual';
  payload: SavePayload;
}
