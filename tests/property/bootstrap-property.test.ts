import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('property-test harness', () => {
  it('runs deterministic generated inputs', () => {
    fc.assert(
      fc.property(fc.integer(), (value) => {
        expect(Number.isInteger(value)).toBe(true);
      }),
    );
  });
});
