import type { JsonValue } from '../persistence/records';

function canonicalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalize);

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, child]) => [key, canonicalize(child)]));
  }

  return value;
}

export async function sha256Json(value: JsonValue): Promise<string> {
  const canonical = JSON.stringify(canonicalize(value));
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
