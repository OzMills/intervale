import type { JsonValue } from '../domain/json';

export const RESOLUTION_HASH_FORMAT_VERSION = 1;

function canonicalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));

    return Object.fromEntries(entries.map(([key, child]) => [key, canonicalize(child)]));
  }

  return value;
}

function fnv1a32(value: string, offset: number): number {
  let hash = offset >>> 0;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function stableResolutionHash(value: JsonValue): string {
  const canonical = JSON.stringify({
    hashFormatVersion: RESOLUTION_HASH_FORMAT_VERSION,
    value: canonicalize(value),
  });

  const first = fnv1a32(canonical, 0x811c9dc5);
  const second = fnv1a32(`intervale-resolution|${canonical}`, 0x9e3779b9);

  return `r${RESOLUTION_HASH_FORMAT_VERSION}:${first.toString(16).padStart(8, '0')}${second
    .toString(16)
    .padStart(8, '0')}`;
}
