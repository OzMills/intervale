# ADR-006 — Multi-tab serialization with correctness-preserving fallback

**Status:** Accepted

## Decision

Use Web Locks when available for short durable mutation critical sections and BroadcastChannel for invalidation hints. Correctness also uses transactional revision/idempotency rules.

## Consequences

No long-lived lock spans a Measure. Missing optional coordination APIs cannot duplicate canonical state.
