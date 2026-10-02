import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('service worker authority boundary', () => {
  it('contains shell/update behaviour but no canonical time, simulation or persistence authority', () => {
    const source = readFileSync('src/sw.ts', 'utf8');

    expect(source).toContain('__WB_MANIFEST');
    expect(source).toContain('SKIP_WAITING');
    expect(source).toContain("addEventListener('fetch'");
    expect(source).not.toMatch(/resolveMeasure|simulateActivity|Dexie|indexedDB|Date\.now|TimeSource/);
    expect(source).not.toMatch(/application\/session|application\/resolution|sim\//);
  });
});
