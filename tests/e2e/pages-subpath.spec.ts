import { expect, test } from '@playwright/test';

test('the Pages-subpath build survives lifecycle, deep links, and offline reloads', async ({
  context,
  page,
}) => {
  test.skip(
    process.env.INTERVALE_BASE_PATH !== '/intervale/',
    'This test requires the separate GitHub Pages production build.',
  );

  await page.goto('/intervale/');
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) throw new Error('PWA manifest link is missing');

    const response = await fetch(link.href);
    if (!response.ok) throw new Error('PWA manifest failed to load');

    return {
      path: new URL(link.href).pathname,
      data: (await response.json()) as { start_url?: string; scope?: string },
    };
  });

  expect(manifest.path).toBe('/intervale/manifest.webmanifest');
  expect(manifest.data.start_url).toBe('/intervale/');
  expect(manifest.data.scope).toBe('/intervale/');

  await page.getByLabel(/Other duration/).fill('5');
  await page.getByRole('button', { name: 'Start Measure' }).click();
  await expect(page.getByRole('heading', { name: 'Measure in progress' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Measure in progress' })).toBeVisible();

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Measure paused' })).toBeVisible();

  await page.getByRole('button', { name: 'Resume Measure' }).click();
  await page.getByRole('button', { name: 'End Early' }).click();
  await page.getByRole('button', { name: 'End & See Report' }).click();
  await expect(page.getByRole('heading', { name: 'Measure complete.' })).toBeVisible();

  await page.getByRole('button', { name: 'Open Journal' }).click();
  await expect(page.getByRole('heading', { name: 'Adventure Journal' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/intervale/journal');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Adventure Journal' })).toBeVisible();

  await page.goto('/intervale/');
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();

  const workerScriptPath = await page.evaluate(async () => {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('Service worker was not ready')), 15_000),
      ),
    ]);

    if (!navigator.serviceWorker.controller) {
      await Promise.race([
        new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
            once: true,
          }),
        ),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error('Service worker did not control the page')), 15_000),
        ),
      ]);
    }

    const controller = navigator.serviceWorker.controller;
    if (!controller) throw new Error('Page has no service worker controller');
    return new URL(controller.scriptURL).pathname;
  });

  expect(workerScriptPath).toBe('/intervale/sw.js');

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();

    await page.goto('/intervale/journal', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Adventure Journal' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
