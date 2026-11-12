import { create } from 'zustand';
import type { EngineResult } from '../engine/types';
import { initialSnapshot, makeSetup, newBoard, type SetupOptions } from '../model/presets';
import { reduce } from '../model/reduce';
import type { Action, BoardState, Vec2 } from '../model/types';
import { History } from './history';

export interface UiState {
  /** Player whose reason is shown next to You's. */
  selectedId: string | null;
  /** Carrier tapped and waiting for a teammate tap (pass). */
  passFromId: string | null;
  /** Open player menu and where to draw it (CSS px). */
  menu: { id: string; x: number; y: number; openedAt: number } | null;
  setupOpen: boolean;
  viewMenuOpen: boolean;
  /** Next drag on the grass frames a rectangle to zoom to. */
  frameMode: boolean;
  /** Dotted aim line while dragging from a held ball (metres). */
  aim: { from: Vec2; to: Vec2 } | null;
  /** "Show me": glide to the current targets once, even when paused or hint-only. */
  showMe: boolean;
  /** Debug overlay: engine time per run. */
  debug: boolean;
  engineMs: number;
  engineCoarse: boolean;
  /** Last options used for a new board (pre-fills the setup sheet). */
  setupOptions: SetupOptions;
}

export interface BoardStore {
  board: BoardState;
  engine: EngineResult | null;
  ui: UiState;
  canUndo: boolean;
  canRedo: boolean;
  /** Apply an action. commit=true records an undo step first. */
  dispatch(action: Action, opts?: { commit?: boolean }): void;
  /** Record one undo step for a gesture that then sends many live actions. */
  beginGesture(): void;
  undo(): void;
  redo(): void;
  /** Back to the setup snapshot (undoable). */
  reset(): void;
  startNewBoard(options: SetupOptions): void;
  /** Replace the whole board (restore from autosave). */
  loadBoard(board: BoardState): void;
  setEngine(result: EngineResult | null, ms?: number, coarse?: boolean): void;
  setUi(patch: Partial<UiState>): void;
}

const history = new History<BoardState>();

/** Undo restores the pitch, players and ball, but not zoom, level or other view settings. */
const restore = (current: BoardState, saved: BoardState): BoardState => ({
  ...saved,
  view: { ...current.view, youId: saved.view.youId },
});

export const useBoard = create<BoardStore>((set, get) => {
  const flags = (): Pick<BoardStore, 'canUndo' | 'canRedo'> => ({ canUndo: history.canUndo, canRedo: history.canRedo });
  return {
    board: newBoard(),
    engine: null,
    canUndo: false,
    canRedo: false,
    ui: {
      selectedId: null,
      passFromId: null,
      menu: null,
      setupOpen: false,
      viewMenuOpen: false,
      frameMode: false,
      aim: null,
      showMe: false,
      debug: false,
      engineMs: 0,
      engineCoarse: false,
      setupOptions: { preset: '5v5' },
    },
    dispatch(action, opts) {
      const before = get().board;
      const after = reduce(before, action);
      if (after === before) return;
      if (opts?.commit) history.push(before);
      set({ board: after, ...flags() });
    },
    beginGesture() {
      history.push(get().board);
      set(flags());
    },
    undo() {
      const cur = get().board;
      const prev = history.undo(cur);
      if (prev) set({ board: restore(cur, prev), engine: null, ...flags(), ui: { ...get().ui, passFromId: null, aim: null } });
    },
    redo() {
      const cur = get().board;
      const next = history.redo(cur);
      if (next) set({ board: restore(cur, next), engine: null, ...flags(), ui: { ...get().ui, passFromId: null, aim: null } });
    },
    reset() {
      const { board } = get();
      get().dispatch({ type: 'LOAD_SNAPSHOT', snapshot: initialSnapshot(board.setup) }, { commit: true });
      set({ ui: { ...get().ui, passFromId: null, selectedId: null, aim: null } });
    },
    startNewBoard(options) {
      history.clear();
      const board = reduce(get().board, { type: 'NEW_BOARD', setup: makeSetup(options) });
      set({
        board,
        engine: null,
        ...flags(),
        ui: { ...get().ui, selectedId: null, passFromId: null, menu: null, aim: null, setupOpen: false, setupOptions: options },
      });
    },
    loadBoard(board) {
      history.clear();
      set({ board, engine: null, ...flags() });
    },
    setEngine(result, ms, coarse) {
      const ui = get().ui;
      const next = ms === undefined ? ui : { ...ui, engineMs: ms, engineCoarse: !!coarse };
      set({ engine: result, ui: next });
    },
    setUi(patch) {
      set({ ui: { ...get().ui, ...patch } });
    },
  };
});

export type BoardStoreApi = typeof useBoard;
