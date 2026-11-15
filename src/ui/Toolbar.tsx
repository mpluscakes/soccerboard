import { useEffect, useState } from 'react';
import { clampViewport, sectionViewport, viewportOnPitch, type Section } from '../board/viewport';
import { LEVELS } from '../engine/levels';
import { teamOf } from '../model/geometry';
import type { LevelId, Perspective } from '../model/types';
import { useBoard } from '../store/boardStore';

const COMPACT_QUERY = '(max-width: 720px), (max-height: 520px)';

/** Phone-sized screen: the toolbar shrinks to a few icons and the rest moves into the settings sheet. */
export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const on = (): void => setCompact(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
}

// ---- icons (24 x 24, drawn with the text colour) ----
const svg = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

/** Back to the start: an arrow going round to the beginning. */
const ResetIcon = () => (
  <svg {...svg}>
    <path d="M4 12a8 8 0 1 0 2.6-5.9" />
    <path d="M4 4v5h5" />
  </svg>
);
/** A map pin with a line through it. */
const UnpinIcon = () => (
  <svg {...svg}>
    <path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z" />
    <path d="M4 4l16 16" />
  </svg>
);
const GearIcon = () => (
  <svg {...svg}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
  </svg>
);

// ---- the controls, shared by the full toolbar and the settings sheet ----
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'full', label: 'Whole pitch' },
  { id: 'attack-half', label: 'Attacking half' },
  { id: 'defend-half', label: 'Defending half' },
  { id: 'attack-third', label: 'Attacking third' },
  { id: 'middle-third', label: 'Middle third' },
  { id: 'defend-third', label: 'Defending third' },
];

/** Zoom presets, "draw a box" and the keep-play-inside switch. onDone closes whatever holds them. */
export function ViewItems({ onDone, role }: { onDone: () => void; role?: 'menuitem' }) {
  const board = useBoard((s) => s.board);
  const { dispatch, setUi } = useBoard.getState();
  const { pitch, activeArea } = board.setup;
  const dir = teamOf(board.setup, 'A').attacksDir;
  const lockable = viewportOnPitch(board.view.viewport, pitch);
  return (
    <>
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          role={role}
          data-testid={`view-${s.id}`}
          onClick={() => {
            dispatch({ type: 'SET_VIEW', patch: { viewport: clampViewport(sectionViewport(pitch, s.id, dir), pitch) } });
            onDone();
          }}
        >
          {s.label}
        </button>
      ))}
      <button
        role={role}
        onClick={() => {
          setUi({ frameMode: true });
          onDone();
        }}
      >
        Draw a box to zoom…
      </button>
      {role && <hr />}
      {activeArea ? (
        <button
          role={role}
          onClick={() => {
            dispatch({ type: 'SET_ACTIVE_AREA', area: null }, { commit: true });
            onDone();
          }}
        >
          Use the whole pitch again
        </button>
      ) : (
        <button
          role={role}
          disabled={!lockable}
          title="Players and their targets stay inside the part of the pitch you can see"
          onClick={() => {
            if (lockable) dispatch({ type: 'SET_ACTIVE_AREA', area: lockable }, { commit: true });
            onDone();
          }}
        >
          Keep play inside this view
        </button>
      )}
    </>
  );
}

function ViewMenu() {
  const close = (): void => useBoard.getState().setUi({ viewMenuOpen: false });
  return (
    <>
      <div className="backdrop clear" onPointerDown={close} />
      <div className="popover view-menu" data-testid="view-menu" role="menu">
        <ViewItems onDone={close} role="menuitem" />
      </div>
    </>
  );
}

export function PauseButton() {
  const paused = useBoard((s) => s.board.view.paused);
  return (
    <button
      data-testid="pause"
      className={paused ? 'on' : ''}
      aria-pressed={paused}
      aria-label={paused ? 'Play' : 'Pause'}
      onClick={() => useBoard.getState().dispatch({ type: 'SET_VIEW', patch: { paused: !paused } })}
      title="Freeze the players. Their targets still update."
    >
      {paused ? '▶' : '❚❚'}
      <span className="wide"> {paused ? 'Play' : 'Pause'}</span>
    </button>
  );
}

export function ShowMeButton() {
  const frozen = useBoard((s) => s.board.view.paused || !s.board.view.autoMove);
  const showMe = useBoard((s) => s.ui.showMe);
  return (
    <button data-testid="show-me" className="accent" disabled={!frozen || showMe} onClick={() => useBoard.getState().setUi({ showMe: true })} title="Move everyone to their spot">
      Show me
    </button>
  );
}

export function MoveModeSeg() {
  const autoMove = useBoard((s) => s.board.view.autoMove);
  const set = (v: boolean): void => useBoard.getState().dispatch({ type: 'SET_VIEW', patch: { autoMove: v } });
  return (
    <div className="group seg" aria-label="Movement">
      <button data-testid="auto-move" className={autoMove ? 'on' : ''} aria-pressed={autoMove} onClick={() => set(true)}>
        Auto<span className="wide">-move</span>
      </button>
      <button data-testid="hint-only" className={!autoMove ? 'on' : ''} aria-pressed={!autoMove} onClick={() => set(false)}>
        Hint<span className="wide"> only</span>
      </button>
    </div>
  );
}

export function PerspectiveSelect() {
  const perspective = useBoard((s) => s.board.view.perspective);
  return (
    <select
      data-testid="perspective"
      value={perspective}
      onChange={(e) => useBoard.getState().dispatch({ type: 'SET_VIEW', patch: { perspective: e.target.value as Perspective } })}
    >
      <option value="both">Explain both</option>
      <option value="attack">Attackers</option>
      <option value="defend">Defenders</option>
    </select>
  );
}

export function LevelSelect() {
  const levelId = useBoard((s) => s.board.view.levelId);
  return (
    <select data-testid="level" value={levelId} onChange={(e) => useBoard.getState().dispatch({ type: 'SET_VIEW', patch: { levelId: Number(e.target.value) as LevelId } })}>
      {Object.values(LEVELS).map((l) => (
        <option key={l.id} value={l.id}>
          Level {l.id} · {l.name}
        </option>
      ))}
      <option value={3} disabled>
        Level 3 · Tactics (later)
      </option>
    </select>
  );
}

export function UndoRedo() {
  const canUndo = useBoard((s) => s.canUndo);
  const canRedo = useBoard((s) => s.canRedo);
  const { undo, redo } = useBoard.getState();
  return (
    <>
      <button data-testid="undo" disabled={!canUndo} onClick={undo} aria-label="Undo" title="Undo (Ctrl+Z)">
        ↶<span className="wide"> Undo</span>
      </button>
      <button data-testid="redo" disabled={!canRedo} onClick={redo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
        ↷<span className="wide"> Redo</span>
      </button>
    </>
  );
}

const pinnedCount = (s: ReturnType<typeof useBoard.getState>): number => Object.values(s.board.snapshot.players).filter((p) => p.pinned).length;

function unpinAll(): void {
  const s = useBoard.getState();
  if (pinnedCount(s) === 0) return;
  s.beginGesture();
  for (const [id, p] of Object.entries(s.board.snapshot.players)) if (p.pinned) s.dispatch({ type: 'UNPIN', id });
}

const fitAll = (): void => {
  const s = useBoard.getState();
  s.dispatch({ type: 'SET_VIEW', patch: { viewport: sectionViewport(s.board.setup.pitch, 'full', 1) } });
};

/** Laptops and tablets: everything in the bar. */
function FullBar() {
  const viewMenuOpen = useBoard((s) => s.ui.viewMenuOpen);
  const pinned = useBoard(pinnedCount);
  const { reset, setUi } = useBoard.getState();

  return (
    <header className="toolbar" data-testid="toolbar">
      <div className="group seg" role="tablist" aria-label="Mode">
        <button role="tab" aria-selected className="on">
          Sandbox
        </button>
        <button role="tab" aria-selected={false} disabled title="Step-by-step lessons are coming later" data-testid="mode-lesson">
          Lesson
        </button>
      </div>

      <div className="group">
        <PauseButton />
        <ShowMeButton />
      </div>

      <MoveModeSeg />

      <div className="group">
        <label>
          <span className="wide">Explain</span>
          <PerspectiveSelect />
        </label>
        <label>
          <span className="wide">Level</span>
          <LevelSelect />
        </label>
      </div>

      <div className="group">
        <UndoRedo />
        <button data-testid="reset" onClick={reset} title="Put everyone back on their starting spots">
          Reset
        </button>
        {pinned > 0 && (
          <button data-testid="unpin-all" title="Let every pinned player move on their own again" onClick={unpinAll}>
            Unpin {pinned}
          </button>
        )}
      </div>

      <div className="group">
        <button data-testid="fit" onClick={fitAll}>
          Fit
        </button>
        <div className="anchor">
          <button data-testid="view-button" aria-haspopup="menu" aria-expanded={viewMenuOpen} onClick={() => setUi({ viewMenuOpen: !viewMenuOpen })}>
            View ▾
          </button>
          {viewMenuOpen && <ViewMenu />}
        </div>
        <button data-testid="setup-button" aria-label="Settings" onClick={() => setUi({ setupOpen: true })}>
          ⚙ Setup
        </button>
      </div>
    </header>
  );
}

/**
 * Phones: one slim row. Reset and unpin are the buttons used all the time, so
 * they stay; everything else is behind the gear. Play and Show me appear only
 * when the players are frozen, so nobody is left stuck in pause or hint mode.
 */
function CompactBar() {
  const levelId = useBoard((s) => s.board.view.levelId);
  const paused = useBoard((s) => s.board.view.paused);
  const autoMove = useBoard((s) => s.board.view.autoMove);
  const pinned = useBoard(pinnedCount);
  const { reset, setUi } = useBoard.getState();
  const level = LEVELS[levelId];

  return (
    <header className="toolbar compact" data-testid="toolbar">
      <button className="level-chip" data-testid="level-chip" onClick={() => setUi({ setupOpen: true })} title="Change the level and other settings">
        Level {levelId}
        {level ? <span className="level-name"> · {level.name}</span> : null}
      </button>
      <div className="group end">
        {paused && <PauseButton />}
        {(paused || !autoMove) && <ShowMeButton />}
        <button className="icon" data-testid="unpin-all" aria-label={`Unpin all players (${pinned} pinned)`} title="Let every pinned player move on their own again" disabled={pinned === 0} onClick={unpinAll}>
          <UnpinIcon />
          {pinned > 0 && <span className="badge">{pinned}</span>}
        </button>
        <button className="icon" data-testid="reset" aria-label="Reset" title="Put everyone back on their starting spots" onClick={reset}>
          <ResetIcon />
        </button>
        <button className="icon" data-testid="setup-button" aria-label="Settings" onClick={() => setUi({ setupOpen: true })}>
          <GearIcon />
        </button>
      </div>
    </header>
  );
}

export function Toolbar() {
  return useCompact() ? <CompactBar /> : <FullBar />;
}

/** The toolbar controls that live in the settings sheet on a phone. */
export function PlayControls({ onDone }: { onDone: () => void }) {
  return (
    <>
      <h3>Play</h3>
      <div className="grid">
        <label className="field">
          <span>Level</span>
          <LevelSelect />
        </label>
        <label className="field">
          <span>Explain</span>
          <PerspectiveSelect />
        </label>
      </div>
      <div className="chips">
        <MoveModeSeg />
        <PauseButton />
        <ShowMeButton />
        <UndoRedo />
      </div>
      <h3>View</h3>
      <div className="chips" data-testid="view-menu">
        <ViewItems onDone={onDone} />
      </div>
    </>
  );
}
