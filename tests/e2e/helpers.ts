import type { Page } from '@playwright/test';

interface StoredSession {
  id: string;
  state: string;
  startedAtWallClockMs: number;
  currentRunningStartedAtWallClockMs: number | null;
  completedRunningSegments: Array<{ creditedSeconds: number }>;
}

async function withIntervaleDatabase<T>(
  page: Page,
  operation: 'age-running' | 'read-sessions' | 'count-sessions',
  argument?: number,
): Promise<T> {
  return page.evaluate(
    async ({ operation, argument }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('intervale');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
      });

      try {
        if (operation === 'read-sessions') {
          return await new Promise<unknown>((resolve, reject) => {
            const transaction = db.transaction('sessions', 'readonly');
            const request = transaction.objectStore('sessions').getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error('Could not read sessions'));
          });
        }

        if (operation === 'count-sessions') {
          return await new Promise<unknown>((resolve, reject) => {
            const transaction = db.transaction('sessions', 'readonly');
            const request = transaction.objectStore('sessions').count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error('Could not count sessions'));
          });
        }

        return await new Promise<unknown>((resolve, reject) => {
          const elapsedSeconds = argument ?? 0;
          const transaction = db.transaction('sessions', 'readwrite');
          const store = transaction.objectStore('sessions');
          const request = store.getAll();

          request.onsuccess = () => {
            const sessions = request.result as StoredSession[];
            const running = sessions.find((session) => session.state === 'running');
            if (!running) {
              transaction.abort();
              reject(new Error('No running session found'));
              return;
            }

            const startedAtWallClockMs = Date.now() - elapsedSeconds * 1000;
            running.currentRunningStartedAtWallClockMs = startedAtWallClockMs;
            running.startedAtWallClockMs = Math.min(
              running.startedAtWallClockMs,
              startedAtWallClockMs,
            );
            store.put(running);
          };

          request.onerror = () => reject(request.error ?? new Error('Could not read sessions'));
          transaction.oncomplete = () => resolve(undefined);
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Could not update running session'));
        });
      } finally {
        db.close();
      }
    },
    { operation, argument },
  ) as Promise<T>;
}

export async function ageRunningSession(page: Page, elapsedSeconds: number): Promise<void> {
  await withIntervaleDatabase<void>(page, 'age-running', elapsedSeconds);
}

export async function readSessions(page: Page): Promise<StoredSession[]> {
  return withIntervaleDatabase<StoredSession[]>(page, 'read-sessions');
}

export async function countSessions(page: Page): Promise<number> {
  return withIntervaleDatabase<number>(page, 'count-sessions');
}

export async function startFiveMinuteMeasure(page: Page): Promise<void> {
  await page.getByLabel(/Other duration/).fill('5');
  await page.getByRole('button', { name: 'Start Measure' }).click();
  await page.getByRole('heading', { name: 'Measure in progress' }).waitFor();
}
