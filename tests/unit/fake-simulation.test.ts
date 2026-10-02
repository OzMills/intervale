import { describe, expect, it } from 'vitest';
import type { JsonObject } from '../../src/domain/json';
import type { SimulationInput } from '../../src/sim/contracts';
import { simulateActivity } from '../../src/sim';

function input(
  creditedSeconds: number,
  playerSnapshot: JsonObject = {},
  activityParameters: JsonObject = {},
  rootSeed = 'seed',
): SimulationInput {
  return {
    simulationVersion: 1,
    activityType: 'activity.test',
    creditedSeconds,
    playerSnapshot,
    activityParameters,
    loadoutSnapshot: {},
    consumableSnapshot: {},
    contentVersion: 'technical-spike-1',
    rootSeed,
  };
}

describe('fake deterministic simulation', () => {
  it('replays identically from identical canonical input', () => {
    const canonical = input(3000);

    expect(simulateActivity(canonical)).toEqual(simulateActivity(canonical));
  });

  it('produces the documented one-FC fake accrual', () => {
    const result = simulateActivity(input(1500));

    expect(result.progressDeltas.testProgress).toBe(100);
    expect(result.rewardBundle.testCoins).toBe(10);
    expect(result.events).toHaveLength(0);
    expect(result.stateDeltas.fakeActivityState).toEqual({
      progressRateRemainder: 0,
      coinRateRemainder: 0,
      eventRateRemainder: 0,
      eventBudgetMilli: 800,
    });
  });

  it('turns two FC into one fake event with the remainder carried', () => {
    const result = simulateActivity(input(3000));

    expect(result.progressDeltas.testProgress).toBe(200);
    expect(result.rewardBundle.testCoins).toBe(20);
    expect(result.events).toHaveLength(1);
    expect((result.stateDeltas.fakeActivityState as JsonObject).eventBudgetMilli).toBe(600);
  });

  it('report-only random calls cannot alter events, rewards or progression', () => {
    const baseline = simulateActivity(input(3000));
    const extraFlavour = simulateActivity(input(3000, {}, { reportFlavourDraws: 200 }));

    expect(extraFlavour.events).toEqual(baseline.events);
    expect(extraFlavour.rewardBundle).toEqual(baseline.rewardBundle);
    expect(extraFlavour.progressDeltas).toEqual(baseline.progressDeltas);
    expect(extraFlavour.stateDeltas).toEqual(baseline.stateDeltas);
  });

  it('rejects unsupported simulation versions rather than silently replaying differently', () => {
    const unsupported = input(1500);
    unsupported.simulationVersion = 2;

    expect(() => simulateActivity(unsupported)).toThrow(/Unsupported fake simulation version/);
  });
});
