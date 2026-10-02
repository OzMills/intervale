import { z } from 'zod';
import type { JsonValue } from './records';

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }

  return false;
}

const jsonValueSchema = z.custom<JsonValue>(isJsonValue, 'Expected JSON-safe value');
const jsonObjectSchema = z.record(z.string(), jsonValueSchema);

export const gameStateRecordSchema = z.object({
  id: z.literal('game'),
  data: jsonObjectSchema,
});

export const sessionStateSchema = z.enum([
  'running',
  'paused',
  'readyToResolve',
  'resolving',
  'resolved',
  'recoveryRequired',
]);

export const sessionRecordSchema = z.object({
  id: z.string().min(1),
  state: sessionStateSchema,
  intendedDurationSeconds: z.number().int().positive(),
  activityType: z.string().min(1),
  activitySnapshot: jsonObjectSchema,
  loadoutSnapshot: jsonObjectSchema,
  consumableSnapshot: jsonObjectSchema,
  rootSeed: z.string().min(1),
  simulationVersion: z.number().int().positive(),
  contentVersion: z.string().min(1),
  schemaVersionAtStart: z.number().int().positive(),
  timing: jsonObjectSchema,
  createdAt: z.string().min(1),
  resolvedAt: z.string().min(1).nullable(),
  resultHash: z.string().min(1).nullable(),
  reportId: z.string().min(1).nullable(),
});

export const reportRecordSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  activityType: z.string().min(1),
  creditedSeconds: z.number().nonnegative(),
  createdAt: z.string().min(1),
  headlineKey: z.string().min(1),
  summary: jsonObjectSchema,
  reportInputs: z.array(jsonValueSchema),
});

export const eventLogRecordSchema = z.object({
  sequence: z.number().int().positive().optional(),
  sessionId: z.string().min(1),
  reportId: z.string().min(1).nullable(),
  eventType: z.string().min(1),
  payload: jsonObjectSchema,
});

export const migrationMetaRecordSchema = z.object({
  id: z.string().min(1),
  appliedAt: z.string().min(1),
  fromVersion: z.number().int().nonnegative(),
  toVersion: z.number().int().positive(),
});

export const savePayloadSchema = z.object({
  gameState: gameStateRecordSchema,
  sessions: z.array(sessionRecordSchema),
  reports: z.array(reportRecordSchema),
  eventLog: z.array(eventLogRecordSchema),
  migrationMeta: z.array(migrationMetaRecordSchema),
});

export const saveEnvelopeSchema = z.object({
  format: z.literal('intervale-save'),
  exportFormatVersion: z.number().int().positive(),
  saveSchemaVersion: z.number().int().positive(),
  contentVersion: z.string().min(1),
  exportedAt: z.string().min(1),
  payload: savePayloadSchema,
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
});
