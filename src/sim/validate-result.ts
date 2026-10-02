import { isFakeContentId } from '../content/fake/registry';
import type { JsonValue } from '../domain/json';
import type { SimulationResult } from './contracts';

export class SimulationInvariantError extends Error {
  override name = 'SimulationInvariantError';
}

function assertFiniteJson(value: JsonValue, path: string): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new SimulationInvariantError(`Non-finite number at ${path}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((child, index) => assertFiniteJson(child, `${path}[${index}]`));
    return;
  }

  if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => assertFiniteJson(child, `${path}.${key}`));
  }
}

function assertNonnegativeRecord(record: Record<string, number>, name: string): void {
  Object.entries(record).forEach(([key, value]) => {
    if (!Number.isFinite(value) || value < 0) {
      throw new SimulationInvariantError(`${name}.${key} must be finite and nonnegative`);
    }
  });
}

export function validateFakeSimulationResult(result: SimulationResult): void {
  assertNonnegativeRecord(result.rewardBundle, 'rewardBundle');
  assertNonnegativeRecord(result.progressDeltas, 'progressDeltas');
  assertNonnegativeRecord(result.consumableUsage, 'consumableUsage');

  result.events.forEach((event) => {
    if (!isFakeContentId(event.eventId)) {
      throw new SimulationInvariantError(`Missing fake content ID ${event.eventId}`);
    }
  });

  assertFiniteJson(result.stateDeltas, 'stateDeltas');
  assertFiniteJson(result.reportInputs, 'reportInputs');
  assertFiniteJson(result.diagnostics, 'diagnostics');
}
