import { expect, test } from '@playwright/test';

test('23. installable: manifest, icons and a service worker', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(new URL(href!, page.url()).toString())).json();
  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBeTruthy();
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) expect((await request.get(new URL(icon.src, page.url()).toString())).ok()).toBe(true);
  expect(await page.locator('meta[name=viewport]').getAttribute('content')).toContain('width=device-width');
  expect(await page.locator('meta[name=theme-color]').count()).toBe(1);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
});

test('23. after the first load the app opens and works with the network off', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid=board]');
  // Wait until the service worker has taken control and cached the app.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
  });
  await page.waitForFunction(async () => (await caches.keys()).length > 0);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.locator('[data-hit]')).toHaveCount(11);
  await page.waitForFunction(() => !!(window as any).__soccerboard?.getState().engine);
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveAttribute('aria-pressed', 'true');
});
