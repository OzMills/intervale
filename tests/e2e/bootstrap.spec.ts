import { expect, test } from '@playwright/test';

test('bootstrap shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A Town Called Intervale' })).toBeVisible();
  await expect(page.getByText(/Technical Spike implementation has not started/)).toBeVisible();
});
