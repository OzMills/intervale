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

async function coordinateWrite<T>(
  options: DurableCommandOptions,
  operation: () => Promise<DurableMutationResult<T>>,
  run: (
    coordinator: WriteCoordinator,
    task: () => Promise<DurableMutationResult<T>>,
  ) => Promise<DurableMutationResult<T>>,
): Promise<T> {
  const coordinator = options.writeCoordinator ?? transactionFallbackWriteCoordinator;

  const result = await run(coordinator, operation);

  if (result.stateRevision !== null) {
    options.invalidationBus?.publishRevision(result.stateRevision);
  }

  return result.value;
}

export function coordinateGameWrite<T>(
  options: DurableCommandOptions,
  operation: () => Promise<DurableMutationResult<T>>,
): Promise<T> {
  return coordinateWrite(options, operation, (coordinator, task) =>
    coordinator.withGameWrite(task),
  );
}

export function coordinateSessionResolution<T>(
  options: DurableCommandOptions,
  operation: () => Promise<DurableMutationResult<T>>,
): Promise<T> {
  return coordinateWrite(options, operation, (coordinator, task) =>
    coordinator.withSessionResolution(task),
  );
}
