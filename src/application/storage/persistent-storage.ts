import type { DurableCommandOptions } from '../concurrency/command-options';
import { coordinateGameWrite } from '../concurrency/command-options';
import type { IntervaleDatabase } from '../../persistence/database';
import { PersistenceContractError } from '../../persistence/errors';
import type { PersistentStorageStatus } from '../../persistence/records';
import type { TimeSource } from '../../services/time/time-source';
import { bumpStateRevision } from '../session/meta';

export async function recordPersistentStorageStatus(
  db: IntervaleDatabase,
  timeSource: TimeSource,
  status: PersistentStorageStatus,
  options: DurableCommandOptions = {},
): Promise<void> {
  await coordinateGameWrite(options, () =>
    db.transaction('rw', db.meta, async () => {
      const meta = await db.meta.get('meta');
      if (!meta) throw new PersistenceContractError('Missing meta record');

      if (meta.persistentStorageStatus === status) {
        return { value: undefined, stateRevision: null };
      }

      await db.meta.put({
        ...meta,
        persistentStorageStatus: status,
      });

      const stateRevision = await bumpStateRevision(
        db,
        timeSource.nowWallClockMs(),
        options.expectedStateRevision,
      );

      return { value: undefined, stateRevision };
    }),
  );
}
