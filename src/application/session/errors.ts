export class SessionCommandError extends Error {
  override name = 'SessionCommandError';
}

export class ActiveSessionExistsError extends SessionCommandError {
  override name = 'ActiveSessionExistsError';
}

export class SessionStateError extends SessionCommandError {
  override name = 'SessionStateError';
}

export class SessionNotFoundError extends SessionCommandError {
  override name = 'SessionNotFoundError';
}
