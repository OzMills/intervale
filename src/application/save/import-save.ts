import type { IntervaleDatabase } from '../../persistence/database';
import {
  ActiveMeasureError,
  ChecksumMismatchError,
  ImportValidationError,
  PersistenceContractError,
  UnsupportedSaveVersionError,
} from '../../persistence/errors';
import {
  type JsonValue,
  type SavePayload,
  type SnapshotRecord,
} from '../../persistence/records';
import { readSavePayloadInsideTransaction } from '../../persistence/payload';
import { saveEnvelopeSchema } from '../../persistence/schemas';
import {
  DEFAULT_SNAPSHOT_RETENTION,
  EXPORT_FORMAT_VERSION,
  MAX_IMPORT_BYTES,
  SAVE_SCHEMA_VERSION,
  TECHNICAL_SPIKE_CONTENT_VERSION,
} from '../../persistence/versions';
import { sha256Json } from '../../services/checksum';
import type { SaveEnvelope } from './export-save';

function assertUniqueIds(name: string, ids: string[]): void {
  if (new Set(ids).size !== ids.length) {
    throw new ImportValidationError(`Duplicate ${name} id`);
  }
}

function validatePayloadSemantics(payload: SavePayload): void {
  assertUniqueIds('session', payload.sessions.map((record) => record.id));
  assertUniqueIds('report', payload.reports.map((record) => record.id));
  assertUniqueIds('migration', payload.migrationMeta.map((record) => record.id));

  const unresolved = payload.sessions.filter((session) => session.state !== 'resolved');
  if (unresolved.length > 1) {
    throw new ImportValidationError('Save contains more than one unresolved session');
  }

  const sessionIds = new Set(payload.sessions.map((session) => session.id));
  for (const report of payload.reports) {
    if (!sessionIds.has(report.sessionId)) {
      throw new ImportValidationError(`Report ${report.id} references missing session`);
    }
  }
}

export async function parseImportCandidate(text: string): Promise<SaveEnvelope> {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    throw new ImportValidationError('Save file exceeds import size limit');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportValidationError('Save is not valid JSON');
  }

  const result = saveEnvelopeSchema.safeParse(parsed);
  if (!result.success) throw new ImportValidationError('Save structure is invalid');

  const envelope = result.data as SaveEnvelope;

  if (
    envelope.exportFormatVersion !== EXPORT_FORMAT_VERSION ||
    envelope.saveSchemaVersion !== SAVE_SCHEMA_VERSION
  ) {
    throw new UnsupportedSaveVersionError('No migration path exists for this save version');
  }

  if (envelope.contentVersion !== TECHNICAL_SPIKE_CONTENT_VERSION) {
    throw new UnsupportedSaveVersionError('Save content version is not compatible with this build');
  }

  validatePayloadSemantics(envelope.payload);

  const checksum = await sha256Json(envelope.payload as unknown as JsonValue);
  if (checksum !== envelope.checksum) {
    throw new ChecksumMismatchError('Save checksum does not match payload');
  }

  return envelope;
}

export interface ReplaceFromImportInput {
  nowIso: string;
  snapshotId: string;
  snapshotRetention?: number;
}

export async function replaceFromImport(
  db: IntervaleDatabase,
  candidate: SaveEnvelope,
  input: ReplaceFromImportInput,
): Promise<void> {
  const retention = input.snapshotRetention ?? DEFAULT_SNAPSHOT_RETENTION;
  if (!Number.isInteger(retention) || retention < 1) {
    throw new PersistenceContractError('Snapshot retention must be a positive integer');
  }

  await db.transaction(
    'rw',
    [
      db.meta,
      db.gameState,
      db.sessions,
      db.reports,
      db.eventLog,
      db.snapshots,
      db.migrationMeta,
    ],
    async () => {
      const meta = await db.meta.get('meta');
      if (!meta) throw new PersistenceContractError('Missing meta record');

      const active = await db.sessions
        .filter((session) => session.state === 'running' || session.state === 'paused')
        .first();
      if (active) {
        throw new ActiveMeasureError('Import is unavailable while a Measure is running or paused');
      }

      const previousPayload = await readSavePayloadInsideTransaction(db);
      const recoverySnapshot: SnapshotRecord = {
        id: input.snapshotId,
        createdAt: input.nowIso,
        reason: 'import-recovery',
        payload: previousPayload,
      };
      await db.snapshots.put(recoverySnapshot);

      await Promise.all([
        db.gameState.clear(),
        db.sessions.clear(),
        db.reports.clear(),
        db.eventLog.clear(),
        db.migrationMeta.clear(),
      ]);

      await db.gameState.put(candidate.payload.gameState);
      await db.sessions.bulkPut(candidate.payload.sessions);
      await db.reports.bulkPut(candidate.payload.reports);
      await db.eventLog.bulkPut(candidate.payload.eventLog);
      await db.migrationMeta.bulkPut(candidate.payload.migrationMeta);

      await db.meta.put({
        ...meta,
        saveSchemaVersion: candidate.saveSchemaVersion,
        contentVersion: candidate.contentVersion,
        stateRevision: meta.stateRevision + 1,
        lastCommittedAt: input.nowIso,
      });

      const snapshots = await db.snapshots.orderBy('createdAt').toArray();
      const excess = snapshots.length - retention;
      if (excess > 0) {
        await db.snapshots.bulkDelete(snapshots.slice(0, excess).map((snapshot) => snapshot.id));
      }
    },
  );
}
