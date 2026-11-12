import { clamp, clampToRect } from '../model/geometry';
import type { Rect, Vec2 } from '../model/types';

/** Search radius around a player: clamp(0.2 x pitch length, 8, 20) metres. */
export const searchRadius = (pitchLength: number): number => clamp(0.2 * pitchLength, 8, 20);

/**
 * Points on a world-aligned grid within `radius` of `centre`, inside `bounds`.
 * The grid is tied to the pitch, not the player, so targets do not shimmer
 * as a player glides.
 */
export function gridCandidates(centre: Vec2, radius: number, step: number, bounds: Rect): Vec2[] {
  const out: Vec2[] = [];
  const x0 = Math.ceil(Math.max(centre.x - radius, bounds.x) / step - 1e-9);
  const x1 = Math.floor(Math.min(centre.x + radius, bounds.x + bounds.w) / step + 1e-9);
  const y0 = Math.ceil(Math.max(centre.y - radius, bounds.y) / step - 1e-9);
  const y1 = Math.floor(Math.min(centre.y + radius, bounds.y + bounds.h) / step + 1e-9);
  const r2 = radius * radius;
  for (let i = x0; i <= x1; i++) {
    for (let j = y0; j <= y1; j++) {
      const x = i * step;
      const y = j * step;
      const dx = x - centre.x;
      const dy = y - centre.y;
      if (dx * dx + dy * dy <= r2) out.push({ x, y });
    }
  }
  return out;
}

/** Shrink a rectangle by a margin on every side (never below zero size). */
export function shrink(r: Rect, margin: number): Rect {
  const mx = Math.min(margin, r.w / 2);
  const my = Math.min(margin, r.h / 2);
  return { x: r.x + mx, y: r.y + my, w: r.w - 2 * mx, h: r.h - 2 * my };
}

export const clip = (p: Vec2, bounds: Rect): Vec2 => clampToRect(p, bounds);
