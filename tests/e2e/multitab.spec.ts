import { expect, test, type Page } from '@playwright/test';
import { countSessions } from './helpers';

async function submitStartAtTime(page: Page, startAtWallClockMs: number): Promise<void> {
  await page.evaluate(
    async ({ startAtWallClockMs }) => {
      const button = Array.from(document.querySelectorAll('button')).find(
        (candidate) => candidate.textContent?.trim() === 'Start Measure',
      );
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error('Start Measure button not found');
      }

      const form = button.form;
      if (!form) throw new Error('Start Measure form not found');

      const delayMs = Math.max(0, startAtWallClockMs - Date.now());
      if (delayMs > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
      }

      form.requestSubmit(button);
    },
    { startAtWallClockMs },
  );
}

test('two tabs racing to Start create exactly one canonical Measure', async ({ context, page }) => {
  const second = await context.newPage();

  try {
    await Promise.all([page.goto('/'), second.goto('/')]);
    await Promise.all([
      page.getByRole('heading', { name: 'Ready when you are.' }).waitFor(),
      second.getByRole('heading', { name: 'Ready when you are.' }).waitFor(),
    ]);

    await Promise.all([
      page.getByLabel(/Other duration/).fill('5'),
      second.getByLabel(/Other duration/).fill('5'),
    ]);

    const startAtWallClockMs = Date.now() + 1_500;
    await Promise.all([
      submitStartAtTime(page, startAtWallClockMs),
      submitStartAtTime(second, startAtWallClockMs),
    ]);

    await expect(page.getByRole('heading', { name: 'Measure in progress' })).toBeVisible();
    await expect(second.getByRole('heading', { name: 'Measure in progress' })).toBeVisible();
    await expect.poll(() => countSessions(page)).toBe(1);

    await page.getByRole('button', { name: 'Pause' }).click();

    await expect(page.getByRole('heading', { name: 'Measure paused' })).toBeVisible();
    await expect(second.getByRole('heading', { name: 'Measure paused' })).toBeVisible();

    const sessions = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('intervale');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
      });

      try {
        return await new Promise<Array<{ state: string; completedRunningSegments: unknown[] }>>(
          (resolve, reject) => {
            const request = db.transaction('sessions', 'readonly').objectStore('sessions').getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error('Could not read sessions'));
          },
        );
      } finally {
        db.close();
      }
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.state).toBe('paused');
    expect(sessions[0]?.completedRunningSegments).toHaveLength(1);
  } finally {
    await second.close();
  }
});
