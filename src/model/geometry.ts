import type { Ball, PitchSpec, Rect, Setup, Snapshot, Team, TeamId, Vec2 } from './types';

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
export const norm = (a: Vec2, fallback: Vec2 = { x: 1, y: 0 }): Vec2 => {
  const l = len(a);
  return l < 1e-9 ? fallback : { x: a.x / l, y: a.y / l };
};
/** Round to millimetres so engine output is stable and compact. */
export const round3 = (n: number): number => Math.round(n * 1000) / 1000;
export const roundVec = (a: Vec2): Vec2 => ({ x: round3(a.x), y: round3(a.y) });

/** Distance from point p to the segment a-b. */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  if (l2 < 1e-12) return dist(p, a);
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / l2, 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

export const pitchRect = (pitch: PitchSpec): Rect => ({
  x: -pitch.length / 2,
  y: -pitch.width / 2,
  w: pitch.length,
  h: pitch.width,
});

/** The rectangle tokens and targets must stay inside. */
export const boundsOf = (setup: Setup): Rect => setup.activeArea ?? pitchRect(setup.pitch);

export function clampToRect(p: Vec2, r: Rect, margin = 0): Vec2 {
  const mx = Math.min(margin, r.w / 2);
  const my = Math.min(margin, r.h / 2);
  return { x: clamp(p.x, r.x + mx, r.x + r.w - mx), y: clamp(p.y, r.y + my, r.y + r.h - my) };
}

export const inRect = (p: Vec2, r: Rect, eps = 1e-9): boolean =>
  p.x >= r.x - eps && p.x <= r.x + r.w + eps && p.y >= r.y - eps && p.y <= r.y + r.h + eps;

export const teamOf = (setup: Setup, id: TeamId): Team => (setup.teams[0].id === id ? setup.teams[0] : setup.teams[1]);
export const otherTeamId = (id: TeamId): TeamId => (id === 'A' ? 'B' : 'A');

/** Centre of the goal a team defends. */
export const ownGoal = (pitch: PitchSpec, team: Team): Vec2 => ({ x: (-team.attacksDir * pitch.length) / 2, y: 0 });
/** Centre of the goal a team attacks. */
export const oppGoal = (pitch: PitchSpec, team: Team): Vec2 => ({ x: (team.attacksDir * pitch.length) / 2, y: 0 });

/** Formation slot (normalised, own half-frame) to metres. */
export const homeToWorld = (pitch: PitchSpec, team: Team, home: Vec2): Vec2 => ({
  // "+ 0" turns -0 into 0 so saved boards compare equal after a JSON round trip.
  x: (team.attacksDir * (home.x - 1) * pitch.length) / 4 + 0,
  y: (team.attacksDir * home.y * pitch.width) / 2 + 0,
});

/** Keeper area for the goal a team defends, in metres. */
export function keeperAreaFor(pitch: PitchSpec, team: Team): Rect | null {
  const a = pitch.keeperArea;
  if (!a) return null;
  return team.attacksDir === 1 ? a : { x: -a.x - a.w, y: a.y, w: a.w, h: a.h };
}

export const BALL_OFFSET = 0.7; // metres ahead of the carrier
export const CONTROL_RADIUS = 1.5; // metres: a ball this close to a player is theirs
export const BALL_SPEED = 12; // m/s for passes and kicks

/** Where the ball is right now (for a travelling ball pass the current time). */
export function ballPos(snapshot: Snapshot, now?: number): Vec2 {
  const b = snapshot.ball;
  if (b.kind === 'loose') return b.pos;
  if (b.kind === 'held') {
    const c = snapshot.players[b.carrierId];
    if (!c) return { x: 0, y: 0 };
    const d = b.dir ?? { x: 0, y: 0 };
    return { x: c.pos.x + d.x * BALL_OFFSET, y: c.pos.y + d.y * BALL_OFFSET };
  }
  const to = travelEnd(snapshot, b);
  if (now === undefined) return to;
  const total = dist(b.from, to);
  const t = total < 1e-6 ? 1 : clamp(((now - b.t0) / 1000) * BALL_SPEED / total, 0, 1);
  return lerp(b.from, to, t);
}

/** End point of a travelling ball (a pass follows its receiver). */
export function travelEnd(snapshot: Snapshot, b: Extract<Ball, { kind: 'travelling' }>): Vec2 {
  return (b.toId && snapshot.players[b.toId]?.pos) || b.to;
}

export function travelDone(snapshot: Snapshot, now: number): boolean {
  const b = snapshot.ball;
  if (b.kind !== 'travelling') return false;
  return ((now - b.t0) / 1000) * BALL_SPEED >= dist(b.from, travelEnd(snapshot, b));
}
