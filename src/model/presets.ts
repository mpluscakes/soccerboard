import { buildTeamPlayers } from './formations';
import { boundsOf, clampToRect, homeToWorld, pitchRect, teamOf } from './geometry';
import type { BoardState, PitchPreset, PitchSpec, Rect, Setup, Snapshot, TeamId, ViewState } from './types';

interface PresetDef {
  label: string;
  length: number;
  width: number;
  goalWidth: number;
  /** keeper area depth x width in metres, or null */
  box: { depth: number; width: number } | null;
  perSide: number;
  keepers: boolean;
}

export const PRESETS: Record<Exclude<PitchPreset, 'custom'>, PresetDef> = {
  '4v4': { label: '4v4', length: 25, width: 18, goalWidth: 3, box: null, perSide: 4, keepers: false },
  '5v5': { label: '5v5 with keepers', length: 35, width: 25, goalWidth: 4, box: { depth: 6, width: 12 }, perSide: 5, keepers: true },
  '7v7': { label: '7v7', length: 50, width: 35, goalWidth: 5, box: { depth: 9, width: 18 }, perSide: 7, keepers: true },
  '9v9': { label: '9v9', length: 65, width: 45, goalWidth: 5, box: { depth: 12, width: 28 }, perSide: 9, keepers: true },
  '11v11': { label: '11v11', length: 100, width: 64, goalWidth: 7.32, box: { depth: 16.5, width: 40.32 }, perSide: 11, keepers: true },
};
export const PRESET_ORDER: PitchPreset[] = ['4v4', '5v5', '7v7', '9v9', '11v11', 'custom'];

export interface SetupOptions {
  preset: PitchPreset;
  /** Custom size / overrides (metres). */
  length?: number;
  width?: number;
  goalWidth?: number;
  /** Keeper area override; null removes it. */
  box?: { depth: number; width: number } | null;
  countA?: number;
  countB?: number;
  keepers?: boolean;
  formationA?: string;
  formationB?: string;
  /** Team A attacks toward +x (the right in landscape). */
  aAttacksRight?: boolean;
}

export function makePitch(o: SetupOptions): PitchSpec {
  const base = PRESETS[o.preset === 'custom' ? '5v5' : o.preset];
  const length = Math.max(10, Math.min(130, o.length ?? base.length));
  const width = Math.max(8, Math.min(100, o.width ?? base.width));
  const goalWidth = Math.max(1, Math.min(width, o.goalWidth ?? base.goalWidth));
  const box = o.box === undefined ? base.box : o.box;
  let keeperArea: Rect | null = null;
  if (box && box.depth > 0 && box.width > 0) {
    const depth = Math.min(box.depth, length / 2);
    const w = Math.min(box.width, width);
    keeperArea = { x: -length / 2, y: -w / 2, w: depth, h: w };
  }
  return { preset: o.preset, length, width, goalWidth, keeperArea, offside: o.preset === '11v11' };
}

export function makeSetup(o: SetupOptions = { preset: '5v5' }): Setup {
  const base = PRESETS[o.preset === 'custom' ? '5v5' : o.preset];
  const keepers = o.keepers ?? base.keepers;
  const a = buildTeamPlayers('A', o.countA ?? base.perSide, keepers, o.formationA);
  const b = buildTeamPlayers('B', o.countB ?? base.perSide, keepers, o.formationB);
  const dirA: 1 | -1 = o.aAttacksRight === false ? -1 : 1;
  return {
    pitch: makePitch(o),
    teams: [
      { id: 'A', name: 'Blue', color: '#2563eb', attacksDir: dirA },
      { id: 'B', name: 'Red', color: '#dc2626', attacksDir: dirA === 1 ? -1 : 1 },
    ],
    players: [...a.players, ...b.players],
    formationIds: { A: a.formationId, B: b.formationId },
  };
}

/** Everyone on their formation slot; Team A's most forward player has the ball. */
export function initialSnapshot(setup: Setup): Snapshot {
  const bounds = boundsOf(setup);
  const players: Snapshot['players'] = {};
  for (const p of setup.players) {
    const pos = clampToRect(homeToWorld(setup.pitch, teamOf(setup, p.teamId), p.home), bounds, 0.5);
    players[p.id] = { pos, pinned: false };
  }
  const carrier = firstCarrier(setup, 'A');
  if (!carrier) return { players, ball: { kind: 'loose', pos: clampToRect({ x: 0, y: 0 }, bounds, 0.5) } };
  return { players, ball: { kind: 'held', carrierId: carrier, dir: { x: teamOf(setup, 'A').attacksDir, y: 0 } } };
}

function firstCarrier(setup: Setup, teamId: TeamId): string | null {
  const mine = setup.players.filter((p) => p.teamId === teamId);
  if (mine.length === 0) return null;
  const outfield = mine.filter((p) => p.role !== 'GK');
  const pool = outfield.length ? outfield : mine;
  return [...pool].sort((p, q) => q.home.x - p.home.x || Math.abs(p.home.y) - Math.abs(q.home.y) || (p.id < q.id ? -1 : 1))[0].id;
}

/** Viewport that shows the whole pitch with room for the goals. */
export function fitViewport(pitch: PitchSpec): Rect {
  const r = pitchRect(pitch);
  const m = Math.max(1.5, pitch.length * 0.04);
  return { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
}

export function defaultYou(setup: Setup): string | null {
  const mine = setup.players.filter((p) => p.teamId === 'A' && p.role !== 'GK');
  return (mine.find((p) => p.role === 'MID') ?? mine[0] ?? setup.players[0])?.id ?? null;
}

export function defaultView(setup: Setup): ViewState {
  return {
    viewport: fitViewport(setup.pitch),
    youId: defaultYou(setup),
    levelId: 1,
    perspective: 'both',
    autoMove: true,
    paused: false,
    textMode: 'kid',
    glideSpeed: 6,
    glyphs: false,
  };
}

/** A new board: 5v5 with keepers at level 1 unless told otherwise. */
export function newBoard(o: SetupOptions = { preset: '5v5' }): BoardState {
  const setup = makeSetup(o);
  return { schemaVersion: 1, setup, snapshot: initialSnapshot(setup), view: defaultView(setup) };
}
