import { StaleStateRevisionError } from '../concurrency/errors';
import type { IntervaleDatabase } from '../../persistence/database';
import { PersistenceContractError } from '../../persistence/errors';

export async function bumpStateRevision(
  db: IntervaleDatabase,
  nowWallClockMs: number,
  expectedStateRevision?: number,
): Promise<number> {
  const meta = await db.meta.get('meta');
  if (!meta) throw new PersistenceContractError('Missing meta record');

  if (
    expectedStateRevision !== undefined &&
    meta.stateRevision !== expectedStateRevision
  ) {
    throw new StaleStateRevisionError(
      expectedStateRevision,
      meta.stateRevision,
    );
  }

  const stateRevision = meta.stateRevision + 1;

  await db.meta.put({
    ...meta,
    stateRevision,
    lastCommittedAt: new Date(nowWallClockMs).toISOString(),
  });

  return stateRevision;
}
