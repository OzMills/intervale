import { expect, test } from '@playwright/test';

test('the installed production shell can reload while offline', async ({ context, page }) => {
  test.setTimeout(60_000);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();

  const serviceWorkerSupported = await page.evaluate(() => 'serviceWorker' in navigator);
  test.skip(!serviceWorkerSupported, 'This browser project does not expose service workers');

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
