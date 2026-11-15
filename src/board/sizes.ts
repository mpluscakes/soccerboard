import { BALL_OFFSET, ballPos } from '../model/geometry';
import type { Snapshot, Vec2 } from '../model/types';

export const PLAYER_RADIUS_M = 0.8; // tokens are about 1.6 m across
export const BALL_RADIUS_M = 0.35;
export const MIN_HIT_PX = 22; // 44 x 44 px hit area at every zoom
export const BALL_HIT_PX = 34; // a loose ball is small, so it gets a generous hit area

/** Drawn radius of a player token in metres at this zoom (never tiny on screen). */
export function playerRadius(scale: number): number {
  // Never smaller than 26 to 32 px across. Tokens are drawn smaller than their
  // 44 px hit area so a presser 1.5 m from the carrier does not hide them.
  const minPx = Math.min(16, Math.max(13, scale * 1.1));
  return Math.max(PLAYER_RADIUS_M, minPx / scale);
}
export const ballRadius = (scale: number): number => Math.max(BALL_RADIUS_M, 9 / scale);
/**
 * Hit radius of the ball in metres. A held ball keeps the ordinary 44 px area:
 * a bigger one would take over the carrier, who is dragged far more often.
 */
export const ballHitRadius = (scale: number, held = false): number => Math.max(ballRadius(scale), (held ? MIN_HIT_PX : BALL_HIT_PX) / scale);
/** Hit radius in metres: the drawn size or 22 px, whichever is larger. */
export const hitRadius = (drawn: number, scale: number): number => Math.max(drawn, MIN_HIT_PX / scale);

/**
 * Where the ball is drawn. A held ball sits 0.7 m ahead of the carrier in the
 * model; on screen it is pushed out just past the edge of the (enlarged) token
 * so it stays visible.
 */
export function ballDrawPos(snapshot: Snapshot, scale: number, now: number): Vec2 {
  const b = snapshot.ball;
  if (b.kind !== 'held') return ballPos(snapshot, now);
  const c = snapshot.players[b.carrierId];
  if (!c) return ballPos(snapshot, now);
  const d = b.dir ?? { x: 0, y: 0 };
  const off = Math.max(BALL_OFFSET, playerRadius(scale) * 1.1);
  return { x: c.pos.x + d.x * off, y: c.pos.y + d.y * off };
}
