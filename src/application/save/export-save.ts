import type { IntervaleDatabase } from '../../persistence/database';
import type { JsonValue } from '../../persistence/records';
import { readSavePayload } from '../../persistence/payload';
import {
  EXPORT_FORMAT_VERSION,
  SAVE_SCHEMA_VERSION,
  TECHNICAL_SPIKE_CONTENT_VERSION,
} from '../../persistence/versions';
import { sha256Json } from '../../services/checksum';

export interface SaveEnvelope {
  format: 'intervale-save';
  exportFormatVersion: number;
  saveSchemaVersion: number;
  contentVersion: string;
  exportedAt: string;
  payload: Awaited<ReturnType<typeof readSavePayload>>;
  checksum: string;
}

export async function createSaveEnvelope(
  db: IntervaleDatabase,
  exportedAt: string,
): Promise<SaveEnvelope> {
  const payload = await readSavePayload(db);
  const checksum = await sha256Json(payload as unknown as JsonValue);

  return {
    format: 'intervale-save',
    exportFormatVersion: EXPORT_FORMAT_VERSION,
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    contentVersion: TECHNICAL_SPIKE_CONTENT_VERSION,
    exportedAt,
    payload,
    checksum,
  };
}

export async function exportSaveText(db: IntervaleDatabase, exportedAt: string): Promise<string> {
  return JSON.stringify(await createSaveEnvelope(db, exportedAt), null, 2);
}
