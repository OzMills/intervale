import type { JsonObject } from '../../domain/json';
import type { SimulationResult } from '../../sim/contracts';
import { ResolutionIntegrityError } from './errors';

function readNonnegativeNumber(state: JsonObject, key: string): number {
  const value = state[key];
  if (value === undefined) return 0;

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ResolutionIntegrityError(`Canonical game-state field ${key} is invalid`);
  }

  return value;
}

export function applyFakeSimulationResult(
  current: JsonObject,
  result: SimulationResult,
): JsonObject {
  const progress =
    readNonnegativeNumber(current, 'testProgress') + (result.progressDeltas.testProgress ?? 0);
  const coins = readNonnegativeNumber(current, 'testCoins') + (result.rewardBundle.testCoins ?? 0);

  const next: JsonObject = {
    ...current,
    testProgress: progress,
    testCoins: coins,
  };

  const accrualState = result.stateDeltas.fakeActivityState;
  if (accrualState !== undefined) {
    next.fakeActivityState = accrualState;
  }

  return next;
}
