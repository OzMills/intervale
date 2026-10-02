import { expect, test } from '@playwright/test';
import { ageRunningSession, readSessions, startFiveMinuteMeasure } from './helpers';

test('pause and reload preserve credited time, then natural completion resolves once', async ({
  page,
}) => {
  await page.goto('/');
  await startFiveMinuteMeasure(page);

  await ageRunningSession(page, 120);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('heading', { name: 'Measure paused' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Measure paused' })).toBeVisible();

  const paused = await readSessions(page);
  expect(paused).toHaveLength(1);
  expect(paused[0]?.state).toBe('paused');
  expect(paused[0]?.completedRunningSegments).toHaveLength(1);
  expect(paused[0]?.completedRunningSegments[0]?.creditedSeconds).toBeGreaterThanOrEqual(119);
  expect(paused[0]?.completedRunningSegments[0]?.creditedSeconds).toBeLessThan(123);

  await page.getByRole('button', { name: 'Resume Measure' }).click();
  await expect(page.getByRole('heading', { name: 'Measure in progress' })).toBeVisible();

  await ageRunningSession(page, 400);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Measure complete.' })).toBeVisible();
  await expect(
    page.getByText('The fake simulation resolved from 5 credited minutes.'),
  ).toBeVisible();

  const resolved = await readSessions(page);
  expect(resolved).toHaveLength(1);
  expect(resolved[0]?.state).toBe('resolved');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Measure complete.' })).toBeVisible();

  const afterSecondReload = await readSessions(page);
  expect(afterSecondReload).toHaveLength(1);
  expect(afterSecondReload[0]?.state).toBe('resolved');
});

test('a running Measure survives a normal reload without becoming paused or resolved', async ({
  page,
}) => {
  await page.goto('/');
  await startFiveMinuteMeasure(page);

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Measure in progress' })).toBeVisible();
  const sessions = await readSessions(page);
  expect(sessions).toHaveLength(1);
  expect(sessions[0]?.state).toBe('running');
});
