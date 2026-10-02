# ADR-002 — Pure deterministic simulation boundary

**Status:** Accepted

## Decision

Canonical activity simulation is pure and receives explicit input, credited time, content/version data and seed. It performs no persistence, DOM, navigation, audio, notification or analytics work.

## Consequences

Deterministic replay and property testing are first-class.
