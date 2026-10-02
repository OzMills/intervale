# A Town Called Intervale

> Current project title. Formal commercial/trademark clearance remains a later gate.

This repository is prepared for the **Technical Spike**. Do not advance into production Delving, Farming, relationships, narrative content, final art, Steam packaging, cloud accounts, or other later milestones until the Production Roadmap gate passes.

## Product invariant

**Good play means leaving the game alone during a Measure.**

Nothing done during an active Measure may improve that Measure's canonical reward. Genuine focus cannot become game failure. Partial genuine focus receives proportional value. Equivalent credited focus time split into more sessions must not create meaningful power.

Read `AGENTS.md` before making changes.

## Source authority

When project sources conflict:

1. latest Design Decision Log entry
2. Master GDD v2
3. relevant specialist document
4. Production Roadmap for sequencing and gates
5. earlier audits/archives as history only

Never average conflicts or invent a third interpretation.

See `docs/design-sources.md` for authoritative source links.

## Current milestone: Technical Spike

The spike proves infrastructure and lifecycle assumptions with fake/test content:

- local-first responsive SPA/PWA shell
- one canonical active Measure
- timestamp-based reload/background recovery
- pause/resume/early end
- exactly-once resolution
- pure deterministic fake simulation
- versioned RNG substreams
- structured Cycle Reports and Journal
- IndexedDB persistence
- safe export/import and migration seams
- multi-tab concurrency correctness
- virtual clock/developer scenarios
- automated invariant, browser, migration and accessibility tests

### Explicitly out of scope

Production Delving combat, Farming, NPC relationships, real quests/economy, story chapters, final art/audio, cloud sync/accounts, server-backed push, Steam/native-mobile packaging and production analytics.

## Bootstrap environment

Pinned for I0 on 2026-10-02:

- Node 24.21.0 LTS
- pnpm 12.6.0
- React 19.3.0
- React Router 8.4.0
- Vite 8.3.2
- TypeScript 6.0.3
- Dexie 4.4.6
- Zod 4.6.5
- Zustand 5.0.15

TypeScript deliberately remains on the final 6.0.x line for the current ESLint toolchain rather than jumping to TypeScript 7 during bootstrap.

## Measure duration baseline

Per DD-041:

- presets: 15, 25, 30, 45, 50 minutes
- custom: 5–180 minutes
- one-minute increments
- no long-duration multiplier or exclusive reward

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:property
pnpm test:e2e
pnpm test:content
pnpm test:migrations
pnpm test:a11y
pnpm check
```

A passing bootstrap build is **not** a Technical Spike pass.

## Next

Implement the Technical Spike in milestone order from `docs/implementation-milestones.md`. Do not begin the Core-Loop Prototype until the Technical Spike Definition of Done and QA gate pass.
