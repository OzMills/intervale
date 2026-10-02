# ADR-008 — injectManifest service worker and safe updates

**Status:** Accepted

## Decision

Use vite-plugin-pwa with injectManifest. The custom service worker owns only the versioned application shell and same-origin static asset availability.

A newly installed worker waits by default. The application detects a waiting worker and exposes activation only at a safe point with no running or paused Measure. Explicit activation sends `SKIP_WAITING`, then reloads after `controllerchange`.

The worker uses a manifest-derived cache name so a waiting build cannot replace the active build's offline shell before activation.

## Consequences

- Updates never force reload during RUNNING or PAUSED.
- The service worker has no imports from session, resolution, simulation or persistence code.
- Offline navigation falls back to the precached application shell.
- Canonical credited time and reward resolution remain page/application responsibilities.
- Active sessions retain their recorded simulation/content versions.
