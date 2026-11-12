import { effectiveCarrier } from '../engine/phase';
import { dist } from '../model/geometry';
import type { BoardState, Vec2 } from '../model/types';

/**
 * One animation step: every movable player closes up to `maxStep` metres on
 * their target. Returns the new positions of the players that moved, or null
 * when everyone has arrived. Pure, so tests can run the same loop as the app.
 */
export function glideStep(board: BoardState, targets: Record<string, Vec2>, maxStep: number): Record<string, Vec2> | null {
  const carrierId = effectiveCarrier(board.snapshot);
  const out: Record<string, Vec2> = {};
  let moved = false;
  for (const [id, target] of Object.entries(targets)) {
    const ps = board.snapshot.players[id];
    if (!ps || ps.pinned || id === carrierId) continue;
    const d = dist(ps.pos, target);
    if (d < 1e-6) continue;
    const k = d <= maxStep ? 1 : maxStep / d;
    out[id] = k === 1 ? target : { x: ps.pos.x + (target.x - ps.pos.x) * k, y: ps.pos.y + (target.y - ps.pos.y) * k };
    moved = true;
  }
  return moved ? out : null;
}

/** True when a target is far enough from the player to be worth drawing a ghost. */
export const needsGhost = (pos: Vec2, target: Vec2): boolean => dist(pos, target) > 0.35;
