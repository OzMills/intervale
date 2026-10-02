import { describe, expect, it } from 'vitest';
import { VirtualTimeSource } from '../../src/services/time/time-source';

describe('VirtualTimeSource', () => {
  it('advances wall and monotonic clocks independently', () => {
    const time = new VirtualTimeSource(10_000, 500);

    time.advanceWallClockMs(2_000);
    expect(time.nowWallClockMs()).toBe(12_000);
    expect(time.nowMonotonicMs()).toBe(500);

    time.advanceMonotonicMs(250);
    expect(time.nowMonotonicMs()).toBe(750);
  });

  it('simulates reload by resetting monotonic time without changing wall time', () => {
    const time = new VirtualTimeSource(20_000, 5_000);
    time.resetMonotonicClock();

    expect(time.nowWallClockMs()).toBe(20_000);
    expect(time.nowMonotonicMs()).toBe(0);
  });

  it('allows the wall clock to move backwards but not monotonic time', () => {
    const time = new VirtualTimeSource(20_000, 5_000);
    time.advanceWallClockMs(-10_000);

    expect(time.nowWallClockMs()).toBe(10_000);
    expect(() => time.advanceMonotonicMs(-1)).toThrow(RangeError);
  });
});
