import { expect, test } from '@playwright/test';

test('bootstrap exposes a single primary heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});
