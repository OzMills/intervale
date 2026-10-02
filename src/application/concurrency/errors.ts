export class StaleStateRevisionError extends Error {
  override name = 'StaleStateRevisionError';

  constructor(
    readonly expectedStateRevision: number,
    readonly actualStateRevision: number,
  ) {
    super(
      `State revision is stale: expected ${expectedStateRevision}, current ${actualStateRevision}`,
    );
  }
}
