import type { JsonObject, JsonValue } from '../domain/json';

export interface SimulationInput {
  simulationVersion: number;
  activityType: string;
  creditedSeconds: number;
  playerSnapshot: JsonObject;
  activityParameters: JsonObject;
  loadoutSnapshot: JsonObject;
  consumableSnapshot: JsonObject;
  contentVersion: string;
  rootSeed: string;
  eligibilitySnapshot?: JsonObject;
}

export interface StructuredEvent {
  eventId: string;
  familyId: string;
  sequence: number;
  payload: JsonObject;
}

export interface MutationIntent {
  type: string;
  payload: JsonObject;
}

export interface SimulationResult {
  events: StructuredEvent[];
  mutationIntents: MutationIntent[];
  rewardBundle: Record<string, number>;
  progressDeltas: Record<string, number>;
  consumableUsage: Record<string, number>;
  stateDeltas: JsonObject;
  progressSignals: string[];
  unlockSignals: string[];
  reportInputs: JsonValue[];
  diagnostics: JsonObject;
}
