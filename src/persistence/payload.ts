import type { IntervaleDatabase } from './database';
import { PersistenceContractError } from './errors';
import type { SavePayload } from './records';

export async function readSavePayload(db: IntervaleDatabase): Promise<SavePayload> {
  return db.transaction(
    'r',
    db.gameState,
    db.sessions,
    db.reports,
    db.eventLog,
    db.migrationMeta,
    async () => readSavePayloadInsideTransaction(db),
  );
}

export async function readSavePayloadInsideTransaction(
  db: IntervaleDatabase,
): Promise<SavePayload> {
  const gameState = await db.gameState.get('game');
  if (!gameState) throw new PersistenceContractError('Missing game-state record');

  const [sessions, reports, eventLog, migrationMeta] = await Promise.all([
    db.sessions.toArray(),
    db.reports.toArray(),
    db.eventLog.orderBy('sequence').toArray(),
    db.migrationMeta.toArray(),
  ]);

  return { gameState, sessions, reports, eventLog, migrationMeta };
}
