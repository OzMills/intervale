import type { JsonObject } from '../../domain/json';
import { FAKE_ACTIVITY_ID, FAKE_EVENT_IDS, type FakeEventId } from '../../content/fake/registry';
import type { SimulationInput, SimulationResult, StructuredEvent } from '../contracts';
import { createRandomStream } from '../random/prng';
import { accrueFakeActivity } from './accrual';
import { readFakeActivityState } from './state';

export const FAKE_SIMULATION_VERSION = 1;
export const FAKE_CONTENT_VERSION = 'technical-spike-1';

function readReportFlavourDraws(parameters: JsonObject): number {
  const value = parameters.reportFlavourDraws;
  if (value === undefined) return 0;

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1000) {
    throw new RangeError('reportFlavourDraws must be an integer from 0 to 1000');
  }

  return value;
}

function chooseEvent(
  rootSeed: string,
  simulationVersion: number,
  drawCount: number,
): FakeEventId[] {
  const random = createRandomStream(rootSeed, simulationVersion, 'events');

  return Array.from({ length: drawCount }, () => {
    return FAKE_EVENT_IDS[random.nextInt(FAKE_EVENT_IDS.length)]!;
  });
}

function makeStructuredEvents(eventIds: readonly FakeEventId[]): StructuredEvent[] {
  return eventIds.map((eventId, index) => ({
    eventId,
    familyId: 'event.test',
    sequence: index,
    payload: {},
  }));
}

export function simulateFakeActivity(input: SimulationInput): SimulationResult {
  if (input.simulationVersion !== FAKE_SIMULATION_VERSION) {
    throw new RangeError(`Unsupported fake simulation version ${input.simulationVersion}`);
  }

  if (input.contentVersion !== FAKE_CONTENT_VERSION) {
    throw new RangeError(`Unsupported fake content version ${input.contentVersion}`);
  }

  if (input.activityType !== FAKE_ACTIVITY_ID) {
    throw new RangeError(`Unsupported fake activity ${input.activityType}`);
  }

  const previousState = readFakeActivityState(input.playerSnapshot);
  const accrual = accrueFakeActivity(input.creditedSeconds, previousState);

  const eventIds = chooseEvent(input.rootSeed, input.simulationVersion, accrual.eventCount);

  const ordinaryLoot = createRandomStream(input.rootSeed, input.simulationVersion, 'ordinaryLoot');
  const lootVariant = accrual.testCoins > 0 ? ordinaryLoot.nextInt(4) : 0;

  const reportFlavour = createRandomStream(
    input.rootSeed,
    input.simulationVersion,
    'reportFlavour',
  );
  const extraReportDraws = readReportFlavourDraws(input.activityParameters);

  for (let draw = 0; draw < extraReportDraws; draw += 1) {
    reportFlavour.nextUint32();
  }

  const reportFlavourIndex = reportFlavour.nextInt(8);

  return {
    events: makeStructuredEvents(eventIds),
    mutationIntents: [
      {
        type: 'fake.add-progress',
        payload: { amount: accrual.progressUnits },
      },
      {
        type: 'fake.add-coins',
        payload: { amount: accrual.testCoins },
      },
      {
        type: 'fake.set-accrual-state',
        payload: {
          progressRateRemainder: accrual.nextState.progressRateRemainder,
          coinRateRemainder: accrual.nextState.coinRateRemainder,
          eventRateRemainder: accrual.nextState.eventRateRemainder,
          eventBudgetMilli: accrual.nextState.eventBudgetMilli,
        },
      },
    ],
    rewardBundle: {
      testCoins: accrual.testCoins,
    },
    progressDeltas: {
      testProgress: accrual.progressUnits,
    },
    consumableUsage: {},
    stateDeltas: {
      fakeActivityState: {
        progressRateRemainder: accrual.nextState.progressRateRemainder,
        coinRateRemainder: accrual.nextState.coinRateRemainder,
        eventRateRemainder: accrual.nextState.eventRateRemainder,
        eventBudgetMilli: accrual.nextState.eventBudgetMilli,
      },
    },
    progressSignals: [],
    unlockSignals: [],
    reportInputs: [
      {
        type: 'fake-report-flavour',
        index: reportFlavourIndex,
      },
    ],
    diagnostics: {
      eventCount: accrual.eventCount,
      lootVariant,
    },
  };
}
