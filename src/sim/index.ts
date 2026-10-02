import type {
  SimulationInput,
  SimulationResult,
} from './contracts';
import { simulateFakeActivity } from './fake/simulate';
import { validateFakeSimulationResult } from './validate-result';

export function simulateActivity(
  input: SimulationInput,
): SimulationResult {
  const result = simulateFakeActivity(input);
  validateFakeSimulationResult(result);
  return result;
}
