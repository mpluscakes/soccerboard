import { clampViewport, sectionViewport, viewportOnPitch, type Section } from '../board/viewport';
import { LEVELS } from '../engine/levels';
import { teamOf } from '../model/geometry';
import type { LevelId, Perspective } from '../model/types';
import { useBoard } from '../store/boardStore';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'full', label: 'Whole pitch' },
  { id: 'attack-half', label: 'Attacking half' },
  { id: 'defend-half', label: 'Defending half' },
  { id: 'attack-third', label: 'Attacking third' },
  { id: 'middle-third', label: 'Middle third' },
  { id: 'defend-third', label: 'Defending third' },
];

function ViewMenu() {
  const board = useBoard((s) => s.board);
  const dispatch = useBoard((s) => s.dispatch);
  const setUi = useBoard((s) => s.setUi);
  const { pitch, activeArea } = board.setup;
  const dir = teamOf(board.setup, 'A').attacksDir;
  const close = (): void => setUi({ viewMenuOpen: false });
  const lockable = viewportOnPitch(board.view.viewport, pitch);
  return (
    <>
      <div className="backdrop clear" onPointerDown={close} />
      <div className="popover view-menu" data-testid="view-menu" role="menu">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="menuitem"
            onClick={() => {
              dispatch({ type: 'SET_VIEW', patch: { viewport: clampViewport(sectionViewport(pitch, s.id, dir), pitch) } });
              close();
            }}
          >
            {s.label}
          </button>
        ))}
        <button role="menuitem" onClick={() => setUi({ frameMode: true, viewMenuOpen: false })}>
          Draw a box to zoom…
        </button>
        <hr />
        {activeArea ? (
          <button
            role="menuitem"
            onClick={() => {
              dispatch({ type: 'SET_ACTIVE_AREA', area: null }, { commit: true });
              close();
            }}
          >
            Use the whole pitch again
          </button>
        ) : (
          <button
            role="menuitem"
            disabled={!lockable}
            title="Players and their targets stay inside the part of the pitch you can see"
            onClick={() => {
              if (lockable) dispatch({ type: 'SET_ACTIVE_AREA', area: lockable }, { commit: true });
              close();
            }}
          >
            Keep play inside this view
          </button>
        )}
      </div>
    </>
  );
}

export function Toolbar() {
  const view = useBoard((s) => s.board.view);
  const canUndo = useBoard((s) => s.canUndo);
  const canRedo = useBoard((s) => s.canRedo);
  const viewMenuOpen = useBoard((s) => s.ui.viewMenuOpen);
  const showMe = useBoard((s) => s.ui.showMe);
  const pinned = useBoard((s) => Object.values(s.board.snapshot.players).filter((p) => p.pinned).length);
  const { dispatch, undo, redo, reset, setUi } = useBoard.getState();
  const setView = (patch: Partial<typeof view>): void => dispatch({ type: 'SET_VIEW', patch });
  const frozen = view.paused || !view.autoMove;

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
        <button
          data-testid="pause"
          className={view.paused ? 'on' : ''}
          aria-pressed={view.paused}
          aria-label={view.paused ? 'Play' : 'Pause'}
          onClick={() => setView({ paused: !view.paused })}
          title="Freeze the players. Their targets still update."
        >
          {view.paused ? '▶' : '❚❚'}
          <span className="wide"> {view.paused ? 'Play' : 'Pause'}</span>
        </button>
        <button
          data-testid="show-me"
          className="accent"
          disabled={!frozen || showMe}
          onClick={() => setUi({ showMe: true })}
          title="Move everyone to their spot"
        >
          Show me
        </button>
      </div>

      <div className="group seg" aria-label="Movement">
        <button data-testid="auto-move" className={view.autoMove ? 'on' : ''} aria-pressed={view.autoMove} onClick={() => setView({ autoMove: true })}>
          Auto<span className="wide">-move</span>
        </button>
        <button data-testid="hint-only" className={!view.autoMove ? 'on' : ''} aria-pressed={!view.autoMove} onClick={() => setView({ autoMove: false })}>
          Hint<span className="wide"> only</span>
        </button>
      </div>

      <div className="group">
        <label>
          <span className="wide">Explain</span>
          <select data-testid="perspective" value={view.perspective} onChange={(e) => setView({ perspective: e.target.value as Perspective })}>
            <option value="both">Explain both</option>
            <option value="attack">Attackers</option>
            <option value="defend">Defenders</option>
          </select>
        </label>
        <label>
          <span className="wide">Level</span>
          <select data-testid="level" value={view.levelId} onChange={(e) => setView({ levelId: Number(e.target.value) as LevelId })}>
            {Object.values(LEVELS).map((l) => (
              <option key={l.id} value={l.id}>
                Level {l.id} · {l.name}
              </option>
            ))}
            <option value={3} disabled>
              Level 3 · Tactics (later)
            </option>
          </select>
        </label>
      </div>

      <div className="group">
        <button data-testid="undo" disabled={!canUndo} onClick={undo} aria-label="Undo" title="Undo (Ctrl+Z)">
          ↶<span className="wide"> Undo</span>
        </button>
        <button data-testid="redo" disabled={!canRedo} onClick={redo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
          ↷<span className="wide"> Redo</span>
        </button>
        <button data-testid="reset" onClick={reset} title="Put everyone back on their starting spots">
          Reset
        </button>
        {pinned > 0 && (
          <button
            data-testid="unpin-all"
            title="Let every pinned player move on their own again"
            onClick={() => {
              const s = useBoard.getState();
              s.beginGesture();
              for (const [id, p] of Object.entries(s.board.snapshot.players)) if (p.pinned) s.dispatch({ type: 'UNPIN', id });
            }}
          >
            Unpin {pinned}
          </button>
        )}
      </div>

      <div className="group">
        <button data-testid="fit" className="wide" onClick={() => setView({ viewport: sectionViewport(useBoard.getState().board.setup.pitch, 'full', 1) })}>
          Fit
        </button>
        <div className="anchor">
          <button data-testid="view-button" aria-haspopup="menu" aria-expanded={viewMenuOpen} onClick={() => setUi({ viewMenuOpen: !viewMenuOpen })}>
            View ▾
          </button>
          {viewMenuOpen && <ViewMenu />}
        </div>
        <button data-testid="setup-button" aria-label="Setup" onClick={() => setUi({ setupOpen: true })}>
          ⚙<span className="wide"> Setup</span>
        </button>
      </div>
    </header>
  );
}
