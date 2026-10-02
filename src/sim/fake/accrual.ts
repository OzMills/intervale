import type { FakeActivityState } from './state';

export interface FakeAccrualResult {
  progressUnits: number;
  testCoins: number;
  eventCount: number;
  nextState: FakeActivityState;
}

function accrueRate(
  creditedSeconds: number,
  unitsPerFocusCredit: number,
  previousRemainder: number,
): { units: number; remainder: number } {
  const numerator = creditedSeconds * unitsPerFocusCredit + previousRemainder;

  return {
    units: Math.floor(numerator / 1500),
    remainder: numerator % 1500,
  };
}

export function accrueFakeActivity(
  creditedSeconds: number,
  previous: FakeActivityState,
): FakeAccrualResult {
  if (!Number.isInteger(creditedSeconds) || creditedSeconds < 0) {
    throw new RangeError('creditedSeconds must be a nonnegative integer');
  }

  const progress = accrueRate(creditedSeconds, 100, previous.progressRateRemainder);
  const coins = accrueRate(creditedSeconds, 10, previous.coinRateRemainder);

  // 0.8 event points / FC = 800 milli-event points / 1500 seconds.
  // Reduced ratio: 8 milli-event points / 15 seconds.
  const eventRateNumerator = creditedSeconds * 8 + previous.eventRateRemainder;
  const earnedEventMilli = Math.floor(eventRateNumerator / 15);
  const eventRateRemainder = eventRateNumerator % 15;

  const eventBudgetMilli = previous.eventBudgetMilli + earnedEventMilli;
  const eventCount = Math.floor(eventBudgetMilli / 1000);

  return {
    progressUnits: progress.units,
    testCoins: coins.units,
    eventCount,
    nextState: {
      progressRateRemainder: progress.remainder,
      coinRateRemainder: coins.remainder,
      eventRateRemainder,
      eventBudgetMilli: eventBudgetMilli % 1000,
    },
  };
}
