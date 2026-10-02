import { expect, test } from '@playwright/test';

test('Technical Spike focus shell loads from local persistence', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Measure' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Journal' })).toBeVisible();
});
