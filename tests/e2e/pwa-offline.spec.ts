import { expect, test } from '@playwright/test';

test('the installed production shell can reload while offline', async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Offline service-worker automation is exercised in Chromium; Firefox/WebKit remain in the core cross-browser matrix.',
  );

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();

  const serviceWorkerSupported = await page.evaluate(() => 'serviceWorker' in navigator);
  test.skip(!serviceWorkerSupported, 'This browser project does not expose service workers');

  await page.evaluate(async () => {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Service worker did not become ready')), 10_000);
      }),
    ]);

    if (navigator.serviceWorker.controller) return;

    await Promise.race([
      new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        });
      }),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Service worker did not take control')), 10_000);
      }),
    ]);
  });

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
