# ADR-003 — Dexie/IndexedDB local-first persistence

**Status:** Accepted

## Decision

IndexedDB through Dexie is durable authority for prototype game/session state.

## Consequences

No separate Intervale account/backend is needed for core prototype play. Export/import and migration safety are mandatory.
