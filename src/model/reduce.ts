import {
  BLOCK_RADIUS,
  CONTROL_RADIUS,
  SAVE_RADIUS,
  SHOOT_AROUND,
  ballPos,
  boundsOf,
  clampToRect,
  closestOnSegment,
  dist,
  goalAt,
  norm,
  shotEnd,
  sub,
  travelEnd,
} from './geometry';
import { defaultYou, fitViewport, initialSnapshot } from './presets';
import type { Action, Ball, BoardState, Setup, Snapshot, Vec2 } from './types';

/** Nearest player within the control radius of a point, ties broken by id. */
export function playerNear(snapshot: Snapshot, p: Vec2, radius = CONTROL_RADIUS): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const id of Object.keys(snapshot.players).sort()) {
    const d = dist(snapshot.players[id].pos, p);
    if (d <= radius && d < bestD - 1e-9) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

function settleBall(snapshot: Snapshot, at: Vec2): Ball {
  const id = playerNear(snapshot, at);
  if (!id) return { kind: 'loose', pos: at };
  const from = snapshot.players[id].pos;
  const d = dist(from, at);
  return d > 0.05 ? { kind: 'held', carrierId: id, dir: norm(sub(at, from)) } : { kind: 'held', carrierId: id };
}

/**
 * A shot is stopped by the first opponent standing in its way: returns the
 * point where they meet it, or null when the way to goal is clear.
 */
function blockedAt(setup: Setup, snapshot: Snapshot, from: Vec2, to: Vec2): Vec2 | null {
  const kickerId = snapshot.ball.kind === 'held' ? snapshot.ball.carrierId : null;
  const kicker = setup.players.find((p) => p.id === kickerId);
  let best: { at: Vec2; t: number } | null = null;
  for (const p of setup.players) {
    const s = snapshot.players[p.id];
    if (!s || p.id === kickerId || (kicker && p.teamId === kicker.teamId)) continue;
    if (p.role !== 'GK' && dist(s.pos, from) < SHOOT_AROUND) continue;
    const c = closestOnSegment(s.pos, from, to);
    if (dist(s.pos, c.at) <= (p.role === 'GK' ? SAVE_RADIUS : BLOCK_RADIUS) && (!best || c.t < best.t)) best = c;
  }
  return best?.at ?? null;
}

/** Pure reducer: every change to a board goes through here. */
export function reduce(state: BoardState, a: Action): BoardState {
  const { setup, snapshot } = state;
  const bounds = boundsOf(setup);
  const withSnapshot = (s: Snapshot): BoardState => ({ ...state, snapshot: s });

  switch (a.type) {
    case 'MOVE_PLAYER': {
      const cur = snapshot.players[a.id];
      if (!cur) return state;
      const to = clampToRect(a.to, bounds);
      let ball = snapshot.ball;
      if (ball.kind === 'held' && ball.carrierId === a.id) {
        const delta = sub(to, cur.pos);
        if (Math.hypot(delta.x, delta.y) > 0.05) ball = { ...ball, dir: norm(delta) };
      }
      return withSnapshot({ players: { ...snapshot.players, [a.id]: { ...cur, pos: to } }, ball });
    }
    case 'MOVE_BALL': {
      const to = clampToRect(a.to, bounds);
      const ball: Ball = a.snap === false ? { kind: 'loose', pos: to } : settleBall(snapshot, to);
      return withSnapshot({ ...snapshot, ball });
    }
    case 'PASS': {
      if (!snapshot.players[a.fromId] || !snapshot.players[a.toId] || a.fromId === a.toId) return state;
      const from = ballPos(snapshot);
      const to = snapshot.players[a.toId].pos;
      return withSnapshot({ ...snapshot, ball: { kind: 'travelling', from, to, t0: a.t0 ?? 0, toId: a.toId } });
    }
    case 'KICK': {
      const from = ballPos(snapshot);
      // Aimed at a goal: the ball goes into the net unless an opponent is in the way.
      const shot = shotEnd(setup, a.to);
      const to = shot ? (blockedAt(setup, snapshot, from, shot) ?? shot) : clampToRect(a.to, bounds);
      return withSnapshot({ ...snapshot, ball: { kind: 'travelling', from, to, t0: a.t0 ?? 0 } });
    }
    case 'BALL_ARRIVE': {
      const b = snapshot.ball;
      if (b.kind !== 'travelling') return state;
      if (b.toId && snapshot.players[b.toId]) {
        const dir = norm(sub(snapshot.players[b.toId].pos, b.from));
        // The receiver takes it facing the way the ball was travelling.
        return withSnapshot({ ...snapshot, ball: { kind: 'held', carrierId: b.toId, dir } });
      }
      const end = travelEnd(snapshot, b);
      // In the net: it stays there (nobody picks it up) until play restarts.
      if (goalAt(setup.pitch, end)) return withSnapshot({ ...snapshot, ball: { kind: 'loose', pos: end } });
      return withSnapshot({ ...snapshot, ball: settleBall(snapshot, end) });
    }
    case 'PIN':
    case 'UNPIN': {
      const cur = snapshot.players[a.id];
      const pinned = a.type === 'PIN';
      if (!cur || cur.pinned === pinned) return state;
      return withSnapshot({ ...snapshot, players: { ...snapshot.players, [a.id]: { ...cur, pinned } } });
    }
    case 'SET_YOU': {
      if (a.id !== null && !snapshot.players[a.id]) return state;
      return { ...state, view: { ...state.view, youId: a.id } };
    }
    case 'SET_ROLE':
    case 'SET_LABEL': {
      if (!setup.players.some((p) => p.id === a.id)) return state;
      const players = setup.players.map((p) => {
        if (p.id !== a.id) return p;
        if (a.type === 'SET_ROLE') return { ...p, role: a.role };
        const label = a.label.trim().slice(0, 12);
        const { label: _old, ...rest } = p;
        return label ? { ...rest, label } : rest;
      });
      return { ...state, setup: { ...setup, players } };
    }
    case 'SET_ACTIVE_AREA': {
      const { activeArea: _drop, ...rest } = setup;
      if (!a.area) return { ...state, setup: rest };
      const next: BoardState = { ...state, setup: { ...rest, activeArea: a.area } };
      // Pull everything inside the new area.
      const players: Snapshot['players'] = {};
      for (const [id, ps] of Object.entries(snapshot.players)) {
        players[id] = { ...ps, pos: clampToRect(ps.pos, a.area, 0.5) };
      }
      let ball = snapshot.ball;
      if (ball.kind === 'loose') ball = { kind: 'loose', pos: clampToRect(ball.pos, a.area, 0.5) };
      if (ball.kind === 'travelling') ball = { kind: 'loose', pos: clampToRect(travelEnd(snapshot, ball), a.area, 0.5) };
      return { ...next, snapshot: { players, ball } };
    }
    case 'SET_VIEW':
      return { ...state, view: { ...state.view, ...a.patch } };
    case 'NEW_BOARD': {
      const view = { ...state.view, viewport: fitViewport(a.setup.pitch), youId: defaultYou(a.setup) };
      return { schemaVersion: 1, setup: a.setup, snapshot: initialSnapshot(a.setup), view };
    }
    case 'APPLY_TARGETS': {
      let changed = false;
      const players = { ...snapshot.players };
      const carrierId = snapshot.ball.kind === 'held' ? snapshot.ball.carrierId : null;
      for (const [id, to] of Object.entries(a.targets)) {
        const cur = players[id];
        // The engine never moves a pinned player or the ball carrier.
        if (!cur || cur.pinned || id === carrierId) continue;
        const pos = clampToRect(to, bounds);
        if (pos.x === cur.pos.x && pos.y === cur.pos.y) continue;
        players[id] = { ...cur, pos };
        changed = true;
      }
      return changed ? withSnapshot({ ...snapshot, players }) : state;
    }
    case 'LOAD_SNAPSHOT':
      return withSnapshot(a.snapshot);
  }
}
