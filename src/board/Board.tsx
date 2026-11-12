import { useEffect, useMemo, useRef, useState } from 'react';
import { effectiveCarrier } from '../engine/phase';
import { ballPos, teamOf } from '../model/geometry';
import type { Rect } from '../model/types';
import { useBoard } from '../store/boardStore';
import { needsGhost } from '../store/glide';
import { isExplained } from '../ui/visibility';
import { Ball } from './Ball';
import { Ghost } from './Ghost';
import { Gestures, type BoardGeometry } from './gestures';
import { Pitch } from './Pitch';
import { ballDrawPos, ballRadius, hitRadius, playerRadius } from './sizes';
import { Token } from './Token';
import { project, rectToView, toView, viewTransform, type Orient, type Size } from './viewport';

/** Re-render every frame while `active` (a ball in flight). */
function useFrames(active: boolean): void {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = requestAnimationFrame(function loop() {
      setN((n) => n + 1);
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

export function Board() {
  const board = useBoard((s) => s.board);
  const engine = useBoard((s) => s.engine);
  const selectedId = useBoard((s) => s.ui.selectedId);
  const passFromId = useBoard((s) => s.ui.passFromId);
  const aim = useBoard((s) => s.ui.aim);
  const frameMode = useBoard((s) => s.ui.frameMode);
  const debug = useBoard((s) => s.ui.debug);
  const engineMs = useBoard((s) => s.ui.engineMs);
  const engineCoarse = useBoard((s) => s.ui.engineCoarse);

  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [frame, setFrame] = useState<Rect | null>(null);
  const orient: Orient = size.h > size.w ? 'portrait' : 'landscape';
  const geometry = useRef<BoardGeometry | null>(null);
  geometry.current = svgRef.current && size.w > 0 ? { el: svgRef.current, orient, size } : null;

  const gestures = useMemo(() => new Gestures(useBoard, () => geometry.current), []);
  gestures.onFrame = setFrame;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = (): void => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Non-passive listeners so the page never scrolls or zooms under the board.
    const wheel = (e: WheelEvent): void => gestures.wheel(e);
    const menu = (e: MouseEvent): void => gestures.contextMenu(e);
    const block = (e: Event): void => e.preventDefault();
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('contextmenu', menu);
    el.addEventListener('touchmove', block, { passive: false });
    // No synthetic mouse click after a touch: it would land on a menu that just opened under the finger.
    el.addEventListener('touchend', block, { passive: false });
    el.addEventListener('gesturestart', block);
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('contextmenu', menu);
      el.removeEventListener('touchmove', block);
      el.removeEventListener('touchend', block);
      el.removeEventListener('gesturestart', block);
    };
  }, [gestures]);

  useEffect(() => {
    const typing = (e: KeyboardEvent): boolean => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
    const down = (e: KeyboardEvent): void => {
      if (typing(e)) return;
      if (e.code === 'Space') {
        gestures.spaceHeld = true;
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useBoard.getState().redo();
        else useBoard.getState().undo();
      }
    };
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'Space') gestures.spaceHeld = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [gestures]);

  const { setup, snapshot, view } = board;
  useFrames(snapshot.ball.kind === 'travelling');

  const vb = rectToView(view.viewport, orient);
  const { scale } = project(vb, size.w > 0 ? size : { w: 1, h: 1 });
  const pr = playerRadius(scale);
  const br = ballRadius(scale);
  const carrierId = effectiveCarrier(snapshot);
  const heldBy = snapshot.ball.kind === 'held' ? snapshot.ball.carrierId : null;
  const now = Date.now();

  // You is drawn last so the halo is never hidden.
  const players = [...setup.players].sort((a, b) => Number(a.id === view.youId) - Number(b.id === view.youId));
  const frameView = frame && rectToView(frame, orient);
  const aimFrom = aim && toView(ballDrawPos(snapshot, scale, now), orient);
  const aimTo = aim && toView(aim.to, orient);

  return (
    <div className="board-wrap">
      <svg
        ref={svgRef}
        className={`board${frameMode ? ' framing' : ''}`}
        data-testid="board"
        data-orient={orient}
        data-scale={scale}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={(e) => gestures.down(e.nativeEvent)}
        onPointerMove={(e) => gestures.move(e.nativeEvent)}
        onPointerUp={(e) => gestures.up(e.nativeEvent)}
        onPointerCancel={(e) => gestures.cancel(e.nativeEvent)}
      >
        <g transform={viewTransform(orient)}>
          <Pitch setup={setup} />
        </g>
        {engine &&
          players.map((p) => {
            const s = snapshot.players[p.id];
            const target = engine.targets[p.id];
            if (!s || !target || s.pinned || p.id === carrierId) return null;
            if (!isExplained(board, p.id) || !needsGhost(s.pos, target)) return null;
            return (
              <Ghost
                key={p.id}
                id={p.id}
                from={toView(s.pos, orient)}
                to={toView(target, orient)}
                r={pr}
                color={teamOf(setup, p.teamId).color}
                you={p.id === view.youId}
              />
            );
          })}
        {players.map((p) => {
          const s = snapshot.players[p.id];
          if (!s) return null;
          return (
            <Token
              key={p.id}
              player={p}
              team={teamOf(setup, p.teamId)}
              at={toView(s.pos, orient)}
              r={pr}
              hitR={hitRadius(pr, scale)}
              pinned={s.pinned}
              you={p.id === view.youId}
              selected={p.id === selectedId}
              passing={p.id === passFromId && p.id === heldBy}
              glyphs={view.glyphs}
            />
          );
        })}
        {aimFrom && aimTo && (
          <line
            data-testid="aim-line"
            x1={aimFrom.x}
            y1={aimFrom.y}
            x2={aimTo.x}
            y2={aimTo.y}
            stroke="#ffffff"
            strokeWidth={3}
            strokeDasharray="2 8"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <Ball at={toView(ballDrawPos(snapshot, scale, now), orient)} r={br} hitR={hitRadius(br, scale)} state={snapshot.ball.kind} />
        {frameView && (
          <rect
            x={frameView.x}
            y={frameView.y}
            width={frameView.w}
            height={frameView.h}
            fill="rgba(253,224,71,0.15)"
            stroke="#fde047"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {frameMode && <div className="board-hint">Drag a box around the part you want to see</div>}
      {debug && (
        <div className="debug" data-testid="debug-overlay">
          engine {engineMs.toFixed(1)} ms{engineCoarse ? ' (coarse grid)' : ''} · {setup.players.length} players · ball{' '}
          {ballPos(snapshot, now).x.toFixed(1)}, {ballPos(snapshot, now).y.toFixed(1)}
        </div>
      )}
    </div>
  );
}
