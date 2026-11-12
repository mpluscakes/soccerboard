import type { CDPSession, Page } from '@playwright/test';
import type { BoardState } from '../../src/model/types';

export interface Pt {
  x: number;
  y: number;
}

/** Open the app with a fresh board (no autosave from an earlier test). */
export async function openFresh(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('[data-testid=board]');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('keyval-store');
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
  await page.reload();
  await page.waitForSelector('[data-testid=board]');
  await page.waitForFunction(() => !!(window as any).__soccerboard?.getState().engine);
}

export const board = (page: Page): Promise<BoardState> => page.evaluate(() => (window as any).__soccerboard.getState().board);

export const act = (page: Page, action: unknown, commit = false): Promise<void> =>
  page.evaluate(([a, c]) => (window as any).__soccerboard.getState().dispatch(a, { commit: c }), [action, commit] as const);

/** Centre of a token's hit area in CSS px ('ball' or a player id). */
export async function centre(page: Page, id: string): Promise<Pt> {
  const box = await page.locator(`[data-hit="${id}"]`).boundingBox();
  if (!box) throw new Error(`no token ${id}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export const scale = async (page: Page): Promise<number> => Number(await page.getByTestId('board').getAttribute('data-scale'));

let sessions = new WeakMap<Page, CDPSession>();
async function cdp(page: Page): Promise<CDPSession> {
  let s = sessions.get(page);
  if (!s) {
    s = await page.context().newCDPSession(page);
    sessions.set(page, s);
  }
  return s;
}
const touch = (p: Pt, id = 0) => ({ x: Math.round(p.x), y: Math.round(p.y), id, radiusX: 8, radiusY: 8, force: 1 });

/** A real one-finger drag (Chrome turns these into touch pointer events). */
export async function touchDrag(page: Page, from: Pt, to: Pt, opts: { steps?: number; holdMs?: number; release?: boolean } = {}): Promise<void> {
  const s = await cdp(page);
  const steps = opts.steps ?? 12;
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(from)] });
  for (let i = 1; i <= steps; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(p)] });
    await page.waitForTimeout(16);
  }
  if (opts.holdMs) await page.waitForTimeout(opts.holdMs);
  if (opts.release !== false) await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function touchEnd(page: Page): Promise<void> {
  await (await cdp(page)).send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function tap(page: Page, at: Pt): Promise<void> {
  const s = await cdp(page);
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(at)] });
  await page.waitForTimeout(40);
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function longPress(page: Page, at: Pt): Promise<void> {
  const s = await cdp(page);
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(at)] });
  await page.waitForTimeout(650);
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // The menu ignores input for a moment so the lifting finger cannot trigger it.
  await page.waitForTimeout(400);
}

/** Two fingers moving apart (or together) around a point. */
export async function pinch(page: Page, at: Pt, fromGap: number, toGap: number): Promise<void> {
  const s = await cdp(page);
  const pts = (gap: number) => [touch({ x: at.x - gap / 2, y: at.y }, 0), touch({ x: at.x + gap / 2, y: at.y }, 1)];
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(fromGap) });
  for (let i = 1; i <= 10; i++) {
    await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(fromGap + ((toGap - fromGap) * i) / 10) });
    await page.waitForTimeout(16);
  }
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Wait until nobody is moving any more. */
export async function settled(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as any;
      const json = JSON.stringify(w.__soccerboard.getState().board.snapshot);
      const same = w.__lastSnap === json;
      w.__lastSnap = json;
      w.__still = same ? (w.__still ?? 0) + 1 : 0;
      return w.__still >= 3;
    },
    undefined,
    { polling: 150, timeout: 15_000 },
  );
}

/** Did the page itself scroll or zoom? */
export const pageMoved = (page: Page): Promise<boolean> =>
  page.evaluate(() => window.scrollX !== 0 || window.scrollY !== 0 || (window.visualViewport?.scale ?? 1) !== 1 || (window.visualViewport?.offsetTop ?? 0) !== 0);
