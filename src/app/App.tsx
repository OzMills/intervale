import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router';
import { StaleStateRevisionError } from '../application/concurrency/errors';
import { recordPersistentStorageStatus } from '../application/storage/persistent-storage';
import { resolveMeasure } from '../application/resolution/resolve-measure';
import { exportSaveText, type SaveEnvelope } from '../application/save/export-save';
import { parseImportCandidate, replaceFromImport } from '../application/save/import-save';
import {
  endMeasureEarly,
  pauseMeasure,
  recoverUnresolvedMeasure,
  resumeMeasure,
} from '../application/session/session-commands';
import { startMeasure } from '../application/session/start-measure';
import {
  CUSTOM_MEASURE_MAX_MINUTES,
  CUSTOM_MEASURE_MIN_MINUTES,
  MEASURE_PRESETS_MINUTES,
} from '../domain/session/duration';
import type { SessionRecord } from '../domain/session/types';
import { initializeDatabase } from '../persistence/initialize';
import type {
  GameStateRecord,
  MetaRecord,
  PersistentStorageStatus,
  ReportRecord,
} from '../persistence/records';
import type { PwaUpdateState } from '../services/pwa/pwa-update';
import type { PersistentStorageState } from '../services/storage/persistent-storage';
import {
  focusPresentationState,
  formatClock,
  remainingWholeSeconds,
  reportEventIds,
  reportNumber,
} from './model';
import { getAppRuntime, type AppRuntime } from './runtime';
import './styles.css';

const LAST_SEEN_REPORT_KEY = 'intervale:last-seen-report-id';

interface CanonicalSnapshot {
  meta: MetaRecord;
  gameState: GameStateRecord;
  unresolvedSession: SessionRecord | null;
  sessions: SessionRecord[];
  reports: ReportRecord[];
}

function safeReadLastSeenReport(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_REPORT_KEY);
  } catch {
    return null;
  }
}

function safeWriteLastSeenReport(reportId: string): void {
  try {
    localStorage.setItem(LAST_SEEN_REPORT_KEY, reportId);
  } catch {
    // Presentation-only acknowledgement may safely fail.
  }
}

function displayError(error: unknown): string {
  if (error instanceof StaleStateRevisionError) {
    return 'The saved state changed in another tab. The latest state has been reloaded.';
  }

  if (
    error instanceof Error &&
    /checksum|structure|version|import|JSON|save/i.test(error.message)
  ) {
    return 'This save was not imported. Your current game is unchanged.';
  }

  return 'Something interrupted that action. Saved progress has been kept.';
}

function eventLabel(eventId: string): string {
  switch (eventId) {
    case 'event.test.common':
      return 'Routine test event';
    case 'event.test.tool':
      return 'Tool test event';
    case 'event.test.story':
      return 'Story test event';
    default:
      return eventId;
  }
}

async function downloadSave(snapshot: CanonicalSnapshot): Promise<void> {
  const runtime = getAppRuntime();
  const text = await exportSaveText(
    runtime.db,
    new Date(runtime.timeSource.nowWallClockMs()).toISOString(),
  );
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'intervale-save-' + snapshot.meta.stateRevision + '.json';
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function TechnicalHeader({ active }: { active: boolean }) {
  return (
    <header className="app-header">
      <div>
        <span className="brand">Intervale</span>
        <span className="build-label">Technical Spike</span>
      </div>
      {!active && (
        <nav aria-label="Primary">
          <NavLink to="/" end>
            Focus
          </NavLink>
          <NavLink to="/journal">Journal</NavLink>
        </nav>
      )}
    </header>
  );
}

function LoadingScreen() {
  return (
    <main className="panel page-panel">
      <h1>Loading local state</h1>
      <p>Preparing the Technical Spike from this device.</p>
    </main>
  );
}

function StartMeasureView({
  busy,
  onStart,
  onExport,
  onImportFile,
  pendingImport,
  onConfirmImport,
  onCancelImport,
  importBusy,
  developerAdvance,
}: {
  busy: boolean;
  onStart: (minutes: number, taskLabel: string | null) => Promise<void>;
  onExport: () => Promise<void>;
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  pendingImport: SaveEnvelope | null;
  onConfirmImport: () => Promise<void>;
  onCancelImport: () => void;
  importBusy: boolean;
  developerAdvance: ((minutes: number) => Promise<void>) | null;
}) {
  const [duration, setDuration] = useState<number>(25);
  const [customDuration, setCustomDuration] = useState('25');
  const [taskLabel, setTaskLabel] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onStart(duration, taskLabel.trim() || null);
  };

  const choosePreset = (minutes: number) => {
    setDuration(minutes);
    setCustomDuration(minutes.toString());
  };

  const customValue = Number(customDuration);
  const customValid =
    Number.isInteger(customValue) &&
    customValue >= CUSTOM_MEASURE_MIN_MINUTES &&
    customValue <= CUSTOM_MEASURE_MAX_MINUTES;

  return (
    <main className="page-grid">
      <section className="panel primary-panel" aria-labelledby="ready-heading">
        <p className="eyebrow">Focus</p>
        <h1 id="ready-heading">Ready when you are.</h1>
        <p className="lede">
          Different lengths are equally valid. Technical Spike rewards scale only with credited
          focus time.
        </p>

        <form onSubmit={submit} className="stack">
          <fieldset>
            <legend>Duration</legend>
            <div className="choice-row">
              {MEASURE_PRESETS_MINUTES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={duration === minutes ? 'choice selected' : 'choice'}
                  aria-pressed={duration === minutes}
                  onClick={() => choosePreset(minutes)}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            <label className="field">
              <span>
                Other duration, {CUSTOM_MEASURE_MIN_MINUTES}–{CUSTOM_MEASURE_MAX_MINUTES} minutes
              </span>
              <input
                type="number"
                min={CUSTOM_MEASURE_MIN_MINUTES}
                max={CUSTOM_MEASURE_MAX_MINUTES}
                step="1"
                value={customDuration}
                onChange={(event) => {
                  setCustomDuration(event.target.value);
                  const value = Number(event.target.value);
                  if (
                    Number.isInteger(value) &&
                    value >= CUSTOM_MEASURE_MIN_MINUTES &&
                    value <= CUSTOM_MEASURE_MAX_MINUTES
                  ) {
                    setDuration(value);
                  }
                }}
              />
            </label>
            {!customValid && (
              <p className="field-error" role="alert">
                Enter a whole number from {CUSTOM_MEASURE_MIN_MINUTES} to{' '}
                {CUSTOM_MEASURE_MAX_MINUTES}.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend>Activity</legend>
            <div className="summary-card">
              <strong>Technical test expedition</strong>
              <span>Primary choice: Spike site</span>
              <span>Fake content only. No production balance is implied.</span>
            </div>
          </fieldset>

          <label className="field">
            <span>
              What are you focusing on? <small>Optional, stored locally</small>
            </span>
            <input
              type="text"
              maxLength={120}
              value={taskLabel}
              onChange={(event) => setTaskLabel(event.target.value)}
            />
          </label>

          <div className="start-summary">
            <span>{duration} minutes</span>
            <span>Technical test expedition · Spike site</span>
          </div>

          <button type="submit" className="button primary-button" disabled={busy || !customValid}>
            {busy ? 'Starting…' : 'Start Measure'}
          </button>
        </form>
      </section>

      <aside className="panel secondary-panel" aria-label="Technical tools">
        <h2>Technical tools</h2>
        <div className="stack compact">
          <button className="button" type="button" onClick={onExport}>
            Export save
          </button>
          <label className="field">
            <span>Validate import</span>
            <input type="file" accept=".json,application/json" onChange={onImportFile} />
          </label>

          {pendingImport && (
            <div className="import-confirm" role="group" aria-labelledby="import-heading">
              <h3 id="import-heading">Replace current local game?</h3>
              <p>
                Valid save: {pendingImport.payload.sessions.length} sessions and{' '}
                {pendingImport.payload.reports.length} reports. A recovery snapshot will be kept
                before replacement.
              </p>
              <div className="button-row">
                <button
                  className="button danger-button"
                  type="button"
                  disabled={importBusy}
                  onClick={onConfirmImport}
                >
                  {importBusy ? 'Importing…' : 'Replace Current Game'}
                </button>
                <button className="button" type="button" onClick={onCancelImport}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {developerAdvance && (
            <div className="developer-box">
              <strong>Developer time</strong>
              <p>Available only in development builds.</p>
              <div className="choice-row">
                <button className="button" type="button" onClick={() => developerAdvance(1)}>
                  +1 min
                </button>
                <button className="button" type="button" onClick={() => developerAdvance(5)}>
                  +5 min
                </button>
                <button className="button" type="button" onClick={() => developerAdvance(25)}>
                  +25 min
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}

function ActiveMeasureView({
  session,
  nowWallClockMs,
  busy,
  onPause,
  onResume,
  onEndEarly,
  developerAdvance,
}: {
  session: SessionRecord;
  nowWallClockMs: number;
  busy: boolean;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onEndEarly: () => Promise<void>;
  developerAdvance: ((minutes: number) => Promise<void>) | null;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const paused = session.state === 'paused';
  const remaining = remainingWholeSeconds(session, nowWallClockMs);
  const dialogHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (confirmEnd) dialogHeadingRef.current?.focus();
  }, [confirmEnd]);

  return (
    <main className="focus-shell">
      <section className="panel focus-panel" aria-labelledby="focus-heading">
        <p className="eyebrow">{paused ? 'Paused' : 'Focus'}</p>
        <h1 id="focus-heading">{paused ? 'Measure paused' : 'Measure in progress'}</h1>

        <div className="timer" aria-label={Math.ceil(remaining / 60) + ' minutes remaining'}>
          {paused ? 'PAUSED' : formatClock(remaining)}
        </div>

        <p className="focus-context">Technical test expedition · Spike site</p>
        {session.taskLabel && <p className="task-label">Focus: {session.taskLabel}</p>}
        <p className="quiet-status">
          {paused
            ? 'Credited time is frozen. Closing this app keeps the Measure paused.'
            : 'Progress is being recorded. You do not need to keep this tab awake.'}
        </p>

        <div className="button-row focus-actions">
          {paused ? (
            <button
              className="button primary-button"
              type="button"
              disabled={busy}
              onClick={onResume}
            >
              Resume Measure
            </button>
          ) : (
            <button
              className="button primary-button"
              type="button"
              disabled={busy}
              onClick={onPause}
            >
              Pause
            </button>
          )}
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => setConfirmEnd(true)}
          >
            End Early
          </button>
        </div>

        {developerAdvance && !paused && (
          <div className="developer-inline">
            <span>Dev time:</span>{' '}
            <button className="text-button" type="button" onClick={() => developerAdvance(25)}>
              advance 25 min
            </button>
          </div>
        )}
      </section>

      {confirmEnd && (
        <div className="dialog-backdrop">
          <section
            className="panel dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="end-heading"
          >
            <h2 id="end-heading" tabIndex={-1} ref={dialogHeadingRef}>
              End this Measure now?
            </h2>
            <p>You&apos;ll keep progress for the time you&apos;ve focused.</p>
            <div className="button-row">
              <button
                className="button primary-button"
                type="button"
                disabled={busy}
                onClick={async () => {
                  setConfirmEnd(false);
                  await onEndEarly();
                }}
              >
                End &amp; See Report
              </button>
              <button className="button" type="button" onClick={() => setConfirmEnd(false)}>
                Keep Focusing
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function PendingResolutionView() {
  return (
    <main className="panel page-panel">
      <p className="eyebrow">Returning</p>
      <h1>Preparing your report</h1>
      <p>The Measure is complete. Canonical rewards are being committed exactly once.</p>
    </main>
  );
}

function RecoveryView({ onReload }: { onReload: () => Promise<void> }) {
  return (
    <main className="panel page-panel">
      <p className="eyebrow">Recovery</p>
      <h1>Recovery needed</h1>
      <p>
        The saved timing data needs a conservative recovery decision before more progress can be
        committed. Existing saved progress remains stored locally.
      </p>
      <p>
        The Technical Spike does not guess through ambiguous timing data. Reloading is safe and may
        clear a transient conflict.
      </p>
      <button className="button primary-button" type="button" onClick={onReload}>
        Reload saved state
      </button>
    </main>
  );
}

function ReportView({
  report,
  onStartAnother,
  onJournal,
}: {
  report: ReportRecord;
  onStartAnother: () => void;
  onJournal: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const eventIds = reportEventIds(report);
  const coins = reportNumber(report, 'rewardBundle', 'testCoins');
  const progress = reportNumber(report, 'progressDeltas', 'testProgress');

  useEffect(() => {
    headingRef.current?.focus();
  }, [report.id]);

  return (
    <main className="panel report-panel">
      <p className="eyebrow">Return</p>
      <h1 ref={headingRef} tabIndex={-1}>
        Measure complete.
      </h1>
      <p className="lede">Your focus time has already been committed. Nothing else is required.</p>

      <section aria-labelledby="report-headline" className="report-section">
        <h2 id="report-headline">Technical Spike report</h2>
        <p>
          The fake simulation resolved from {Math.floor(report.creditedSeconds / 60)} credited
          minutes.
        </p>
      </section>

      {eventIds.length > 0 && (
        <section aria-labelledby="events-heading" className="report-section">
          <h2 id="events-heading">Notable events</h2>
          <ul>
            {eventIds.slice(0, 5).map((eventId, index) => (
              <li key={eventId + ':' + index}>{eventLabel(eventId)}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="gains-heading" className="report-section">
        <h2 id="gains-heading">Compact gains</h2>
        <dl className="gains">
          <div>
            <dt>Test progress</dt>
            <dd>{progress}</dd>
          </div>
          <div>
            <dt>Test coins</dt>
            <dd>{coins}</dd>
          </div>
        </dl>
      </section>

      <div className="button-row report-actions">
        <button className="button primary-button" type="button" onClick={onStartAnother}>
          Start Another Measure
        </button>
        <button className="button" type="button" onClick={onJournal}>
          Open Journal
        </button>
      </div>

      <details className="full-log">
        <summary>Read Full Log</summary>
        <dl>
          <dt>Report ID</dt>
          <dd>{report.id}</dd>
          <dt>Credited seconds</dt>
          <dd>{report.creditedSeconds}</dd>
          <dt>Events</dt>
          <dd>{eventIds.length ? eventIds.join(', ') : 'None'}</dd>
          <dt>Result hash</dt>
          <dd>{String(report.summary.resultHash ?? 'Unavailable')}</dd>
        </dl>
      </details>
    </main>
  );
}

function JournalView({
  reports,
  sessions,
}: {
  reports: ReportRecord[];
  sessions: SessionRecord[];
}) {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  return (
    <main className="panel journal-panel">
      <p className="eyebrow">Archive</p>
      <h1>Adventure Journal</h1>
      {reports.length === 0 ? (
        <p>No journal entries yet. Complete a Measure and its report will remain here.</p>
      ) : (
        <ol className="journal-list">
          {reports.map((report) => {
            const session = sessionById.get(report.sessionId);
            const events = reportEventIds(report);

            return (
              <li key={report.id} className="journal-entry">
                <article>
                  <div className="journal-entry-header">
                    <h2>Technical Spike report</h2>
                    <time dateTime={report.createdAt}>
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(report.createdAt))}
                    </time>
                  </div>
                  <p>{Math.floor(report.creditedSeconds / 60)} credited minutes</p>
                  {session?.taskLabel && <p>Focus: {session.taskLabel}</p>}
                  <p>
                    {reportNumber(report, 'progressDeltas', 'testProgress')} test progress ·{' '}
                    {reportNumber(report, 'rewardBundle', 'testCoins')} test coins
                  </p>
                  {events.length > 0 && (
                    <details>
                      <summary>
                        {events.length} recorded event{events.length === 1 ? '' : 's'}
                      </summary>
                      <ul>
                        {events.map((eventId, index) => (
                          <li key={eventId + ':' + index}>{eventLabel(eventId)}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}

interface LoadedCanonical {
  snapshot: CanonicalSnapshot;
  newlyResolvedReport: ReportRecord | null;
}

async function loadCanonical(runtime: AppRuntime): Promise<LoadedCanonical> {
  const recovered = await recoverUnresolvedMeasure(runtime.db, runtime.timeSource, {
    writeCoordinator: runtime.writeCoordinator,
    invalidationBus: runtime.invalidationBus,
  });

  let newlyResolvedReport: ReportRecord | null = null;

  if (recovered?.state === 'readyToResolve') {
    const metaBeforeResolve = await runtime.db.meta.get('meta');
    const outcome = await resolveMeasure(runtime.db, runtime.timeSource, recovered.id, {
      expectedStateRevision: metaBeforeResolve?.stateRevision,
      writeCoordinator: runtime.writeCoordinator,
      invalidationBus: runtime.invalidationBus,
    });
    newlyResolvedReport = (await runtime.db.reports.get(outcome.reportId)) ?? null;
  }

  const [meta, gameState, unresolvedSession, sessions, reports] = await Promise.all([
    runtime.db.meta.get('meta'),
    runtime.db.gameState.get('game'),
    runtime.db.sessions.filter((candidate) => candidate.state !== 'resolved').first(),
    runtime.db.sessions.toArray(),
    runtime.db.reports.orderBy('createdAt').reverse().toArray(),
  ]);

  if (!meta || !gameState) {
    throw new Error('Local persistence did not initialise correctly');
  }

  return {
    snapshot: {
      meta,
      gameState,
      unresolvedSession: unresolvedSession ?? null,
      sessions,
      reports,
    },
    newlyResolvedReport,
  };
}

function selectActiveReport(
  current: ReportRecord | null,
  loaded: LoadedCanonical,
): ReportRecord | null {
  if (loaded.newlyResolvedReport) return loaded.newlyResolvedReport;
  if (loaded.snapshot.unresolvedSession) return null;

  if (
    current &&
    loaded.snapshot.reports.some((report) => report.id === current.id) &&
    safeReadLastSeenReport() !== current.id
  ) {
    return current;
  }

  const latest = loaded.snapshot.reports[0] ?? null;
  if (latest && safeReadLastSeenReport() !== latest.id) return latest;
  return null;
}

export function App() {
  const runtime = getAppRuntime();
  const navigate = useNavigate();
  const location = useLocation();

  const [snapshot, setSnapshot] = useState<CanonicalSnapshot | null>(null);
  const [activeReport, setActiveReport] = useState<ReportRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<SaveEnvelope | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [pwaState, setPwaState] = useState<PwaUpdateState>(runtime.pwaUpdates.getState());
  const [storageState, setStorageState] = useState<PersistentStorageState>({
    supported: false,
    persisted: null,
  });
  const [nowWallClockMs, setNowWallClockMs] = useState(runtime.timeSource.nowWallClockMs());
  const completionInFlight = useRef(false);

  const applyLoaded = (loaded: LoadedCanonical) => {
    setSnapshot(loaded.snapshot);
    setNowWallClockMs(runtime.timeSource.nowWallClockMs());
    setActiveReport((current) => selectActiveReport(current, loaded));
  };

  const syncCanonical = async () => {
    const loaded = await loadCanonical(runtime);
    applyLoaded(loaded);
    return loaded.snapshot;
  };

  const recoverAfterConflict = async (error: unknown) => {
    try {
      await syncCanonical();
    } finally {
      setErrorMessage(displayError(error));
    }
  };

  const runCommand = async (command: () => Promise<void>, successAnnouncement: string) => {
    setBusy(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      await command();
      await syncCanonical();
      setAnnouncement(successAnnouncement);
    } catch (error) {
      await recoverAfterConflict(error);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await initializeDatabase(runtime.db, {
        installationId: runtime.createId('installation'),
        nowIso: new Date(runtime.timeSource.nowWallClockMs()).toISOString(),
      });
      return loadCanonical(runtime);
    })()
      .then((loaded) => {
        if (cancelled) return;
        setSnapshot(loaded.snapshot);
        setNowWallClockMs(runtime.timeSource.nowWallClockMs());
        setActiveReport((current) => selectActiveReport(current, loaded));
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(displayError(error));
      });

    return () => {
      cancelled = true;
    };
  }, [runtime]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = runtime.pwaUpdates.subscribe(setPwaState);

    void runtime.pwaUpdates
      .start()
      .then((state) => {
        if (!cancelled) setPwaState(state);
      })
      .catch(() => {
        if (!cancelled) {
          setNotice('Offline installation is unavailable in this environment.');
        }
      });

    void runtime.persistentStorage
      .inspect()
      .then((state) => {
        if (!cancelled) setStorageState(state);
      })
      .catch(() => {
        if (!cancelled) {
          setStorageState({ supported: false, persisted: null });
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [runtime]);

  useEffect(() => {
    const unsubscribe = runtime.invalidationBus.subscribe(() => {
      void loadCanonical(runtime)
        .then((loaded) => {
          setSnapshot(loaded.snapshot);
          setNowWallClockMs(runtime.timeSource.nowWallClockMs());
          setActiveReport((current) => selectActiveReport(current, loaded));
          setNotice('Saved state updated from another tab.');
        })
        .catch((error) => setErrorMessage(displayError(error)));
    });

    return unsubscribe;
  }, [runtime]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowWallClockMs(runtime.timeSource.nowWallClockMs());
    }, 250);

    return () => window.clearInterval(interval);
  }, [runtime]);

  useEffect(() => {
    const current = snapshot?.unresolvedSession;
    if (!current || current.state !== 'running') return;
    if (remainingWholeSeconds(current, nowWallClockMs) > 0) return;

    queueMicrotask(() => {
      if (completionInFlight.current) return;
      completionInFlight.current = true;

      void loadCanonical(runtime)
        .then((loaded) => {
          setSnapshot(loaded.snapshot);
          setNowWallClockMs(runtime.timeSource.nowWallClockMs());
          setActiveReport((active) => selectActiveReport(active, loaded));
          setAnnouncement('Measure complete. Report ready.');
        })
        .catch((error) => setErrorMessage(displayError(error)))
        .finally(() => {
          completionInFlight.current = false;
        });
    });
  }, [nowWallClockMs, runtime, snapshot?.unresolvedSession]);

  useEffect(() => {
    if (snapshot?.unresolvedSession && location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate, snapshot?.unresolvedSession]);

  if (!snapshot) {
    return (
      <div className="app-shell">
        <TechnicalHeader active={false} />
        {errorMessage && (
          <div className="error-banner" role="alert">
            {errorMessage}
          </div>
        )}
        <LoadingScreen />
      </div>
    );
  }

  const session = snapshot.unresolvedSession;
  const presentation = focusPresentationState(session);
  const hasActiveMeasure = presentation !== 'ready';
  const commandOptions = {
    expectedStateRevision: snapshot.meta.stateRevision,
    writeCoordinator: runtime.writeCoordinator,
    invalidationBus: runtime.invalidationBus,
  };

  const start = async (minutes: number, taskLabel: string | null) => {
    await runCommand(async () => {
      await startMeasure(
        runtime.db,
        runtime.timeSource,
        {
          id: runtime.createId('session'),
          durationMinutes: minutes,
          activityType: 'activity.test',
          activitySnapshot: {},
          activityParameters: {},
          loadoutSnapshot: {},
          consumableSnapshot: {},
          taskLabel,
          rootSeed: runtime.createId('seed'),
          simulationVersion: 1,
        },
        commandOptions,
      );
    }, 'Measure started.');
  };

  const pause = async () => {
    if (!session) return;
    await runCommand(async () => {
      await pauseMeasure(runtime.db, runtime.timeSource, session.id, commandOptions);
    }, 'Measure paused.');
  };

  const resume = async () => {
    if (!session) return;
    await runCommand(async () => {
      await resumeMeasure(runtime.db, runtime.timeSource, session.id, commandOptions);
    }, 'Measure resumed.');
  };

  const endEarly = async () => {
    if (!session) return;
    await runCommand(async () => {
      await endMeasureEarly(runtime.db, runtime.timeSource, session.id, commandOptions);
    }, 'Measure ended. Report ready.');
  };

  const developerAdvance =
    runtime.developerAdvanceMinutes === null
      ? null
      : async (minutes: number) => {
          runtime.developerAdvanceMinutes?.(minutes);
          setNowWallClockMs(runtime.timeSource.nowWallClockMs());
          await syncCanonical();
        };

  const requestPersistentStorage = async () => {
    const observed = await runtime.persistentStorage.requestPersistence();
    setStorageState(observed);

    const status: PersistentStorageStatus = observed.supported
      ? observed.persisted
        ? 'granted'
        : 'denied'
      : 'unsupported';

    try {
      await recordPersistentStorageStatus(runtime.db, runtime.timeSource, status, commandOptions);
      await syncCanonical();
      setNotice(
        observed.persisted
          ? 'Persistent browser storage is granted for this local save.'
          : observed.supported
            ? 'The browser did not grant persistent storage. Export remains available for backup.'
            : 'Persistent storage is not available in this browser.',
      );
    } catch (error) {
      await recoverAfterConflict(error);
    }
  };

  const applyPwaUpdate = async () => {
    if (hasActiveMeasure) return;

    setBusy(true);
    try {
      const activated = await runtime.pwaUpdates.activateWaitingUpdate();
      if (activated) {
        window.location.reload();
      } else {
        setNotice('The pending update is no longer waiting.');
      }
    } catch {
      setErrorMessage('The update could not be applied. Your saved progress is unchanged.');
    } finally {
      setBusy(false);
    }
  };

  const exportCurrent = async () => {
    try {
      await downloadSave(snapshot);
      setNotice('Save export created.');
    } catch (error) {
      setErrorMessage(displayError(error));
    }
  };

  const chooseImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    try {
      setPendingImport(await parseImportCandidate(await file.text()));
    } catch (error) {
      setPendingImport(null);
      setErrorMessage(displayError(error));
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;

    setImportBusy(true);
    setErrorMessage(null);

    try {
      await runtime.writeCoordinator.withGameWrite(async () => {
        await replaceFromImport(runtime.db, pendingImport, {
          nowIso: new Date(runtime.timeSource.nowWallClockMs()).toISOString(),
          snapshotId: runtime.createId('snapshot'),
        });
      });

      const meta = await runtime.db.meta.get('meta');
      if (meta) runtime.invalidationBus.publishRevision(meta.stateRevision);

      setPendingImport(null);
      try {
        localStorage.removeItem(LAST_SEEN_REPORT_KEY);
      } catch {
        // Presentation-only acknowledgement may safely fail.
      }
      await syncCanonical();
      setNotice('Save imported. Previous local state is retained in a recovery snapshot.');
    } catch (error) {
      setErrorMessage(displayError(error));
    } finally {
      setImportBusy(false);
    }
  };

  const dismissReport = () => {
    if (activeReport) safeWriteLastSeenReport(activeReport.id);
    setActiveReport(null);
    navigate('/');
    setAnnouncement('Report saved in Journal. Ready for another Measure.');
  };

  const openJournalFromReport = () => {
    if (activeReport) safeWriteLastSeenReport(activeReport.id);
    setActiveReport(null);
    navigate('/journal');
  };

  return (
    <div className="app-shell">
      <TechnicalHeader active={hasActiveMeasure} />

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {notice && (
        <div className="notice-banner" role="status">
          {notice}
        </div>
      )}
      {errorMessage && (
        <div className="error-banner" role="alert">
          {errorMessage}
        </div>
      )}

      {pwaState.updateAvailable && !hasActiveMeasure && (
        <div className="platform-banner" role="status">
          <span>An application update is ready. Saved state is already durable.</span>
          <button className="button" type="button" disabled={busy} onClick={applyPwaUpdate}>
            Apply update
          </button>
        </div>
      )}

      {!hasActiveMeasure && !activeReport && location.pathname === '/' && (
        <section className="platform-status" aria-label="Local platform capabilities">
          <strong>Local-first status</strong>
          <p>
            Offline app shell:{' '}
            {pwaState.supported
              ? pwaState.registered
                ? 'registered'
                : 'supported'
              : import.meta.env.PROD
                ? 'unavailable'
                : 'checked in production build'}
          </p>
          <p>
            Persistent storage:{' '}
            {storageState.supported
              ? storageState.persisted
                ? 'granted'
                : 'browser-managed'
              : 'unavailable'}
          </p>
          <p>
            Completion alerts:{' '}
            {runtime.notifications.getCapabilities().immediateCompletionAlert
              ? 'available when permission is granted'
              : 'unavailable'}
            . Closed-app scheduled alerts are not guaranteed by this web build.
          </p>
          {snapshot.reports.length > 0 && storageState.supported && !storageState.persisted && (
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={requestPersistentStorage}
            >
              Protect local storage
            </button>
          )}
        </section>
      )}

      <Routes>
        <Route
          path="/"
          element={
            activeReport ? (
              <ReportView
                report={activeReport}
                onStartAnother={dismissReport}
                onJournal={openJournalFromReport}
              />
            ) : presentation === 'running' || presentation === 'paused' ? (
              session ? (
                <ActiveMeasureView
                  session={session}
                  nowWallClockMs={nowWallClockMs}
                  busy={busy}
                  onPause={pause}
                  onResume={resume}
                  onEndEarly={endEarly}
                  developerAdvance={developerAdvance}
                />
              ) : null
            ) : presentation === 'pending-resolution' ? (
              <PendingResolutionView />
            ) : presentation === 'recovery' ? (
              <RecoveryView
                onReload={async () => {
                  await syncCanonical();
                }}
              />
            ) : (
              <StartMeasureView
                busy={busy}
                onStart={start}
                onExport={exportCurrent}
                onImportFile={chooseImport}
                pendingImport={pendingImport}
                onConfirmImport={confirmImport}
                onCancelImport={() => setPendingImport(null)}
                importBusy={importBusy}
                developerAdvance={developerAdvance}
              />
            )
          }
        />
        <Route
          path="/journal"
          element={
            hasActiveMeasure ? (
              <Navigate to="/" replace />
            ) : (
              <JournalView reports={snapshot.reports} sessions={snapshot.sessions} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}