export interface TimeSource {
  nowWallClockMs(): number;
  nowMonotonicMs(): number;
}

export class BrowserTimeSource implements TimeSource {
  nowWallClockMs(): number {
    return Date.now();
  }

  nowMonotonicMs(): number {
    return performance.now();
  }
}

export class VirtualTimeSource implements TimeSource {
  constructor(
    private wallClockMs = 0,
    private monotonicMs = 0,
  ) {
    this.assertFinite(this.wallClockMs, 'wallClockMs');
    this.assertFinite(this.monotonicMs, 'monotonicMs');
  }

  nowWallClockMs(): number {
    return this.wallClockMs;
  }

  nowMonotonicMs(): number {
    return this.monotonicMs;
  }

  setWallClockMs(value: number): void {
    this.assertFinite(value, 'wallClockMs');
    this.wallClockMs = value;
  }

  advanceWallClockMs(deltaMs: number): void {
    this.assertFinite(deltaMs, 'deltaMs');
    this.wallClockMs += deltaMs;
  }

  advanceMonotonicMs(deltaMs: number): void {
    this.assertFinite(deltaMs, 'deltaMs');
    if (deltaMs < 0) throw new RangeError('Monotonic time cannot move backwards');
    this.monotonicMs += deltaMs;
  }

  advanceBothMs(deltaMs: number): void {
    this.assertFinite(deltaMs, 'deltaMs');
    if (deltaMs < 0) throw new RangeError('Use advanceWallClockMs to simulate a backward wall clock');
    this.wallClockMs += deltaMs;
    this.monotonicMs += deltaMs;
  }

  resetMonotonicClock(value = 0): void {
    this.assertFinite(value, 'monotonicMs');
    if (value < 0) throw new RangeError('Monotonic time cannot be negative');
    this.monotonicMs = value;
  }

  private assertFinite(value: number, name: string): void {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  }
}
