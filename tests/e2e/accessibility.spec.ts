import { expect, test, type Page } from '@playwright/test';
import axeCore from 'axe-core';
import { startFiveMinuteMeasure } from './helpers';

interface AxeViolation {
  id: string;
  impact: string | null;
  nodes: number;
}

async function axeViolations(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ content: axeCore.source });

  return page.evaluate(async () => {
    const axe = (
      globalThis as unknown as {
        axe: {
          run(): Promise<{
            violations: Array<{
              id: string;
              impact: string | null;
              nodes: unknown[];
            }>;
          }>;
        };
      }
    ).axe;

    const result = await axe.run();
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
    }));
  });
}

test('focus start view exposes one primary page heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('core start flow is keyboard reachable', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
});

test('ready and active focus views have no automated axe violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  await startFiveMinuteMeasure(page);
  expect(await axeViolations(page)).toEqual([]);
});
