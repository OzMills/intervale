# ADR-008 — injectManifest service worker and safe updates

**Status:** Accepted

## Decision

Use vite-plugin-pwa with injectManifest. The service worker owns application-shell/static-asset availability only.

## Consequences

Updates never force reload during RUNNING/PAUSED and cannot change an active Measure's simulation meaning.
