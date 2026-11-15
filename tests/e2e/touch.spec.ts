import { expect, test } from '@playwright/test';
import { act, board, centre, doubleTap, openFresh, pause, settled, tap, touchDrag } from './helpers';

test.beforeEach(async ({ page }) => {
  await openFresh(page);
});

test('phone toolbar: one slim row with unpin, reset and settings; the rest is in the settings sheet', async ({ page }) => {
  const bar = (await page.getByTestId('toolbar').boundingBox())!;
  expect(bar.height).toBeLessThanOrEqual(52);
  for (const id of ['unpin-all', 'reset', 'setup-button']) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(44);
  }
  await expect(page.getByTestId('pause')).toHaveCount(0);
  await expect(page.getByTestId('unpin-all')).toBeDisabled();

  // Pin two players by dragging them, then let them all go with one tap.
  await settled(page);
  for (const id of ['A2', 'A4']) {
    const from = await centre(page, id);
    await touchDrag(page, from, { x: from.x + 40, y: from.y + 50 });
  }
  await expect(page.getByTestId('unpin-all')).toContainText('2');
  await page.getByTestId('unpin-all').click();
  await expect(page.getByTestId('unpin-all')).toBeDisabled();
  expect(Object.values((await board(page)).snapshot.players).some((p) => p.pinned)).toBe(false);

  await page.getByTestId('setup-button').click();
  for (const id of ['level', 'perspective', 'auto-move', 'hint-only', 'pause', 'show-me', 'undo', 'redo', 'view-menu']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  // Paused from the sheet: a Play button shows in the bar so nobody is left stuck.
  await page.getByTestId('pause').click();
  await page.getByTestId('setup-close').click();
  await expect(page.getByTestId('pause')).toHaveAttribute('aria-label', 'Play');
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveCount(0);
});

test('double-tap a teammate passes to them', async ({ page }) => {
  await pause(page);
  await doubleTap(page, await centre(page, 'A4'));
  await expect(page.getByTestId('ball')).toHaveAttribute('data-state', 'held');
  expect((await board(page)).snapshot.ball).toMatchObject({ kind: 'held', carrierId: 'A4' });
  // An opponent is not a pass target, and two slow taps are not a double tap.
  await doubleTap(page, await centre(page, 'B2'));
  await tap(page, await centre(page, 'A3'));
  await page.waitForTimeout(500);
  await tap(page, await centre(page, 'A3'));
  await page.waitForTimeout(300);
  expect((await board(page)).snapshot.ball).toMatchObject({ kind: 'held', carrierId: 'A4' });
});

test('double-tap the grass kicks the ball there', async ({ page }) => {
  await pause(page);
  const spot = { x: 60, y: (await centre(page, 'A5')).y - 20 };
  await doubleTap(page, spot);
  await expect(page.getByTestId('ball')).toHaveAttribute('data-state', 'loose');
  const ball = await centre(page, 'ball');
  expect(Math.hypot(ball.x - spot.x, ball.y - spot.y)).toBeLessThan(10);
});

test('the ball can be grabbed even with the carrier and a defender right on it', async ({ page }) => {
  await settled(page); // the presser is now standing next to the ball
  await pause(page);
  const ball = await centre(page, 'ball');
  // A finger that lands a little off the ball still gets the ball, not a player.
  await touchDrag(page, { x: ball.x + 5, y: ball.y - 5 }, { x: 60, y: ball.y + 40 });
  await expect(page.getByTestId('ball')).toHaveAttribute('data-state', 'loose');
  expect(Object.values((await board(page)).snapshot.players).some((p) => p.pinned)).toBe(false);
});

test('a shot past the keeper is a goal: fireworks, then the ball goes back to the centre', async ({ page }) => {
  await pause(page);
  // Blue 5 is through on goal; the keeper is covering the middle.
  await act(page, { type: 'MOVE_PLAYER', id: 'A5', to: { x: 10, y: -5 } });
  const b = await board(page);
  const half = b.setup.pitch.length / 2;
  await act(page, { type: 'KICK', to: { x: half, y: -1.7 }, t0: Date.now() }, true);
  await expect(page.getByTestId('goal-party')).toBeVisible();
  await expect(page.getByTestId('goal-party')).toHaveAttribute('data-team', 'A');
  await expect(page.getByTestId('goal-party')).toHaveCount(0, { timeout: 6000 });
  expect((await board(page)).snapshot.ball).toEqual({ kind: 'loose', pos: { x: 0, y: 0 } });
});

test('a shot straight at a defender or the keeper is stopped', async ({ page }) => {
  await pause(page);
  await act(page, { type: 'MOVE_PLAYER', id: 'A5', to: { x: 8, y: 0 } });
  const b = await board(page);
  await act(page, { type: 'KICK', to: { x: b.setup.pitch.length / 2, y: 0 }, t0: Date.now() }, true);
  await expect(page.getByTestId('ball')).toHaveAttribute('data-state', 'held');
  expect((await board(page)).snapshot.ball).toMatchObject({ kind: 'held', carrierId: expect.stringMatching(/^B/) });
  await expect(page.getByTestId('goal-party')).toHaveCount(0);
});
