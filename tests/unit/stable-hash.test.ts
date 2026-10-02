import { describe, expect, it } from 'vitest';
import { stableResolutionHash } from '../../src/services/stable-hash';

describe('stable resolution hash', () => {
  it('ignores object key insertion order', () => {
    expect(
      stableResolutionHash({
        alpha: 1,
        beta: { x: 2, y: 3 },
      }),
    ).toBe(
      stableResolutionHash({
        beta: { y: 3, x: 2 },
        alpha: 1,
      }),
    );
  });

  it('changes when canonical data changes', () => {
    expect(
      stableResolutionHash({ value: 1 }),
    ).not.toBe(
      stableResolutionHash({ value: 2 }),
    );
  });
});
