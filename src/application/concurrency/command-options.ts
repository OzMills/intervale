import type { StateInvalidationBus } from '../../services/concurrency/invalidation-bus';
import {
  transactionFallbackWriteCoordinator,
  type WriteCoordinator,
} from '../../services/concurrency/write-coordinator';

export interface DurableCommandOptions {
  expectedStateRevision?: number;
  writeCoordinator?: WriteCoordinator;
  invalidationBus?: StateInvalidationBus;
}

export interface DurableMutationResult<T> {
  value: T;
  stateRevision: number | null;
}

export async function coordinateGameWrite<T>(
  options: DurableCommandOptions,
  operation: () => Promise<DurableMutationResult<T>>,
): Promise<T> {
  const coordinator =
    options.writeCoordinator ?? transactionFallbackWriteCoordinator;

  const result = await coordinator.withGameWrite(operation);

  if (result.stateRevision !== null) {
    options.invalidationBus?.publishRevision(result.stateRevision);
  }

  return result.value;
}
