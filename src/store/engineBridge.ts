import { computeTargets, getLevel } from '../engine';
import type { EngineResult } from '../engine';
import { travelDone } from '../model/geometry';
import type { Setup, Snapshot } from '../model/types';
import type { BoardStoreApi } from './boardStore';
import { glideStep } from './glide';

const ENGINE_INTERVAL_MS = 66; // re-run at most ~15 times a second
const BUDGET_MS = 8;

/**
 * Connects the pure engine to the store: re-runs it (throttled) whenever the
 * board changes, and glides players toward their targets every frame.
 * The engine never touches the screen; this is the only place it is called.
 */
export function startEngineBridge(store: BoardStoreApi): () => void {
  let raf = 0;
  let lastFrame = performance.now();
  let lastRun = -Infinity;
  let seenSetup: Setup | null = null;
  let seenSnapshot: Snapshot | null = null;
  let seenLevel = 0;
  let prev: EngineResult | undefined;
  let coarse = false;

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;

    let s = store.getState();
    if (s.board.snapshot.ball.kind === 'travelling' && travelDone(s.board.snapshot, Date.now())) {
      s.dispatch({ type: 'BALL_ARRIVE' });
      s = store.getState();
    }

    const { setup, snapshot, view } = s.board;
    const changed = setup !== seenSetup || snapshot !== seenSnapshot || view.levelId !== seenLevel || !s.engine;
    if (changed && now - lastRun >= ENGINE_INTERVAL_MS) {
      // A new pitch or level starts fresh; last tick's targets would not apply.
      if (setup.players !== seenSetup?.players || setup.pitch !== seenSetup?.pitch || view.levelId !== seenLevel || !s.engine) prev = undefined;
      const t0 = performance.now();
      prev = computeTargets(s.board, getLevel(view.levelId), prev, { coarse });
      const ms = performance.now() - t0;
      // Over budget: the next run uses the coarse grid. Back to the fine grid once there is headroom.
      const wasCoarse = coarse;
      coarse = coarse ? ms > BUDGET_MS / 4 : ms > BUDGET_MS;
      seenSetup = setup;
      seenSnapshot = snapshot;
      seenLevel = view.levelId;
      lastRun = now;
      s.setEngine(prev, ms, wasCoarse);
      s = store.getState();
    }

    const gliding = (s.board.view.autoMove && !s.board.view.paused) || s.ui.showMe;
    if (gliding && s.engine) {
      const moved = glideStep(s.board, s.engine.targets, s.board.view.glideSpeed * dt);
      if (moved) s.dispatch({ type: 'APPLY_TARGETS', targets: moved });
      else if (s.ui.showMe && !changed) s.setUi({ showMe: false });
    }
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
