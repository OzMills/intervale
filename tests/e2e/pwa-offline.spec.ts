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

  const browserConsole: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => browserConsole.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(error.message));

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

  const precacheState = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const cacheEntries = await Promise.all(
      cacheNames.map(async (cacheName) => {
        const cache = await caches.open(cacheName);
        return {
          cacheName,
          urls: (await cache.keys()).map((request) => request.url),
        };
      }),
    );

    return {
      controllerUrl: navigator.serviceWorker.controller?.scriptURL ?? null,
      cacheEntries,
    };
  });

  console.log('PWA precache state:', JSON.stringify(precacheState));
  expect(precacheState.controllerUrl).not.toBeNull();
  expect(
    precacheState.cacheEntries.some((cache) =>
      cache.urls.some((url) => new URL(url).pathname === '/index.html'),
    ),
  ).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });

    const postReloadState = await page.evaluate(() => ({
      href: location.href,
      controllerUrl: navigator.serviceWorker.controller?.scriptURL ?? null,
      bodyText: document.body.innerText,
      rootHtml: document.getElementById('root')?.innerHTML ?? null,
    }));
    console.log('PWA offline reload state:', JSON.stringify(postReloadState));
    console.log('PWA browser console:', JSON.stringify(browserConsole));
    console.log('PWA page errors:', JSON.stringify(pageErrors));

    await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
