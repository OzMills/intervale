# Technical Spike implementation milestones

Do not reorder these merely to build more visible UI sooner.

## I0 — Bootstrap

Package/runtime pinning, Vite/React/TypeScript shell, lint/format/typecheck/test runners, routing and PWA skeleton.

## I1 — Persistence

Dexie schema, repository layer, meta/version record, snapshot/export/import skeleton.

## I2 — Time and session

TimeSource, VirtualTimeSource, session records, start/pause/resume/end/recovery.

## I3 — Concurrency

Web Locks adapter, transactional fallback and BroadcastChannel invalidation.

## I4 — Deterministic fake simulation

Versioned PRNG/substreams, fake activity, structured events and invariant validator.

## I5 — Exactly-once resolution

Transactional resolveMeasure, result hash and committed report.

## I6 — Spike UI

Start, Running, Pause, Early End, Report, Journal, Settings and recovery states.

## I7 — PWA/capabilities

Offline shell, update-safe service worker, honest notification/storage capability surfaces.

## I8 — Adversarial QA

Cross-browser, multi-tab, reload/background, import/export, migrations, accessibility smoke and boundary-neutrality suite.

## Exit gate

Do not begin Core-Loop Prototype content until the Technical Spike Definition of Done and QA gate pass. Record results and limitations first.
