import type { IntervaleDatabase } from './database';
import { PersistenceContractError } from './errors';
import type {
  GameStateRecord,
  MetaRecord,
  ReportRecord,
  SessionRecord,
  SnapshotRecord,
} from './records';

export class MetaRepository {
  constructor(private readonly db: IntervaleDatabase) {}

  async require(): Promise<MetaRecord> {
    const record = await this.db.meta.get('meta');
    if (!record) throw new PersistenceContractError('Missing meta record');
    return record;
  }

  async put(record: MetaRecord): Promise<void> {
    await this.db.meta.put(record);
  }
}

export class GameStateRepository {
  constructor(private readonly db: IntervaleDatabase) {}

  async require(): Promise<GameStateRecord> {
    const record = await this.db.gameState.get('game');
    if (!record) throw new PersistenceContractError('Missing game-state record');
    return record;
  }

  async put(record: GameStateRecord): Promise<void> {
    await this.db.gameState.put(record);
  }
}

export class SessionRepository {
  constructor(private readonly db: IntervaleDatabase) {}

  async get(id: string): Promise<SessionRecord | undefined> {
    return this.db.sessions.get(id);
  }

  async put(record: SessionRecord): Promise<void> {
    await this.db.sessions.put(record);
  }

  async list(): Promise<SessionRecord[]> {
    return this.db.sessions.toArray();
  }

  async findUnresolved(): Promise<SessionRecord | undefined> {
    return this.db.sessions.filter((session) => session.state !== 'resolved').first();
  }

  async findRunningOrPaused(): Promise<SessionRecord | undefined> {
    return this.db.sessions
      .filter((session) => session.state === 'running' || session.state === 'paused')
      .first();
  }
}

export class ReportRepository {
  constructor(private readonly db: IntervaleDatabase) {}

  async put(record: ReportRecord): Promise<void> {
    await this.db.reports.put(record);
  }

  async listNewestFirst(): Promise<ReportRecord[]> {
    return this.db.reports.orderBy('createdAt').reverse().toArray();
  }
}

export class SnapshotRepository {
  constructor(private readonly db: IntervaleDatabase) {}

  async listNewestFirst(): Promise<SnapshotRecord[]> {
    return this.db.snapshots.orderBy('createdAt').reverse().toArray();
  }
}

export interface PersistenceRepositories {
  meta: MetaRepository;
  gameState: GameStateRepository;
  sessions: SessionRepository;
  reports: ReportRepository;
  snapshots: SnapshotRepository;
}

export function createRepositories(db: IntervaleDatabase): PersistenceRepositories {
  return {
    meta: new MetaRepository(db),
    gameState: new GameStateRepository(db),
    sessions: new SessionRepository(db),
    reports: new ReportRepository(db),
    snapshots: new SnapshotRepository(db),
  };
}
