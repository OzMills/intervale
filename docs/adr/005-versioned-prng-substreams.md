# ADR-005 — Versioned deterministic PRNG and substreams

**Status:** Accepted

## Decision

Canonical randomness uses an explicit versioned PRNG. Named subsystem substreams derive from root seed + simulation version + subsystem name.

## Consequences

Adding cosmetic random calls does not reorder other outcomes. PRNG changes require a new simulation version.
