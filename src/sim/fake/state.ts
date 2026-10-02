import type { JsonObject } from '../../domain/json';

export interface FakeActivityState {
  progressRateRemainder: number;
  coinRateRemainder: number;
  eventRateRemainder: number;
  eventBudgetMilli: number;
}

export const EMPTY_FAKE_ACTIVITY_STATE: FakeActivityState = {
  progressRateRemainder: 0,
  coinRateRemainder: 0,
  eventRateRemainder: 0,
  eventBudgetMilli: 0,
};

function integerInRange(
  value: unknown,
  minimum: number,
  maximumExclusive: number,
): value is number {
  return (
    Number.isInteger(value) &&
    typeof value === 'number' &&
    value >= minimum &&
    value < maximumExclusive
  );
}

export function readFakeActivityState(
  playerSnapshot: JsonObject,
): FakeActivityState {
  const raw = playerSnapshot.fakeActivityState;
  if (raw === undefined) return { ...EMPTY_FAKE_ACTIVITY_STATE };

  if (raw === null || Array.isArray(raw) || typeof raw !== 'object') {
    throw new TypeError('fakeActivityState must be an object');
  }

  const state = raw as Record<string, unknown>;

  if (
    !integerInRange(state.progressRateRemainder, 0, 1500) ||
    !integerInRange(state.coinRateRemainder, 0, 1500) ||
    !integerInRange(state.eventRateRemainder, 0, 15) ||
    !integerInRange(state.eventBudgetMilli, 0, 1000)
  ) {
    throw new RangeError('fakeActivityState contains an invalid remainder');
  }

  return {
    progressRateRemainder: state.progressRateRemainder,
    coinRateRemainder: state.coinRateRemainder,
    eventRateRemainder: state.eventRateRemainder,
    eventBudgetMilli: state.eventBudgetMilli,
  };
}
