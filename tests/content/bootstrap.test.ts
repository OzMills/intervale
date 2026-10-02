import { describe, expect, it } from 'vitest';

describe('content test harness', () => {
  it('is wired for later schema validation', () => {
    expect('event.test.common').toMatch(/^event\./);
  });
});
