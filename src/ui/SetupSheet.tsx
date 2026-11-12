import { useState } from 'react';
import { nameOf } from '../engine/explain/render';
import { formationLabel, formationsFor } from '../model/formations';
import { PRESETS, PRESET_ORDER, type SetupOptions } from '../model/presets';
import type { PitchPreset } from '../model/types';
import { useBoard } from '../store/boardStore';

function NumberField(props: { label: string; value: number; min: number; max: number; step?: number; testid?: string; onChange: (n: number) => void }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        inputMode="decimal"
        data-testid={props.testid}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) props.onChange(n);
        }}
      />
    </label>
  );
}

/** New-board options (pitch, teams, formations) and the live settings. */
export function SetupSheet() {
  const open = useBoard((s) => s.ui.setupOpen);
  const board = useBoard((s) => s.board);
  const debug = useBoard((s) => s.ui.debug);
  const saved = useBoard((s) => s.ui.setupOptions);
  const { dispatch, setUi, startNewBoard } = useBoard.getState();
  const [o, setO] = useState<SetupOptions>(saved);
  if (!open) return null;

  const base = PRESETS[o.preset === 'custom' ? '5v5' : o.preset];
  const keepers = o.keepers ?? base.keepers;
  const countA = o.countA ?? base.perSide;
  const countB = o.countB ?? base.perSide;
  const box = o.box === undefined ? base.box : o.box;
  const outfield = (n: number): number => (keepers && n >= 2 ? n - 1 : n);
  const patch = (p: Partial<SetupOptions>): void => setO({ ...o, ...p });
  const choosePreset = (preset: PitchPreset): void => setO({ preset, aAttacksRight: o.aAttacksRight });
  const clampCount = (n: number): number => Math.max(1, Math.min(11, Math.round(n)));
  const view = board.view;
  const setView = (p: Partial<typeof view>): void => dispatch({ type: 'SET_VIEW', patch: p });

  return (
    <>
      <div className="backdrop" onPointerDown={() => setUi({ setupOpen: false })} />
      <section className="sheet" data-testid="setup-sheet" role="dialog" aria-label="Setup">
        <div className="sheet-head">
          <h2>Setup</h2>
          <button data-testid="setup-close" onClick={() => setUi({ setupOpen: false })} aria-label="Close">
            ✕
          </button>
        </div>

        <h3>New board</h3>
        <div className="chips" role="radiogroup" aria-label="Pitch">
          {PRESET_ORDER.map((p) => (
            <button key={p} role="radio" aria-checked={o.preset === p} className={o.preset === p ? 'on' : ''} data-testid={`preset-${p}`} onClick={() => choosePreset(p)}>
              {p === 'custom' ? 'Custom' : PRESETS[p].label}
            </button>
          ))}
        </div>
        <div className="grid">
          <NumberField label="Length (m)" testid="pitch-length" min={10} max={130} value={o.length ?? base.length} onChange={(n) => patch({ length: n, preset: 'custom' })} />
          <NumberField label="Width (m)" testid="pitch-width" min={8} max={100} value={o.width ?? base.width} onChange={(n) => patch({ width: n, preset: 'custom' })} />
          <NumberField label="Goal width (m)" testid="goal-width" min={1} max={10} step={0.1} value={o.goalWidth ?? base.goalWidth} onChange={(n) => patch({ goalWidth: n })} />
          <NumberField
            label="Keeper box depth (m)"
            testid="box-depth"
            min={0}
            max={30}
            step={0.5}
            value={box?.depth ?? 0}
            onChange={(n) => patch({ box: n > 0 ? { depth: n, width: box?.width ?? 10 } : null })}
          />
          <NumberField
            label="Keeper box width (m)"
            testid="box-width"
            min={0}
            max={60}
            step={0.5}
            value={box?.width ?? 0}
            onChange={(n) => patch({ box: n > 0 ? { depth: box?.depth ?? 6, width: n } : null })}
          />
        </div>

        <div className="grid">
          <NumberField label="Blue players" testid="count-A" min={1} max={11} value={countA} onChange={(n) => patch({ countA: clampCount(n), formationA: undefined })} />
          <NumberField label="Red players" testid="count-B" min={1} max={11} value={countB} onChange={(n) => patch({ countB: clampCount(n), formationB: undefined })} />
          <label className="field">
            <span>Blue shape</span>
            <select data-testid="formation-A" value={o.formationA ?? formationsFor(outfield(countA))[0]} onChange={(e) => patch({ formationA: e.target.value })}>
              {formationsFor(outfield(countA)).map((f) => (
                <option key={f} value={f}>
                  {formationLabel(f, keepers && countA >= 2)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Red shape</span>
            <select data-testid="formation-B" value={o.formationB ?? formationsFor(outfield(countB))[0]} onChange={(e) => patch({ formationB: e.target.value })}>
              {formationsFor(outfield(countB)).map((f) => (
                <option key={f} value={f}>
                  {formationLabel(f, keepers && countB >= 2)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" data-testid="keepers" checked={keepers} onChange={(e) => patch({ keepers: e.target.checked, formationA: undefined, formationB: undefined })} />
          <span>Goalkeepers (a team of one has no keeper)</span>
        </label>
        <label className="check">
          <input type="checkbox" data-testid="attack-right" checked={o.aAttacksRight !== false} onChange={(e) => patch({ aAttacksRight: e.target.checked })} />
          <span>Blue attacks to the right (up, when the phone is upright)</span>
        </label>
        <button className="primary" data-testid="start-board" onClick={() => startNewBoard(o)}>
          Start new board
        </button>
        <p className="note">Starting a new board replaces the one on screen.</p>

        <h3>This board</h3>
        <label className="field wide">
          <span>Who is You?</span>
          <select data-testid="you-select" value={view.youId ?? ''} onChange={(e) => dispatch({ type: 'SET_YOU', id: e.target.value || null }, { commit: true })}>
            <option value="">Nobody</option>
            {board.setup.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.teamId === 'A' ? 'Blue' : 'Red'} {nameOf(p)}
                {p.role === 'GK' ? ' (keeper)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field wide">
          <span>Player speed: {view.glideSpeed} m/s</span>
          <input type="range" data-testid="glide-speed" min={2} max={10} step={1} value={view.glideSpeed} onChange={(e) => setView({ glideSpeed: Number(e.target.value) })} />
        </label>
        <div className="chips" role="radiogroup" aria-label="Words">
          <button role="radio" aria-checked={view.textMode === 'kid'} className={view.textMode === 'kid' ? 'on' : ''} data-testid="text-kid" onClick={() => setView({ textMode: 'kid' })}>
            Kid words
          </button>
          <button role="radio" aria-checked={view.textMode === 'coach'} className={view.textMode === 'coach' ? 'on' : ''} data-testid="text-coach" onClick={() => setView({ textMode: 'coach' })}>
            Coach words
          </button>
        </div>
        <label className="check">
          <input type="checkbox" data-testid="glyphs" checked={view.glyphs} onChange={(e) => setView({ glyphs: e.target.checked })} />
          <span>Show X and O instead of numbers</span>
        </label>
        <label className="check">
          <input type="checkbox" data-testid="debug-toggle" checked={debug} onChange={(e) => setUi({ debug: e.target.checked })} />
          <span>Show engine timing</span>
        </label>
        <p className="note">Names and boards are saved on this device only. Hold a player (or right-click) to name them.</p>
      </section>
    </>
  );
}
