import { add, clamp, clampToRect, dist, distToSegment, homeToWorld, norm, scale, sub } from '../model/geometry';
import type { Vec2 } from '../model/types';
import type { EngineCtx, PlayerInfo, TeamCtx } from './types';

/** 1 at the anchor, falling off smoothly with distance (0.5 at r metres). */
export const closeness = (d: number, r: number): number => 1 / (1 + d / r);

export const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Distance used when handing out a job: whoever had the job last tick counts
 * as a bit closer, so two players at similar distances do not keep swapping.
 */
export function jobDistance(ctx: EngineCtx, p: PlayerInfo, jobId: string, d: number): number {
  return ctx.prev?.[p.id]?.jobId === jobId ? d - 0.08 * ctx.pitch.length : d;
}

/** Players sorted nearest-first to a point (sticky to last tick's job), ties broken by player id. */
export function nearestFirst(ctx: EngineCtx, players: PlayerInfo[], to: Vec2, jobId: string): PlayerInfo[] {
  const d = new Map(players.map((p) => [p.id, jobDistance(ctx, p, jobId, dist(p.pos, to))]));
  return [...players].sort((a, b) => d.get(a.id)! - d.get(b.id)! || byId(a, b));
}

function memo(ctx: EngineCtx, key: string, make: () => Vec2): Vec2 {
  let v = ctx.memo.get(key);
  if (!v) {
    v = make();
    ctx.memo.set(key, v);
  }
  return v;
}

export const teamCtx = (ctx: EngineCtx, player: PlayerInfo): TeamCtx => ctx.teams[player.teamId];

/** Where a teammate will be: this tick's target if decided, else where they are. */
export const plannedPos = (ctx: EngineCtx, p: PlayerInfo): Vec2 => ctx.targets[p.id] ?? p.pos;

let matesCache: { ctx: EngineCtx; id: string; n: number; list: Vec2[] } | null = null;
/** Planned positions of a player's teammates (cached while targets are unchanged). */
export function matePositions(ctx: EngineCtx, player: PlayerInfo): Vec2[] {
  const n = ctx.decided;
  const c = matesCache;
  if (c && c.ctx === ctx && c.id === player.id && c.n === n) return c.list;
  const list: Vec2[] = [];
  for (const mate of ctx.teams[player.teamId].players) if (mate.id !== player.id) list.push(plannedPos(ctx, mate));
  matesCache = { ctx, id: player.id, n, list };
  return list;
}

/** Distance from the closest opponent to the straight line ball -> p. */
let laneCache: { ctx: EngineCtx; id: string; x: number; y: number; v: number } | null = null;
export function laneClearance(ctx: EngineCtx, player: PlayerInfo, p: Vec2): number {
  const c = laneCache;
  if (c && c.ctx === ctx && c.id === player.id && c.x === p.x && c.y === p.y) return c.v;
  const v = laneClearanceRaw(ctx, player, p);
  laneCache = { ctx, id: player.id, x: p.x, y: p.y, v };
  return v;
}
function laneClearanceRaw(ctx: EngineCtx, player: PlayerInfo, p: Vec2): number {
  let best = Infinity;
  for (const o of teamCtx(ctx, player).opponents) {
    const d = distToSegment(o.pos, ctx.ball, p);
    if (d < best) best = d;
  }
  return best;
}

/** Spot the presser wants: 1.5 m from the carrier (or ball) on our goal side. */
export function pressPoint(ctx: EngineCtx, team: TeamCtx): Vec2 {
  return memo(ctx, team.team.id === 'A' ? 'pressA' : 'pressB', () => pressPointRaw(ctx, team));
}
function pressPointRaw(ctx: EngineCtx, team: TeamCtx): Vec2 {
  const from = ctx.carrierId ? ctx.byId[ctx.carrierId].pos : ctx.ball;
  const gap = Math.min(1.5, dist(from, team.ownGoal));
  return clampToRect(add(from, scale(norm(sub(team.ownGoal, from)), gap)), ctx.bounds);
}

/** Spot the cover player wants: 5 m behind and to the inside of the presser. */
export function coverPoint(ctx: EngineCtx, team: TeamCtx, presserId?: string): Vec2 {
  return memo(ctx, team.team.id === 'A' ? 'coverA' : 'coverB', () => coverPointRaw(ctx, team, presserId));
}
function coverPointRaw(ctx: EngineCtx, team: TeamCtx, presserId?: string): Vec2 {
  // Measured from where the presser is heading (they may be pinned somewhere else).
  const press = (presserId && ctx.targets[presserId]) || pressPoint(ctx, team);
  const toGoal = norm(sub(team.ownGoal, press));
  const inside = { x: 0, y: Math.abs(press.y) < 0.5 ? 0 : -Math.sign(press.y) };
  const dir = norm(add(toGoal, scale(inside, 0.35)));
  const d = Math.min(5, Math.max(0, dist(press, team.ownGoal) - 1));
  return clampToRect(add(press, scale(dir, d)), ctx.bounds);
}

/** Goal-side spot for marking one opponent: on the line from them to our goal. */
export function goalSidePoint(ctx: EngineCtx, team: TeamCtx, mark: Vec2): Vec2 {
  const gap = Math.min(ctx.level.goalSideGap, dist(mark, team.ownGoal));
  return clampToRect(add(mark, scale(norm(sub(team.ownGoal, mark)), gap)), ctx.bounds);
}

/** Formation home shifted toward the ball (x by 0.3, y by 0.5 of the ball's offset). */
export function shapeHome(ctx: EngineCtx, player: PlayerInfo): Vec2 {
  return memo(ctx, player.id, () => shapeHomeRaw(ctx, player));
}
function shapeHomeRaw(ctx: EngineCtx, player: PlayerInfo): Vec2 {
  const team = teamCtx(ctx, player);
  const home = homeToWorld(ctx.pitch, team.team, player.home);
  // On our ball the whole team steps up the pitch a little.
  const push = team.phase === 'attack' ? team.dir * 0.15 * ctx.pitch.length : 0;
  return clampToRect({ x: home.x + 0.3 * ctx.ball.x + push, y: home.y + 0.5 * ctx.ball.y }, ctx.bounds);
}

/** Depth and half-width of the keeper's zone (a 6 m zone when the format has no area). */
export function keeperZone(ctx: EngineCtx, team: TeamCtx): { depth: number; halfWidth: number } {
  if (team.keeperArea) return { depth: team.keeperArea.w, halfWidth: team.keeperArea.h / 2 };
  return { depth: Math.min(6, ctx.pitch.length / 2), halfWidth: Math.min(ctx.pitch.width / 2, ctx.pitch.goalWidth / 2 + 3) };
}

/** Where the goalkeeper should stand. */
export function keeperPoint(ctx: EngineCtx, team: TeamCtx): Vec2 {
  return memo(ctx, team.team.id === 'A' ? 'keeperA' : 'keeperB', () => keeperPointRaw(ctx, team));
}
function keeperPointRaw(ctx: EngineCtx, team: TeamCtx): Vec2 {
  const { depth, halfWidth } = keeperZone(ctx, team);
  const goal = team.ownGoal;
  if (team.phase === 'attack') {
    // Our ball: step to one side of the goal, at the area's edge, where a pass back is open.
    const y = Math.min(halfWidth - 0.5, ctx.pitch.goalWidth / 2 + 3);
    const x = goal.x + team.dir * Math.max(1, depth - 1);
    const options = [1, -1].map((side) => {
      const p = clampToRect({ x, y: side * y }, ctx.bounds);
      let clear = Infinity;
      for (const o of team.opponents) clear = Math.min(clear, distToSegment(o.pos, ctx.ball, p));
      return { p, side, clear: Math.min(clear, 3) };
    });
    // Clearer lane wins; then the ball's side; then +y (deterministic).
    const ballSide = ctx.ball.y >= 0 ? 1 : -1;
    options.sort((a, b) => b.clear - a.clear || (b.side === ballSide ? 1 : 0) - (a.side === ballSide ? 1 : 0) || b.side - a.side);
    return options[0].p;
  }
  // Their ball or loose: on the line from the ball to the middle of our goal.
  const ballDist = dist(ctx.ball, goal);
  if (ballDist < 0.01) return clampToRect({ x: goal.x + team.dir, y: 0 }, ctx.bounds);
  const u = scale(sub(ctx.ball, goal), 1 / ballDist);
  const far = clamp((ballDist - depth) / (ctx.pitch.length / 2), 0, 1);
  let d = 1 + (Math.max(1, depth - 0.5) - 1) * far;
  // Stay inside the area: limit by its depth and its width along this line.
  const ux = Math.abs(u.x);
  const uy = Math.abs(u.y);
  if (ux > 1e-6) d = Math.min(d, (depth - 0.25) / ux);
  if (uy > 1e-6) d = Math.min(d, (halfWidth - 0.25) / uy);
  d = Math.min(d, Math.max(0, ballDist - 0.5));
  return clampToRect(add(goal, scale(u, d)), ctx.bounds);
}
