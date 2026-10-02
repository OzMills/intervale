import Dexie, { type EntityTable } from 'dexie';
import type {
  EventLogRecord,
  GameStateRecord,
  MetaRecord,
  MigrationMetaRecord,
  ReportRecord,
  SessionRecord,
  SnapshotRecord,
} from './records';

export class IntervaleDatabase extends Dexie {
  meta!: EntityTable<MetaRecord, 'id'>;
  gameState!: EntityTable<GameStateRecord, 'id'>;
  sessions!: EntityTable<SessionRecord, 'id'>;
  reports!: EntityTable<ReportRecord, 'id'>;
  eventLog!: EntityTable<EventLogRecord, 'sequence'>;
  snapshots!: EntityTable<SnapshotRecord, 'id'>;
  migrationMeta!: EntityTable<MigrationMetaRecord, 'id'>;

  constructor(name = 'intervale') {
    super(name);

    this.version(1).stores({
      meta: '&id',
      gameState: '&id',
      sessions: '&id, state, createdAt, resolvedAt, reportId',
      reports: '&id, sessionId, createdAt, activityType',
      eventLog: '++sequence, sessionId, reportId, eventType',
      snapshots: '&id, createdAt, reason',
      migrationMeta: '&id',
    });
  }
}

export function createIntervaleDatabase(name?: string): IntervaleDatabase {
  return new IntervaleDatabase(name);
}
