# Coding-agent guidance

## Authority

Implement the current milestone faithfully. Do not redesign the product to make implementation easier.

When sources conflict:

1. latest Design Decision Log entry
2. Master GDD v2
3. relevant specialist document
4. Production Roadmap for sequencing/gates
5. earlier audits/archives as history only

Do not invent a compromise.

## Do not invent canon

Do not invent consequential narrative canon, NPC history, economy rules, progression rules, UX behaviour, platform guarantees, monetisation, content names or architecture absent from governing sources.

If a missing choice does not block the current milestone, record it as a later gate and continue. If it blocks the milestone, stop that decision and surface it rather than guessing.

## Locked product rules

- Active-focus interaction cannot improve the active Measure's canonical reward.
- Genuine focused time cannot become game failure.
- Early end preserves proportional eligible value.
- Session splitting cannot create meaningful power.
- Absence causes no loss or decay.
- Breaks produce zero game power.
- Town Time is optional and cannot block another Measure.
- Reports and queued story scenes may be deferred safely.
- Story-critical progression cannot rely on unbounded RNG.
- No player death in the productivity loop.
- No backend/account merely for engineering convenience.
- No streaks, daily-login rewards, public focus leaderboard, ads, paid progression, loot boxes or conventional offline grind.

## Current scope

Build only the Technical Spike until its exit gate passes. Production Delving, Farming, social relationships, quests, final economy, final art/audio, story chapters, Steam/mobile packaging, cloud sync/accounts and production analytics are out of scope.

## Architecture boundaries

- `src/sim` is pure deterministic logic.
- `src/sim` must not import React, DOM APIs, IndexedDB/Dexie, notifications, service workers, wall-clock APIs or presentation services.
- UI never mutates Dexie directly.
- Durable mutations go through application commands/repositories.
- Durable domain state is authoritative, not Zustand or React component state.
- The service worker is never timer authority.
- Notification delivery is never reward correctness.
- An active Measure resolves against its recorded content/simulation version.

## Time rules

- Simulation receives `creditedSeconds`; it never reads clocks.
- Canonical elapsed time is reconstructed from persistent session state/timestamps, not callback counts.
- Use `TimeSource` / `VirtualTimeSource`.
- Credited time is never negative and never exceeds intended duration.
- Paused time earns nothing.
- Custom Measure baseline is 5–180 minutes, with presets 15/25/30/45/50.

## Persistence/concurrency rules

- One unresolved canonical active Measure at a time.
- Starting persists session identity before UI reports success.
- Resolution uses session ID as an idempotency key.
- Duplicate/concurrent resolution returns the committed result.
- Import validates/migrates before replacing live state.
- During RUNNING/PAUSED, read-only export is allowed but import/delete/reset is rejected.
- BroadcastChannel is a hint, never authority.
- Web Locks are preferred; correctness must survive without them.

## Randomness

- Never use `Math.random()` for canonical results.
- Derive named subsystem substreams from root seed + simulation version + subsystem name.
- Cosmetic/report random calls must not reorder other subsystem outcomes.
- Property-test failures must retain enough seed/path/version information for exact reproduction.

## Tests

For invariant-heavy work, write or update the failing test with the implementation.

High-risk coverage includes timestamp recovery, pause/reload, early end, duplicate resolution, concurrent tabs, no-Web-Locks fallback, RNG substream isolation, export/import atomicity, content/schema validation, boundary neutrality and accessibility smoke.

A flaky invariant test is a defect, not a rerun strategy.

## Change control

- `LOCKED`: requires an explicit governing design change.
- `STRONG`: change only with documented evidence/reason.
- `PROVISIONAL`: tunable while preserving governing principle.
- `OPEN`: unresolved, not permission to choose arbitrarily.

Consequential architectural deviations require an ADR. Product-rule deviations also require a Design Decision Log update.

## Working method

Prefer the smallest implementation that proves the current risk. Do not add infrastructure for hypothetical future systems. Do not expand content volume to demonstrate architecture. Keep fake spike content isolated and removable.

At milestone end report what was built, governing requirements satisfied, tests/results, platform limitations, ADRs/deviations, known bugs and recommended next action.
