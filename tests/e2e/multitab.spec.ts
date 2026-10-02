import { expect, test } from '@playwright/test';
import { countSessions } from './helpers';

test('two tabs racing to Start create exactly one canonical Measure', async ({ context, page }) => {
  const second = await context.newPage();

  await Promise.all([page.goto('/'), second.goto('/')]);
  await Promise.all([
    page.getByRole('heading', { name: 'Ready when you are.' }).waitFor(),
    second.getByRole('heading', { name: 'Ready when you are.' }).waitFor(),
  ]);

  await Promise.all([
    page.getByLabel(/Other duration/).fill('5'),
    second.getByLabel(/Other duration/).fill('5'),
  ]);

  await Promise.all([
    page.getByRole('button', { name: 'Start Measure' }).click(),
    second.getByRole('button', { name: 'Start Measure' }).click(),
  ]);

  await expect(page.getByRole('heading', { name: 'Measure in progress' })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Measure in progress' })).toBeVisible();
  expect(await countSessions(page)).toBe(1);

  await Promise.all([
    page.getByRole('button', { name: 'Pause' }).click(),
    second.getByRole('button', { name: 'Pause' }).click(),
  ]);

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

  await second.close();
});
