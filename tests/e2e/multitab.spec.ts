import { expect, test, type Page } from '@playwright/test';
import { countSessions } from './helpers';

async function submitStartAtBarrier(
  page: Page,
  channelName: string,
  participantId: 'a' | 'b',
): Promise<void> {
  await page.evaluate(
    async ({ channelName, participantId }) => {
      const button = Array.from(document.querySelectorAll('button')).find(
        (candidate) => candidate.textContent?.trim() === 'Start Measure',
      );
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error('Start Measure button not found');
      }

      const form = button.form;
      if (!form) throw new Error('Start Measure form not found');

      const peerId = participantId === 'a' ? 'b' : 'a';
      const channel = new BroadcastChannel(channelName);

      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            window.clearInterval(repeatReady);
            reject(new Error('Timed out waiting for the other Start participant'));
          }, 5_000);
          const repeatReady = window.setInterval(() => {
            channel.postMessage({ type: 'ready', participantId });
          }, 25);

          channel.addEventListener('message', (event) => {
            const message = event.data as { type?: unknown; participantId?: unknown } | null;
            if (message?.type !== 'ready' || message.participantId !== peerId) return;

            window.clearTimeout(timeout);
            window.clearInterval(repeatReady);
            resolve();
          });

          channel.postMessage({ type: 'ready', participantId });
        });

        form.requestSubmit(button);
      } finally {
        channel.close();
      }
    },
    { channelName, participantId },
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

    const channelName = `intervale:e2e:start-race:${Date.now()}`;
    await Promise.all([
      submitStartAtBarrier(page, channelName, 'a'),
      submitStartAtBarrier(second, channelName, 'b'),
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
