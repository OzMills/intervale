import type { IntervaleDatabase } from './database';
import type { GameStateRecord, MetaRecord } from './records';
import { SAVE_SCHEMA_VERSION, TECHNICAL_SPIKE_CONTENT_VERSION } from './versions';

export interface InitializeDatabaseInput {
  installationId: string;
  nowIso: string;
}

export async function initializeDatabase(
  db: IntervaleDatabase,
  input: InitializeDatabaseInput,
): Promise<void> {
  await db.transaction('rw', db.meta, db.gameState, async () => {
    const existingMeta = await db.meta.get('meta');
    if (!existingMeta) {
      const meta: MetaRecord = {
        id: 'meta',
        saveSchemaVersion: SAVE_SCHEMA_VERSION,
        contentVersion: TECHNICAL_SPIKE_CONTENT_VERSION,
        installationId: input.installationId,
        stateRevision: 0,
        createdAt: input.nowIso,
        lastCommittedAt: input.nowIso,
        persistentStorageStatus: 'unknown',
      };
      await db.meta.add(meta);
    }

    const existingGameState = await db.gameState.get('game');
    if (!existingGameState) {
      const gameState: GameStateRecord = { id: 'game', data: {} };
      await db.gameState.add(gameState);
    }
  });
}
