export const MEASURE_PRESETS_MINUTES = [15, 25, 30, 45, 50] as const;
export const CUSTOM_MEASURE_MIN_MINUTES = 5;
export const CUSTOM_MEASURE_MAX_MINUTES = 180;

export function isSupportedMeasureDurationMinutes(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= CUSTOM_MEASURE_MIN_MINUTES &&
    minutes <= CUSTOM_MEASURE_MAX_MINUTES
  );
}

export function measureDurationSeconds(minutes: number): number {
  if (!isSupportedMeasureDurationMinutes(minutes)) {
    throw new RangeError(
      `Measure duration must be an integer from ${CUSTOM_MEASURE_MIN_MINUTES} to ${CUSTOM_MEASURE_MAX_MINUTES} minutes`,
    );
  }

  return minutes * 60;
}
