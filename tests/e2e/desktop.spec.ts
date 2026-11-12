import { expect, test } from '@playwright/test';
import { board, centre, openFresh, settled } from './helpers';

// The same build with a mouse on a laptop-sized window.
test.use({ viewport: { width: 1280, height: 720 }, hasTouch: false, isMobile: false });

test.beforeEach(async ({ page }) => {
  await openFresh(page);
});

test('laptop: landscape pitch, drag with the mouse, Ctrl+Z undoes, Ctrl+Shift+Z redoes', async ({ page }) => {
  await expect(page.getByTestId('board')).toHaveAttribute('data-orient', 'landscape');
  await page.getByTestId('pause').click();
  const before = (await board(page)).snapshot;
  const from = await centre(page, 'A5');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 80, { steps: 8 });
  await page.mouse.up();
  const moved = (await board(page)).snapshot;
  expect(moved.players.A5.pos.x).toBeGreaterThan(before.players.A5.pos.x + 1);
  expect(moved.ball).toMatchObject({ kind: 'held', carrierId: 'A5' });
  await page.keyboard.press('Control+z');
  expect((await board(page)).snapshot).toEqual(before);
  await page.keyboard.press('Control+Shift+z');
  expect((await board(page)).snapshot).toEqual(moved);
});

test('laptop: click carrier then teammate passes; drag from the ball kicks', async ({ page }) => {
  await page.getByTestId('pause').click();
  const a5 = await centre(page, 'A5');
  await page.mouse.click(a5.x, a5.y);
  const a4 = await centre(page, 'A4');
  await page.mouse.click(a4.x, a4.y);
  await expect(page.getByTestId('ball')).toHaveAttribute('data-state', 'held');
  expect((await board(page)).snapshot.ball).toMatchObject({ kind: 'held', carrierId: 'A4' });

  const ball = await centre(page, 'ball');
  await page.mouse.move(ball.x, ball.y);
  await page.mouse.down();
  await page.mouse.move(ball.x + 40, ball.y - 150, { steps: 6 });
  await expect(page.getByTestId('aim-line')).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId('ball')).toHaveAttribute('data-state', 'loose');
});

test('laptop: right-click opens the player menu; wheel zooms and space-drag pans the view only', async ({ page }) => {
  await settled(page);
  const b3 = await centre(page, 'B3');
  await page.mouse.click(b3.x, b3.y, { button: 'right' });
  await expect(page.getByTestId('player-menu')).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByTestId('menu-you').click();
  expect((await board(page)).view.youId).toBe('B3');

  const snapshot = (await board(page)).snapshot;
  const fit = (await board(page)).view.viewport;
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, -600);
  const zoomed = (await board(page)).view.viewport;
  expect(zoomed.w).toBeLessThan(fit.w * 0.7);

  await page.keyboard.down('Space');
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(540, 330, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  const panned = (await board(page)).view.viewport;
  expect(panned.x).toBeGreaterThan(zoomed.x);
  expect(panned.w).toBeCloseTo(zoomed.w);
  expect((await board(page)).snapshot).toEqual(snapshot); // players outside the view still exist, untouched

  await page.getByTestId('fit').click();
  expect((await board(page)).view.viewport).toEqual(fit);
});

test('the lesson mode slot exists but is greyed out', async ({ page }) => {
  await expect(page.getByTestId('mode-lesson')).toBeDisabled();
  await page.goto('/#/lesson');
  await expect(page.getByTestId('lesson')).toBeVisible();
});
