# ADR-004 — Timestamp-based session reconstruction

**Status:** Accepted

## Decision

Canonical credited time derives from persistent session state and timestamps/segments, not JavaScript timer callback frequency.

## Consequences

Background throttling and tab closure cannot invalidate session correctness.
