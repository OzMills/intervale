import { expect, test } from '@playwright/test';
import { ageRunningSession, startFiveMinuteMeasure } from './helpers';

test('exported local state round-trips into a fresh browser context', async ({
  browser,
  page,
}, testInfo) => {
  await page.goto('/');
  await startFiveMinuteMeasure(page);
  await ageRunningSession(page, 360);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Measure complete.' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Another Measure' }).click();
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export save' }).click(),
  ]);
  const exportedPath = await download.path();
  expect(exportedPath).not.toBeNull();

  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== 'string') {
    throw new Error('Playwright baseURL is required for import/export E2E');
  }

  const freshContext = await browser.newContext({ baseURL });
  const freshPage = await freshContext.newPage();

  try {
    await freshPage.goto('/');
    await expect(freshPage.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();

    await freshPage.getByLabel('Validate import').setInputFiles(exportedPath!);
    await expect(
      freshPage.getByRole('heading', { name: 'Replace current local game?' }),
    ).toBeVisible();

    await freshPage.getByRole('button', { name: 'Replace Current Game' }).click();
    await expect(freshPage.getByText(/Save imported/)).toBeVisible();

    await freshPage.getByRole('link', { name: 'Journal' }).click();
    await expect(freshPage.getByRole('heading', { name: 'Adventure Journal' })).toBeVisible();
    await expect(freshPage.getByRole('heading', { name: 'Technical Spike report' })).toBeVisible();
    await expect(freshPage.getByText('5 credited minutes')).toBeVisible();
  } finally {
    await freshContext.close();
  }
});
