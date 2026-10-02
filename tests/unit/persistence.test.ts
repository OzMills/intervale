import { afterEach, describe, expect, it } from 'vitest';
import { createSaveEnvelope, exportSaveText } from '../../src/application/save/export-save';
import { parseImportCandidate, replaceFromImport } from '../../src/application/save/import-save';
import { createIntervaleDatabase } from '../../src/persistence/database';
import { ActiveMeasureError, ChecksumMismatchError } from '../../src/persistence/errors';
import { initializeDatabase } from '../../src/persistence/initialize';
import type { SessionRecord } from '../../src/persistence/records';

const openDatabases: ReturnType<typeof createIntervaleDatabase>[] = [];

function database(name: string) {
  const db = createIntervaleDatabase(name);
  openDatabases.push(db);
  return db;
}

afterEach(async () => {
  await Promise.all(
    openDatabases.splice(0).map(async (db) => {
      const name = db.name;
      db.close();
      await indexedDB.deleteDatabase(name);
    }),
  );
});

describe('persistence foundation', () => {
  it('initialises singleton metadata and game state without inventing gameplay state', async () => {
    const db = database('init-test');
    await initializeDatabase(db, {
      installationId: 'install-1',
      nowIso: '2026-10-02T12:00:00.000Z',
    });

    expect(await db.meta.get('meta')).toMatchObject({
      installationId: 'install-1',
      stateRevision: 0,
      persistentStorageStatus: 'unknown',
    });
    expect(await db.gameState.get('game')).toEqual({ id: 'game', data: {} });
  });

  it('exports game data without installation identifiers', async () => {
    const db = database('export-test');
    await initializeDatabase(db, {
      installationId: 'private-installation-id',
      nowIso: '2026-10-02T12:00:00.000Z',
    });
    await db.gameState.put({ id: 'game', data: { marker: 'exported' } });

    const text = await exportSaveText(db, '2026-10-02T13:00:00.000Z');
    const parsed = await parseImportCandidate(text);

    expect(text).not.toContain('private-installation-id');
    expect(parsed.format).toBe('intervale-save');
    expect(parsed.payload.gameState.data).toEqual({ marker: 'exported' });
  });

  it('detects payload tampering', async () => {
    const db = database('checksum-test');
    await initializeDatabase(db, {
      installationId: 'install',
      nowIso: '2026-10-02T12:00:00.000Z',
    });
    const envelope = await createSaveEnvelope(db, '2026-10-02T13:00:00.000Z');
    envelope.payload.gameState.data = { changed: true };

    await expect(parseImportCandidate(JSON.stringify(envelope))).rejects.toBeInstanceOf(
      ChecksumMismatchError,
    );
  });

  it('replaces data atomically while preserving destination installation identity', async () => {
    const source = database('source-test');
    const target = database('target-test');

    await initializeDatabase(source, {
      installationId: 'source-install',
      nowIso: '2026-10-02T12:00:00.000Z',
    });
    await source.gameState.put({ id: 'game', data: { marker: 'imported' } });

    await initializeDatabase(target, {
      installationId: 'target-install',
      nowIso: '2026-10-02T12:00:00.000Z',
    });
    await target.gameState.put({ id: 'game', data: { marker: 'previous' } });

    const candidate = await parseImportCandidate(
      await exportSaveText(source, '2026-10-02T13:00:00.000Z'),
    );

    await replaceFromImport(target, candidate, {
      nowIso: '2026-10-02T14:00:00.000Z',
      snapshotId: 'snapshot-1',
    });

    expect((await target.meta.get('meta'))?.installationId).toBe('target-install');
    expect((await target.meta.get('meta'))?.stateRevision).toBe(1);
    expect((await target.gameState.get('game'))?.data).toEqual({ marker: 'imported' });
    expect((await target.snapshots.get('snapshot-1'))?.payload.gameState.data).toEqual({
      marker: 'previous',
    });
  });

  it('rejects destructive import while the local Measure is running', async () => {
    const source = database('active-source-test');
    const target = database('active-target-test');

    await initializeDatabase(source, {
      installationId: 'source',
      nowIso: '2026-10-02T12:00:00.000Z',
    });
    await initializeDatabase(target, {
      installationId: 'target',
      nowIso: '2026-10-02T12:00:00.000Z',
    });

    const running: SessionRecord = {
      id: 'session-active',
      state: 'running',
      intendedDurationSeconds: 1500,
      activityType: 'activity.test',
      activitySnapshot: {},
      loadoutSnapshot: {},
      consumableSnapshot: {},
      rootSeed: 'seed',
      simulationVersion: 1,
      contentVersion: 'technical-spike-1',
      schemaVersionAtStart: 1,
      timing: {},
      createdAt: '2026-10-02T12:00:00.000Z',
      resolvedAt: null,
      resultHash: null,
      reportId: null,
    };
    await target.sessions.put(running);

    const candidate = await parseImportCandidate(
      await exportSaveText(source, '2026-10-02T13:00:00.000Z'),
    );

    await expect(
      replaceFromImport(target, candidate, {
        nowIso: '2026-10-02T14:00:00.000Z',
        snapshotId: 'blocked',
      }),
    ).rejects.toBeInstanceOf(ActiveMeasureError);

    expect(await target.sessions.get('session-active')).toEqual(running);
    expect(await target.snapshots.count()).toBe(0);
  });
});
