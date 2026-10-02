import { describe, expect, it } from 'vitest';
import type { SimulationResult } from '../../src/sim/contracts';
import {
  SimulationInvariantError,
  validateFakeSimulationResult,
} from '../../src/sim/validate-result';

function validResult(): SimulationResult {
  return {
    events: [],
    mutationIntents: [],
    rewardBundle: { testCoins: 0 },
    progressDeltas: { testProgress: 0 },
    consumableUsage: {},
    stateDeltas: {},
    progressSignals: [],
    unlockSignals: [],
    reportInputs: [],
    diagnostics: {},
  };
}

describe('simulation invariant validation', () => {
  it('rejects negative canonical rewards', () => {
    const result = validResult();
    result.rewardBundle.testCoins = -1;

    expect(() =>
      validateFakeSimulationResult(result),
    ).toThrow(SimulationInvariantError);
  });

  it('rejects NaN in structured state', () => {
    const result = validResult();
    result.stateDeltas = { bad: Number.NaN };

    expect(() =>
      validateFakeSimulationResult(result),
    ).toThrow(SimulationInvariantError);
  });

  it('rejects missing event content IDs', () => {
    const result = validResult();
    result.events.push({
      eventId: 'event.missing',
      familyId: 'event.test',
      sequence: 0,
      payload: {},
    });

    expect(() =>
      validateFakeSimulationResult(result),
    ).toThrow(/Missing fake content ID/);
  });
});
