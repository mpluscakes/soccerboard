import { expect, test } from '@playwright/test';

// These tests start like a brand-new visitor: nothing remembered on the device.
test.use({ storageState: { cookies: [], origins: [] } });

const open = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.goto('/');
  await page.waitForSelector('[data-testid=board]');
};

test('first visit: the tutorial opens, walks through the basics and can be finished', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('tutorial')).toBeVisible();
  const titles: string[] = [];
  for (let i = 0; i < 6; i++) {
    titles.push((await page.getByTestId('tutorial-title').textContent()) ?? '');
    // It fits on a phone without scrolling.
    const box = (await page.getByTestId('tutorial').boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await page.getByTestId('tutorial-next').click();
  }
  expect(new Set(titles).size).toBe(6);
  await expect(page.getByTestId('tutorial')).toHaveCount(0);
  // Not ticked "don't show again": it comes back next time.
  await page.reload();
  await expect(page.getByTestId('tutorial')).toBeVisible();
});

test('skip closes it; "Don\'t show this again" is remembered; settings can bring it back', async ({ page }) => {
  await open(page);
  await page.getByTestId('tutorial-skip').click();
  await expect(page.getByTestId('tutorial')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('tutorial')).toBeVisible();

  await page.getByTestId('tutorial-never').check();
  await page.getByTestId('tutorial-skip').click();
  await page.reload();
  await page.waitForSelector('[data-testid=board]');
  await page.waitForFunction(() => !!(window as any).__soccerboard?.getState().engine);
  await expect(page.getByTestId('tutorial')).toHaveCount(0);

  await page.getByTestId('setup-button').click();
  await page.getByTestId('show-tutorial').click();
  await expect(page.getByTestId('tutorial')).toBeVisible();
  await expect(page.getByTestId('tutorial-never')).toBeChecked();
});
