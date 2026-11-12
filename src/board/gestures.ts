import { CONTROL_RADIUS, ballPos, dist, sub, teamOf } from '../model/geometry';
import type { Rect, Vec2 } from '../model/types';
import type { BoardStoreApi } from '../store/boardStore';
import { ballDrawPos, ballRadius, hitRadius, playerRadius } from './sizes';
import {
  anchoredView,
  clampViewport,
  fromView,
  project,
  pxToView,
  rectFromView,
  rectToView,
  type Orient,
  type Projection,
  type Size,
} from './viewport';

export const DRAG_THRESHOLD_PX = 6; // a drag starts after 6 px so taps are not misread
export const LONG_PRESS_MS = 500;
export const BALL_ID = '__ball__';

export interface HitTarget {
  id: string;
  pos: Vec2;
  /** hit radius in metres */
  r: number;
}

/** The token under a point: the nearest centre among the hit areas that contain it. */
export function hitTest(p: Vec2, targets: HitTarget[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = dist(p, t.pos);
    if (d <= t.r && d < bestD) {
      best = t.id;
      bestD = d;
    }
  }
  return best;
}

/** What the gesture layer needs to know about the element it listens on. */
export interface BoardGeometry {
  el: Element;
  orient: Orient;
  size: Size;
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'pending'; hit: string | null; startPx: Vec2; startWorld: Vec2; timer: ReturnType<typeof setTimeout> | undefined; pan: boolean }
  | { kind: 'player'; id: string; offset: Vec2; carrier: boolean }
  | { kind: 'ball'; offset: Vec2 }
  | { kind: 'aim' }
  | { kind: 'pan'; lastPx: Vec2 }
  | { kind: 'frame'; start: Vec2 }
  | { kind: 'pinch'; d0: number; anchor: Vec2; w0: number; h0: number }
  | { kind: 'done' }; // long-press fired; ignore until the finger lifts

/**
 * All pointer handling for the board. One code path for finger and mouse
 * (Pointer Events); the store is the only thing it changes.
 */
export class Gestures {
  private mode: Mode = { kind: 'idle' };
  private primary: number | null = null;
  private touches = new Map<number, Vec2>();
  spaceHeld = false;
  private panEndedAt = -Infinity;
  /** Rectangle being framed (metres), for the board to draw. */
  onFrame: (r: Rect | null) => void = () => undefined;

  constructor(
    private store: BoardStoreApi,
    private geometry: () => BoardGeometry | null,
  ) {}

  // ---- coordinates ----
  private proj(g: BoardGeometry): Projection {
    return project(rectToView(this.store.getState().board.view.viewport, g.orient), g.size);
  }
  private elPx(e: { clientX: number; clientY: number }, g: BoardGeometry): Vec2 {
    const r = g.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private world(px: Vec2, g: BoardGeometry): Vec2 {
    return fromView(pxToView(px, this.proj(g)), g.orient);
  }

  hitTargets(scale: number): HitTarget[] {
    const { snapshot } = this.store.getState().board;
    const pr = playerRadius(scale);
    const out: HitTarget[] = Object.entries(snapshot.players).map(([id, s]) => ({ id, pos: s.pos, r: hitRadius(pr, scale) }));
    out.push({ id: BALL_ID, pos: ballDrawPos(snapshot, scale, Date.now()), r: hitRadius(ballRadius(scale), scale) });
    return out;
  }

  // ---- pointer events ----
  down(e: PointerEvent): void {
    const g = this.geometry();
    if (!g) return;
    const px = this.elPx(e, g);
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, px);
      if (this.touches.size === 2) return this.startPinch(g);
      if (this.touches.size > 2) return;
    }
    if (this.mode.kind !== 'idle') return;
    const s = this.store.getState();
    if (s.ui.menu) s.setUi({ menu: null });
    this.primary = e.pointerId;
    try {
      g.el.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    const world = this.world(px, g);
    const hit = s.ui.frameMode ? null : hitTest(world, this.hitTargets(this.proj(g).scale));
    const pan = e.button === 1 || e.button === 2 || this.spaceHeld;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (hit && hit !== BALL_ID && e.button === 0 && !pan) {
      timer = setTimeout(() => {
        if (this.mode.kind !== 'pending') return;
        this.mode = { kind: 'done' };
        this.openMenu(hit, e.clientX, e.clientY);
      }, LONG_PRESS_MS);
    }
    this.mode = { kind: 'pending', hit: pan ? null : hit, startPx: px, startWorld: world, timer, pan };
  }

  move(e: PointerEvent): void {
    const g = this.geometry();
    if (!g) return;
    const px = this.elPx(e, g);
    if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, px);
    if (this.mode.kind === 'pinch') return this.movePinch(g);
    if (e.pointerId !== this.primary) return;
    const s = this.store.getState();
    const m = this.mode;

    if (m.kind === 'pending') {
      if (dist(px, m.startPx) < DRAG_THRESHOLD_PX) return;
      clearTimeout(m.timer);
      this.startDrag(m, px);
    }
    const world = this.world(px, g);
    const mode = this.mode;
    switch (mode.kind) {
      case 'player':
        s.dispatch({ type: 'MOVE_PLAYER', id: mode.id, to: { x: world.x + mode.offset.x, y: world.y + mode.offset.y } });
        break;
      case 'ball':
        s.dispatch({ type: 'MOVE_BALL', snap: false, to: { x: world.x + mode.offset.x, y: world.y + mode.offset.y } });
        break;
      case 'aim':
        s.setUi({ aim: { from: ballPos(s.board.snapshot), to: world } });
        break;
      case 'pan': {
        const p = this.proj(g);
        const dv = { x: (px.x - mode.lastPx.x) / p.scale, y: (px.y - mode.lastPx.y) / p.scale };
        const vb = { ...p.vb, x: p.vb.x - dv.x, y: p.vb.y - dv.y };
        this.setViewport(vb, g);
        mode.lastPx = px;
        break;
      }
      case 'frame':
        this.onFrame(rectOf(mode.start, world));
        break;
    }
  }

  private startDrag(m: Extract<Mode, { kind: 'pending' }>, px: Vec2): void {
    const s = this.store.getState();
    const { snapshot } = s.board;
    if (s.ui.frameMode && !m.pan) {
      this.mode = { kind: 'frame', start: m.startWorld };
      return;
    }
    if (m.hit === BALL_ID) {
      if (snapshot.ball.kind === 'held') {
        // Drag from a held ball = aim a kick.
        this.mode = { kind: 'aim' };
      } else if (snapshot.ball.kind === 'loose') {
        s.beginGesture();
        this.mode = { kind: 'ball', offset: sub(snapshot.ball.pos, m.startWorld) };
      } else {
        this.mode = { kind: 'done' };
      }
      return;
    }
    if (m.hit && snapshot.players[m.hit]) {
      const carrier = snapshot.ball.kind === 'held' && snapshot.ball.carrierId === m.hit;
      s.beginGesture();
      // Moving anyone but the carrier pins them where you put them.
      if (!carrier) s.dispatch({ type: 'PIN', id: m.hit });
      s.setUi({ passFromId: null });
      this.mode = { kind: 'player', id: m.hit, offset: sub(snapshot.players[m.hit].pos, m.startWorld), carrier };
      return;
    }
    this.mode = { kind: 'pan', lastPx: px };
  }

  up(e: PointerEvent): void {
    const g = this.geometry();
    this.touches.delete(e.pointerId);
    if (this.mode.kind === 'pinch' || (this.mode.kind === 'done' && this.primary === null)) {
      // After a pinch, wait for every finger to lift before starting anything new.
      this.mode = this.touches.size === 0 ? { kind: 'idle' } : { kind: 'done' };
      return;
    }
    if (e.pointerId !== this.primary) return;
    this.primary = null;
    const m = this.mode;
    this.mode = { kind: 'idle' };
    if (m.kind === 'pan') this.panEndedAt = performance.now();
    if (!g) return;
    const s = this.store.getState();
    const world = this.world(this.elPx(e, g), g);
    switch (m.kind) {
      case 'pending':
        clearTimeout(m.timer);
        if (e.type !== 'pointercancel' && e.button !== 2) this.tap(m.hit);
        break;
      case 'ball':
        // Dropped near a player: it is theirs. Elsewhere it stays loose.
        s.dispatch({ type: 'MOVE_BALL', to: { x: world.x + m.offset.x, y: world.y + m.offset.y } });
        break;
      case 'player': {
        // A player dragged onto a loose ball picks it up.
        const { snapshot } = s.board;
        const me = snapshot.players[m.id];
        if (me && snapshot.ball.kind === 'loose' && dist(me.pos, snapshot.ball.pos) <= CONTROL_RADIUS) {
          s.dispatch({ type: 'MOVE_BALL', to: snapshot.ball.pos });
        }
        break;
      }
      case 'aim':
        s.setUi({ aim: null });
        if (e.type !== 'pointercancel') s.dispatch({ type: 'KICK', to: world, t0: Date.now() }, { commit: true });
        break;
      case 'frame': {
        this.onFrame(null);
        const r = rectOf(m.start, world);
        s.setUi({ frameMode: false });
        if (r.w > 2 && r.h > 2) s.dispatch({ type: 'SET_VIEW', patch: { viewport: clampViewport(r, s.board.setup.pitch) } });
        break;
      }
    }
  }

  cancel(e: PointerEvent): void {
    this.up(e);
  }

  /** Right-click (or long-press on some browsers): open the player menu. */
  contextMenu(e: MouseEvent): void {
    e.preventDefault();
    const g = this.geometry();
    // A right-drag pans; the context-menu event that follows it is not a menu request.
    if (!g || this.mode.kind === 'pan' || performance.now() - this.panEndedAt < 80) return;
    const world = this.world(this.elPx(e, g), g);
    const hit = hitTest(world, this.hitTargets(this.proj(g).scale));
    if (hit && hit !== BALL_ID) {
      if (this.mode.kind === 'pending') {
        clearTimeout(this.mode.timer);
        this.mode = { kind: 'done' };
      }
      this.openMenu(hit, e.clientX, e.clientY);
    }
  }

  wheel(e: WheelEvent): void {
    e.preventDefault();
    const g = this.geometry();
    if (!g) return;
    const p = this.proj(g);
    const px = this.elPx(e, g);
    const k = Math.exp(clampDelta(e.deltaY) * 0.0015);
    this.setViewport(anchoredView(p.vb.w * k, p.vb.h * k, pxToView(px, p), px, g.size), g);
  }

  // ---- taps ----
  private tap(hit: string | null): void {
    const s = this.store.getState();
    const { setup, snapshot } = s.board;
    const carrierId = snapshot.ball.kind === 'held' ? snapshot.ball.carrierId : null;
    const id = hit === BALL_ID ? carrierId : hit;
    if (!id) {
      s.setUi({ selectedId: null, passFromId: null });
      return;
    }
    const from = s.ui.passFromId;
    if (from && from === carrierId && id !== from) {
      const a = setup.players.find((p) => p.id === from);
      const b = setup.players.find((p) => p.id === id);
      if (a && b && teamOf(setup, a.teamId).id === b.teamId) {
        // Tap carrier, then tap a teammate: pass.
        s.dispatch({ type: 'PASS', fromId: from, toId: id, t0: Date.now() }, { commit: true });
        s.setUi({ passFromId: null, selectedId: id });
        return;
      }
    }
    if (id === carrierId) s.setUi({ selectedId: id, passFromId: from === id ? null : id });
    else s.setUi({ selectedId: id, passFromId: null });
  }

  private openMenu(id: string, x: number, y: number): void {
    this.store.getState().setUi({ menu: { id, x, y, openedAt: performance.now() }, passFromId: null });
  }

  // ---- zoom and pan ----
  private setViewport(vb: Rect, g: BoardGeometry): void {
    const s = this.store.getState();
    const viewport = clampViewport(rectFromView(vb, g.orient), s.board.setup.pitch);
    s.dispatch({ type: 'SET_VIEW', patch: { viewport } });
  }

  private startPinch(g: BoardGeometry): void {
    // A second finger turns whatever was happening into a pinch; nothing is undone.
    if (this.mode.kind === 'pending') clearTimeout(this.mode.timer);
    if (this.mode.kind === 'aim') this.store.getState().setUi({ aim: null });
    if (this.mode.kind === 'frame') this.onFrame(null);
    const [a, b] = [...this.touches.values()];
    const p = this.proj(g);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.primary = null;
    this.mode = { kind: 'pinch', d0: Math.max(10, dist(a, b)), anchor: pxToView(mid, p), w0: p.vb.w, h0: p.vb.h };
  }

  private movePinch(g: BoardGeometry): void {
    if (this.mode.kind !== 'pinch' || this.touches.size < 2) return;
    const [a, b] = [...this.touches.values()];
    const k = this.mode.d0 / Math.max(10, dist(a, b));
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // The pitch point that was between the fingers stays between them: zoom and two-finger pan in one.
    this.setViewport(anchoredView(this.mode.w0 * k, this.mode.h0 * k, this.mode.anchor, mid, g.size), g);
  }
}

const clampDelta = (d: number): number => Math.max(-300, Math.min(300, d));
const rectOf = (a: Vec2, b: Vec2): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
