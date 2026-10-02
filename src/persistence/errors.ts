export class PersistenceContractError extends Error {
  override name = 'PersistenceContractError';
}

export class ImportValidationError extends PersistenceContractError {
  override name = 'ImportValidationError';
}

export class UnsupportedSaveVersionError extends ImportValidationError {
  override name = 'UnsupportedSaveVersionError';
}

export class ChecksumMismatchError extends ImportValidationError {
  override name = 'ChecksumMismatchError';
}

export class ActiveMeasureError extends PersistenceContractError {
  override name = 'ActiveMeasureError';
}
