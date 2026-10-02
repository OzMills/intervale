import type { IntervaleDatabase } from '../../persistence/database';
import { PersistenceContractError } from '../../persistence/errors';

export async function bumpStateRevision(
  db: IntervaleDatabase,
  nowWallClockMs: number,
): Promise<void> {
  const meta = await db.meta.get('meta');
  if (!meta) throw new PersistenceContractError('Missing meta record');

  await db.meta.put({
    ...meta,
    stateRevision: meta.stateRevision + 1,
    lastCommittedAt: new Date(nowWallClockMs).toISOString(),
  });
}
