export class ResolutionError extends Error {
  override name = 'ResolutionError';
}

export class ResolutionStateError extends ResolutionError {
  override name = 'ResolutionStateError';
}

export class ResolutionIntegrityError extends ResolutionError {
  override name = 'ResolutionIntegrityError';
}
