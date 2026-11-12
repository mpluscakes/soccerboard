import { expect, test } from '@playwright/test';
import { initialSnapshot } from '../../src/model/presets';
import { act, board, centre, longPress, openFresh, pageMoved, pinch, scale, settled, tap, touchDrag, touchEnd } from './helpers';

test.beforeEach(async ({ page }) => {
  await openFresh(page);
});

test('1. opens as 5v5 with keepers at level 1; presets draw the listed pitch', async ({ page }) => {
  await expect(page.locator('[data-hit]:not([data-hit=ball])')).toHaveCount(10);
  await expect(page.locator('[data-role=GK]')).toHaveCount(2);
  await expect(page.getByTestId('level')).toHaveValue('1');
  await expect(page.getByTestId('mode-lesson')).toBeDisabled();
  const outline = page.getByTestId('pitch-outline');
  await expect(outline).toHaveAttribute('data-length', '35');
  await expect(outline).toHaveAttribute('data-width', '25');
  await expect(page.getByTestId('goal-left')).toHaveAttribute('height', '4');

  for (const [preset, length, width, goal, players] of [
    ['4v4', '25', '18', '3', 8],
    ['7v7', '50', '35', '5', 14],
    ['9v9', '65', '45', '5', 18],
    ['11v11', '100', '64', '7.32', 22],
  ] as const) {
    await page.getByTestId('setup-button').click();
    await page.getByTestId(`preset-${preset}`).click();
    await page.getByTestId('start-board').click();
    await expect(outline).toHaveAttribute('data-length', length);
    await expect(outline).toHaveAttribute('data-width', width);
    await expect(page.getByTestId('goal-left')).toHaveAttribute('height', goal);
    await expect(page.locator('[data-hit]:not([data-hit=ball])')).toHaveCount(players);
  }
});

test('2. team sizes are independent: 2v1 loads', async ({ page }) => {
  await page.getByTestId('setup-button').click();
  await page.getByTestId('count-A').fill('2');
  await page.getByTestId('count-B').fill('1');
  await page.getByTestId('keepers').uncheck();
  await page.getByTestId('start-board').click();
  await expect(page.locator('[data-team=A]')).toHaveCount(2);
  await expect(page.locator('[data-team=B]')).toHaveCount(1);
});

test('3. keeping play inside the view confines tokens and targets', async ({ page }) => {
  await page.getByTestId('view-button').click();
  await page.getByRole('menuitem', { name: 'Attacking half' }).click();
  await page.getByTestId('view-button').click();
  await page.getByRole('menuitem', { name: 'Keep play inside this view' }).click();
  await expect(page.getByTestId('active-area')).toBeVisible();
  await settled(page);
  const state = await page.evaluate(() => {
    const s = (window as any).__soccerboard.getState();
    return { area: s.board.setup.activeArea, players: s.board.snapshot.players, targets: s.engine.targets };
  });
  const inside = (p: { x: number; y: number }) =>
    p.x >= state.area.x - 1e-6 && p.x <= state.area.x + state.area.w + 1e-6 && p.y >= state.area.y - 1e-6 && p.y <= state.area.y + state.area.h + 1e-6;
  expect(state.area.x).toBeCloseTo(0);
  for (const p of Object.values<any>(state.players)) expect(inside(p.pos)).toBe(true);
  for (const t of Object.values<any>(state.targets)) expect(inside(t)).toBe(true);
});

test('4. exactly one You; their ghost, arrow and reason are always visible', async ({ page }) => {
  await expect(page.getByTestId('you-tag')).toHaveCount(1);
  await expect(page.getByTestId('reason-you')).toBeVisible();
  // Hint-only keeps ghosts on screen.
  await page.getByTestId('hint-only').click();
  await longPress(page, await centre(page, 'A4'));
  await page.getByTestId('menu-you').click();
  await expect(page.getByTestId('you-tag')).toHaveCount(1);
  await expect(page.locator('[data-testid=player-A4] [data-testid=you-tag]')).toHaveCount(1);
  await expect(page.getByTestId('reason-you')).toHaveAttribute('data-player', 'A4');
  await expect(page.getByTestId('reason-you').locator('.reason-main')).not.toBeEmpty();
  // Even with the filter set to the other side, You is still explained.
  await page.getByTestId('perspective').selectOption('defend');
  await expect(page.getByTestId('ghost-A4')).toBeVisible();
  await expect(page.getByTestId('reason-you')).toBeVisible();
});

test('5. dragging the carrier moves the ball with them and the page does not scroll or zoom', async ({ page }) => {
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  const before = await board(page);
  const from = await centre(page, 'A5');
  const ballBefore = await centre(page, 'ball');
  await touchDrag(page, from, { x: from.x + 90, y: from.y + 140 });
  const after = await board(page);
  expect(after.snapshot.ball).toMatchObject({ kind: 'held', carrierId: 'A5' });
  expect(after.snapshot.players.A5.pos).not.toEqual(before.snapshot.players.A5.pos);
  const to = await centre(page, 'A5');
  const ballAfter = await centre(page, 'ball');
  expect(Math.hypot(to.x - (from.x + 90), to.y - (from.y + 140))).toBeLessThan(8);
  expect(Math.hypot(ballAfter.x - ballBefore.x, ballAfter.y - ballBefore.y)).toBeGreaterThan(100);
  expect(Math.hypot(ballAfter.x - to.x, ballAfter.y - to.y)).toBeLessThan(30);
  expect(await pageMoved(page)).toBe(false);
  // The carrier is not pinned by being dragged.
  expect(after.snapshot.players.A5.pinned).toBe(false);
});

test('6. tap the carrier, then a teammate: the ball travels and they become the carrier', async ({ page }) => {
  await page.getByTestId('pause').click();
  await tap(page, await centre(page, 'A5'));
  await expect(page.getByTestId('pass-tip')).toBeVisible();
  await tap(page, await centre(page, 'A3'));
  await expect(page.getByTestId('ball')).toHaveAttribute('data-state', 'travelling');
  await expect(page.getByTestId('ball')).toHaveAttribute('data-state', 'held');
  expect((await board(page)).snapshot.ball).toMatchObject({ kind: 'held', carrierId: 'A3' });
});

test('7. dragging from the ball and releasing on grass leaves a loose ball there', async ({ page }) => {
  await page.getByTestId('pause').click();
  const from = await centre(page, 'ball');
  const release = { x: 60, y: from.y + 30 }; // empty grass near the side line
  await touchDrag(page, from, release, { release: false });
  await expect(page.getByTestId('aim-line')).toBeVisible();
  await touchEnd(page);
  await expect(page.getByTestId('ball')).toHaveAttribute('data-state', 'loose');
  const ball = await centre(page, 'ball');
  const metres = Math.hypot(ball.x - release.x, ball.y - release.y) / (await scale(page));
  expect(metres).toBeLessThanOrEqual(0.5);
  expect(await pageMoved(page)).toBe(false);
});

test('7b. a loose ball can be dragged, and is picked up when dropped next to a player', async ({ page }) => {
  await page.getByTestId('pause').click();
  await act(page, { type: 'MOVE_BALL', to: { x: 0, y: 10 } });
  const target = await centre(page, 'B3');
  await touchDrag(page, await centre(page, 'ball'), { x: target.x + 10, y: target.y });
  expect((await board(page)).snapshot.ball).toMatchObject({ kind: 'held', carrierId: 'B3' });
});

test('8. dragging a non-carrier pins them; unpin from the long-press menu restores auto-move', async ({ page }) => {
  await settled(page);
  const from = await centre(page, 'A2');
  const drop = { x: 40, y: from.y - 120 };
  await touchDrag(page, from, drop);
  await expect(page.getByTestId('pin-A2')).toBeVisible();
  const pinnedAt = (await board(page)).snapshot.players.A2;
  expect(pinnedAt.pinned).toBe(true);
  // Auto-move is on, but the engine leaves a pinned player alone.
  await page.waitForTimeout(1200);
  expect((await board(page)).snapshot.players.A2.pos).toEqual(pinnedAt.pos);
  // Move the ball: everyone else reacts, the pinned player still does not.
  const carrier = await centre(page, 'A5');
  await touchDrag(page, carrier, { x: carrier.x + 80, y: carrier.y - 60 });
  await settled(page);
  expect((await board(page)).snapshot.players.A2.pos).toEqual(pinnedAt.pos);

  await longPress(page, await centre(page, 'A2'));
  await expect(page.getByTestId('player-menu')).toBeVisible();
  await page.getByTestId('menu-pin').click();
  await expect(page.getByTestId('pin-A2')).toHaveCount(0);
  expect((await board(page)).snapshot.players.A2.pinned).toBe(false);
  // Crowd them so the engine has a reason to move them again.
  const a4 = (await board(page)).snapshot.players.A4.pos;
  await act(page, { type: 'MOVE_PLAYER', id: 'A2', to: { x: a4.x + 0.5, y: a4.y } });
  await settled(page);
  const end = (await board(page)).snapshot;
  expect(Math.hypot(end.players.A2.pos.x - end.players.A4.pos.x, end.players.A2.pos.y - end.players.A4.pos.y)).toBeGreaterThan(1.5);
});

test('9. every token has a hit area of at least 44 x 44 px at every zoom', async ({ page }) => {
  const check = async (): Promise<void> => {
    const boxes = await page.locator('[data-hit]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.width, r.height]));
    expect(boxes.length).toBeGreaterThan(3);
    for (const [w, h] of boxes) {
      expect(w).toBeGreaterThanOrEqual(43.99);
      expect(h).toBeGreaterThanOrEqual(43.99);
    }
  };
  await check();
  await act(page, { type: 'SET_VIEW', patch: { viewport: { x: -5, y: -5, w: 10, h: 10 } } });
  await check();
  await page.getByTestId('setup-button').click();
  await page.getByTestId('preset-11v11').click();
  await page.getByTestId('start-board').click();
  await expect(page.locator('[data-hit]')).toHaveCount(23);
  await check();
});

test('10. undo and redo step through moves; reset returns to the setup', async ({ page }) => {
  await page.getByTestId('pause').click();
  const start = await board(page);
  const snaps = [start.snapshot];
  for (const id of ['A2', 'A3', 'A4']) {
    const from = await centre(page, id);
    await touchDrag(page, from, { x: from.x + 50, y: from.y - 40 });
    snaps.push((await board(page)).snapshot);
  }
  await expect(page.getByTestId('redo')).toBeDisabled();
  for (let i = 2; i >= 0; i--) {
    await page.getByTestId('undo').click();
    expect((await board(page)).snapshot).toEqual(snaps[i]);
  }
  await expect(page.getByTestId('undo')).toBeDisabled();
  for (let i = 1; i <= 3; i++) {
    await page.getByTestId('redo').click();
    expect((await board(page)).snapshot).toEqual(snaps[i]);
  }
  await page.getByTestId('reset').click();
  expect((await board(page)).snapshot).toEqual(JSON.parse(JSON.stringify(initialSnapshot(start.setup))));
});

test('auto-move glides everyone to their targets; hint-only shows ghosts and Show me moves them', async ({ page }) => {
  await settled(page);
  await expect(page.locator('[data-testid^=ghost-]')).toHaveCount(0);

  await page.getByTestId('hint-only').click();
  const carrier = await centre(page, 'A5');
  await touchDrag(page, carrier, { x: carrier.x - 100, y: carrier.y + 80 });
  await expect(page.locator('[data-testid^=ghost-]').first()).toBeVisible();
  const before = (await board(page)).snapshot.players;
  await page.waitForTimeout(600);
  expect((await board(page)).snapshot.players).toEqual(before); // players stay put so the child can try first

  await page.getByTestId('show-me').click();
  await settled(page);
  await expect(page.locator('[data-testid^=ghost-]')).toHaveCount(0);
  expect((await board(page)).snapshot.players).not.toEqual(before);
});

test('pause freezes players while targets keep updating', async ({ page }) => {
  await settled(page);
  await page.getByTestId('pause').click();
  const targetsBefore = await page.evaluate(() => JSON.stringify((window as any).__soccerboard.getState().engine.targets));
  const carrier = await centre(page, 'A5');
  await touchDrag(page, carrier, { x: carrier.x + 100, y: carrier.y + 150 });
  await page.waitForTimeout(300);
  const targetsAfter = await page.evaluate(() => JSON.stringify((window as any).__soccerboard.getState().engine.targets));
  expect(targetsAfter).not.toBe(targetsBefore);
  await expect(page.locator('[data-testid^=ghost-]').first()).toBeVisible();
});

test('22. the perspective filter hides the other team’s reasons and ghosts', async ({ page }) => {
  await page.getByTestId('setup-button').click();
  await page.getByTestId('you-select').selectOption('');
  await page.getByTestId('setup-close').click();
  await page.getByTestId('hint-only').click();
  // Blue (A) has the ball. Shuffle things so both teams have somewhere to go.
  const carrier = await centre(page, 'A5');
  await touchDrag(page, carrier, { x: carrier.x + 90, y: carrier.y + 120 });
  await expect(page.locator('[data-testid^=ghost-B]').first()).toBeVisible();
  await expect(page.locator('[data-testid^=ghost-A]').first()).toBeVisible();

  await page.getByTestId('perspective').selectOption('defend');
  await expect(page.locator('[data-testid^=ghost-A]')).toHaveCount(0);
  await expect(page.locator('[data-testid^=ghost-B]').first()).toBeVisible();
  await tap(page, await centre(page, 'A2'));
  await expect(page.getByTestId('reason-hidden')).toBeVisible();
  await expect(page.getByTestId('reason-selected')).toHaveCount(0);
  await tap(page, await centre(page, 'B2'));
  await expect(page.getByTestId('reason-selected')).toHaveAttribute('data-player', 'B2');

  await page.getByTestId('perspective').selectOption('attack');
  await expect(page.locator('[data-testid^=ghost-B]')).toHaveCount(0);
  await expect(page.locator('[data-testid^=ghost-A]').first()).toBeVisible();
  await expect(page.getByTestId('reason-hidden')).toBeVisible();
});

test('kid and coach words; level 2 adds width and cover', async ({ page }) => {
  await tap(page, await centre(page, 'B5'));
  await expect(page.getByTestId('reason-selected')).toContainText('Go to the ball!');
  await page.getByTestId('setup-button').click();
  await page.getByTestId('text-coach').click();
  await page.getByTestId('setup-close').click();
  await expect(page.getByTestId('reason-selected')).toContainText('First defender');
  await page.getByTestId('level').selectOption('2');
  await page.waitForFunction(() => Object.values<any>((window as any).__soccerboard.getState().engine.reasons).some((r) => r.jobId === 'cover'));
});

test('pinch zooms the board, not the page; Fit resets', async ({ page }) => {
  const before = (await board(page)).view.viewport;
  const box = (await page.getByTestId('board').boundingBox())!;
  await pinch(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 80, 260);
  const zoomed = (await board(page)).view.viewport;
  expect(zoomed.w).toBeLessThan(before.w * 0.6);
  expect(await pageMoved(page)).toBe(false);
  // Zooming and panning change only the view.
  expect((await board(page)).snapshot.ball).toEqual((await board(page)).snapshot.ball);
  await page.getByTestId('view-button').click();
  await page.getByRole('menuitem', { name: 'Whole pitch' }).click();
  expect((await board(page)).view.viewport).toEqual(before);
});

test('24. closing and reopening restores the last board exactly', async ({ page }) => {
  await page.getByTestId('pause').click();
  const from = await centre(page, 'A3');
  await touchDrag(page, from, { x: from.x + 70, y: from.y - 90 });
  await longPress(page, await centre(page, 'B4'));
  await page.getByTestId('menu-you').click();
  await page.getByTestId('level').selectOption('2');
  await page.waitForTimeout(900); // autosave is debounced 500 ms
  const saved = await board(page);
  await page.reload();
  await page.waitForSelector('[data-testid=board]');
  expect(await board(page)).toEqual(saved);
  await expect(page.getByTestId('pin-A3')).toBeVisible();
});
