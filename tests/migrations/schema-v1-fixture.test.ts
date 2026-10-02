import { afterEach, describe, expect, it } from 'vitest';
import { createIntervaleDatabase } from '../../src/persistence/database';
import { initializeDatabase } from '../../src/persistence/initialize';
import { SAVE_SCHEMA_VERSION } from '../../src/persistence/versions';

const names: string[] = [];

afterEach(async () => {
  await Promise.all(
    names.splice(0).map(async (name) => {
      await indexedDB.deleteDatabase(name);
    }),
  );
});

describe('schema-v1 migration baseline fixture', () => {
  it('reopens an existing v1 save without replacing installation identity or game data', async () => {
    expect(SAVE_SCHEMA_VERSION).toBe(1);

    const name = 'migration-schema-v1';
    names.push(name);

    const first = createIntervaleDatabase(name);
    await initializeDatabase(first, {
      installationId: 'installation-original',
      nowIso: '2026-10-02T12:00:00.000Z',
    });
    await first.gameState.put({
      id: 'game',
      data: {
        testProgress: 321,
        testCoins: 17,
        fixtureMarker: 'schema-v1-baseline',
      },
    });
    first.close();

    const reopened = createIntervaleDatabase(name);
    await initializeDatabase(reopened, {
      installationId: 'installation-should-not-replace',
      nowIso: '2026-10-03T12:00:00.000Z',
    });

    expect(await reopened.meta.get('meta')).toMatchObject({
      saveSchemaVersion: 1,
      installationId: 'installation-original',
    });
    expect((await reopened.gameState.get('game'))?.data).toEqual({
      testProgress: 321,
      testCoins: 17,
      fixtureMarker: 'schema-v1-baseline',
    });

    reopened.close();
  });
});
