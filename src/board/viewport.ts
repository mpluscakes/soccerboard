import { clamp } from '../model/geometry';
import { fitViewport } from '../model/presets';
import type { PitchSpec, Rect, Vec2 } from '../model/types';

/**
 * The board is drawn in "view" coordinates. In landscape they equal pitch
 * metres. In portrait the pitch is rotated a quarter turn so it still fills
 * the screen (Team A's attacking direction, +x, points up).
 */
export type Orient = 'landscape' | 'portrait';

export const toView = (p: Vec2, o: Orient): Vec2 => (o === 'landscape' ? p : { x: p.y, y: -p.x });
export const fromView = (p: Vec2, o: Orient): Vec2 => (o === 'landscape' ? p : { x: -p.y, y: p.x });
export const rectToView = (r: Rect, o: Orient): Rect => (o === 'landscape' ? r : { x: r.y, y: -(r.x + r.w), w: r.h, h: r.w });
export const rectFromView = (r: Rect, o: Orient): Rect => (o === 'landscape' ? r : { x: -(r.y + r.h), y: r.x, w: r.h, h: r.w });
/** SVG transform that draws pitch-metre shapes in view coordinates. */
export const viewTransform = (o: Orient): string | undefined => (o === 'landscape' ? undefined : 'matrix(0,-1,1,0,0,0)');

export interface Size {
  w: number;
  h: number;
}

/** How a view rectangle lands on the screen (SVG "xMidYMid meet"). */
export interface Projection {
  scale: number; // CSS px per metre
  ox: number; // px offset of the view rect inside the element
  oy: number;
  vb: Rect;
}

export function project(vb: Rect, size: Size): Projection {
  const scale = Math.max(1e-6, Math.min(size.w / vb.w, size.h / vb.h));
  return { scale, ox: (size.w - vb.w * scale) / 2, oy: (size.h - vb.h * scale) / 2, vb };
}

/** Element-relative px -> view coordinates. */
export const pxToView = (px: Vec2, p: Projection): Vec2 => ({ x: p.vb.x + (px.x - p.ox) / p.scale, y: p.vb.y + (px.y - p.oy) / p.scale });
export const viewToPx = (v: Vec2, p: Projection): Vec2 => ({ x: (v.x - p.vb.x) * p.scale + p.ox, y: (v.y - p.vb.y) * p.scale + p.oy });

const MIN_SPAN = 6; // metres: closest zoom

/** Keep a viewport inside the fit rectangle and within the zoom limits. */
export function clampViewport(v: Rect, pitch: PitchSpec): Rect {
  const fit = fitViewport(pitch);
  const k = Math.max(MIN_SPAN / Math.min(v.w, v.h), 1);
  let w = v.w * k;
  let h = v.h * k;
  // Zoomed out past the whole pitch: snap to the fit view.
  if (w > fit.w + 1e-6 || h > fit.h + 1e-6) return fit;
  const cx = clamp(v.x + v.w / 2, fit.x + w / 2, fit.x + fit.w - w / 2);
  const cy = clamp(v.y + v.h / 2, fit.y + h / 2, fit.y + fit.h - h / 2);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * A view rectangle of the given size, placed so that view point `anchor`
 * appears at element pixel `at`. Used for wheel zoom and pinch.
 */
export function anchoredView(w: number, h: number, anchor: Vec2, at: Vec2, size: Size): Rect {
  const scale = Math.min(size.w / w, size.h / h);
  const ox = (size.w - w * scale) / 2;
  const oy = (size.h - h * scale) / 2;
  return { x: anchor.x - (at.x - ox) / scale, y: anchor.y - (at.y - oy) / scale, w, h };
}

export type Section = 'full' | 'attack-half' | 'defend-half' | 'defend-third' | 'middle-third' | 'attack-third';

/** Named sections of the pitch, from Team A's point of view (dir = the way A attacks). */
export function sectionViewport(pitch: PitchSpec, section: Section, dir: 1 | -1): Rect {
  const fit = fitViewport(pitch);
  if (section === 'full') return fit;
  const m = fit.w - pitch.length; // total margin along the length
  const L = pitch.length;
  const along = (from: number, to: number): Rect => {
    // from/to as fractions of the length measured from A's own goal line
    const a = dir === 1 ? -L / 2 + from * L : L / 2 - to * L;
    const b = a + (to - from) * L;
    // Margin (room for the goal) only where the section reaches the end of the pitch.
    const x0 = a <= -L / 2 + 1e-6 ? a - m / 2 : a;
    const x1 = b >= L / 2 - 1e-6 ? b + m / 2 : b;
    return { x: x0, y: fit.y, w: x1 - x0, h: fit.h };
  };
  switch (section) {
    case 'defend-half':
      return along(0, 0.5);
    case 'attack-half':
      return along(0.5, 1);
    case 'defend-third':
      return along(0, 1 / 3);
    case 'middle-third':
      return along(1 / 3, 2 / 3);
    case 'attack-third':
      return along(2 / 3, 1);
  }
}

/** The part of a viewport that is on the pitch (used for "lock play to this view"). */
export function viewportOnPitch(v: Rect, pitch: PitchSpec): Rect | null {
  const x0 = Math.max(v.x, -pitch.length / 2);
  const y0 = Math.max(v.y, -pitch.width / 2);
  const x1 = Math.min(v.x + v.w, pitch.length / 2);
  const y1 = Math.min(v.y + v.h, pitch.width / 2);
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
