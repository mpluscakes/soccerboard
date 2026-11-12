import { computeTargets, getLevel } from '../../src/engine';
import type { EngineResult } from '../../src/engine';
import { clampToRect, boundsOf } from '../../src/model/geometry';
import { newBoard, type SetupOptions } from '../../src/model/presets';
import { reduce } from '../../src/model/reduce';
import type { BoardState, Rect, Vec2 } from '../../src/model/types';
import { glideStep } from '../../src/store/glide';

export interface Fixture {
  name: string;
  level: 1 | 2;
  board: BoardState;
}

/** Small deterministic random generator so fixtures are reproducible. */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function jitter(board: BoardState, seed: number, amount: number): BoardState {
  const rnd = lcg(seed);
  const bounds = boundsOf(board.setup);
  const players = { ...board.snapshot.players };
  for (const id of Object.keys(players).sort()) {
    const p = players[id];
    const pos = clampToRect({ x: p.pos.x + (rnd() - 0.5) * 2 * amount, y: p.pos.y + (rnd() - 0.5) * 2 * amount }, bounds, 0.5);
    players[id] = { ...p, pos: { x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100 } };
  }
  return { ...board, snapshot: { ...board.snapshot, players } };
}

export const withHeld = (board: BoardState, carrierId: string): BoardState => ({
  ...board,
  snapshot: { ...board.snapshot, ball: { kind: 'held', carrierId } },
});
export const withLoose = (board: BoardState, pos: Vec2): BoardState => ({
  ...board,
  snapshot: { ...board.snapshot, ball: { kind: 'loose', pos } },
});
export const withLevel = (board: BoardState, levelId: 1 | 2): BoardState => ({ ...board, view: { ...board.view, levelId } });
export const withArea = (board: BoardState, area: Rect): BoardState => reduce(board, { type: 'SET_ACTIVE_AREA', area });
export const board = (o: SetupOptions, levelId: 1 | 2 = 1): BoardState => withLevel(newBoard(o), levelId);

export function buildFixtures(): Fixture[] {
  const f: Fixture[] = [];
  const b5 = board({ preset: '5v5' });
  f.push({ name: '01-5v5-l1-attack', level: 1, board: b5 });
  f.push({ name: '02-5v5-l1-defend', level: 1, board: withHeld(jitter(b5, 2, 2), 'B5') });
  f.push({ name: '03-5v5-l1-loose', level: 1, board: withLoose(jitter(b5, 3, 3), { x: 5, y: 3 }) });
  const small = withArea(board({ preset: '4v4', countA: 2, countB: 1, keepers: false }), { x: 2, y: -9, w: 10.5, h: 9 });
  f.push({ name: '04-2v1-corner', level: 1, board: small });
  const b7 = board({ preset: '7v7' }, 2);
  f.push({ name: '05-7v7-l2-attack', level: 2, board: jitter(b7, 5, 2) });
  f.push({ name: '06-7v7-l2-defend', level: 2, board: withHeld(jitter(b7, 6, 3), 'B6') });
  f.push({ name: '07-9v9-l2-loose', level: 2, board: withLoose(jitter(board({ preset: '9v9' }, 2), 7, 4), { x: -12, y: 8 }) });
  const b11 = board({ preset: '11v11' }, 2);
  f.push({ name: '08-11v11-l2-attack', level: 2, board: jitter(b11, 8, 4) });
  let pinned = withHeld(jitter(b11, 9, 5), 'B10');
  pinned = reduce(reduce(pinned, { type: 'PIN', id: 'A5' }), { type: 'PIN', id: 'B3' });
  f.push({ name: '09-11v11-l2-defend-pins', level: 2, board: pinned });
  const pass = reduce(jitter(b5, 10, 2), { type: 'PASS', fromId: 'A5', toId: 'A3', t0: 1000 });
  f.push({ name: '10-5v5-l1-pass-in-flight', level: 1, board: pass });
  return f;
}

export const run = (b: BoardState, prev?: EngineResult): EngineResult => computeTargets(b, getLevel(b.view.levelId), prev);

/** Run the same engine + glide loop the app runs. Returns every tick's result. */
export function simulate(
  start: BoardState,
  seconds: number,
  onTick?: (b: BoardState, t: number) => BoardState,
): { board: BoardState; history: EngineResult[] } {
  const dt = 0.066;
  let b = start;
  let prev: EngineResult | undefined;
  const history: EngineResult[] = [];
  for (let t = 0; t < seconds; t += dt) {
    if (onTick) b = onTick(b, t);
    prev = run(b, prev);
    history.push(prev);
    const moved = glideStep(b, prev.targets, b.view.glideSpeed * dt);
    if (moved) b = reduce(b, { type: 'APPLY_TARGETS', targets: moved });
  }
  return { board: b, history };
}
