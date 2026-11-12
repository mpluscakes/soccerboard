import type { Player, Role, TeamId, Vec2 } from './types';

/**
 * Formation library. A formation is a list of lines from the back to the
 * front, e.g. "1-2-1" = one defender, two midfielders, one forward. The
 * goalkeeper (if any) is added separately.
 */
const LIBRARY: Record<number, string[]> = {
  0: [''],
  1: ['1'],
  2: ['1-1', '2'],
  3: ['2-1', '1-2', '1-1-1'],
  4: ['1-2-1', '2-2'],
  5: ['2-2-1', '2-1-2', '1-3-1'],
  6: ['2-3-1', '3-2-1', '2-2-2'],
  7: ['3-3-1', '2-3-2', '3-2-2'],
  8: ['3-3-2', '3-4-1', '2-4-2'],
  9: ['3-4-2', '4-4-1', '3-3-3'],
  10: ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'],
  11: ['4-4-3', '3-4-4', '4-3-4'],
};

const LINE_X: Record<number, number[]> = {
  1: [0.2],
  2: [-0.4, 0.5],
  3: [-0.5, 0.1, 0.7],
  4: [-0.55, -0.1, 0.35, 0.75],
};

const KEEPER_HOME: Vec2 = { x: -0.92, y: 0 };

export function formationsFor(outfield: number): string[] {
  return LIBRARY[Math.max(0, Math.min(11, outfield))] ?? ['1'];
}

export function formationLabel(id: string, keeper: boolean): string {
  if (!id) return keeper ? 'Keeper only' : '-';
  return keeper ? `Keeper + ${id}` : id;
}

function lineYs(k: number): number[] {
  if (k === 1) return [0];
  const spread = Math.min(0.8, 0.2 + 0.2 * (k - 1) + (k === 2 ? -0.05 : 0));
  return Array.from({ length: k }, (_, i) => -spread + (2 * spread * i) / (k - 1));
}

function roleFor(line: number, lines: number): Role {
  if (lines === 1) return 'MID';
  if (line === 0) return 'DEF';
  if (line === lines - 1) return 'FWD';
  return 'MID';
}

/** Build one team's players for a formation. count includes the keeper. */
export function buildTeamPlayers(teamId: TeamId, count: number, keeper: boolean, formationId?: string): {
  players: Player[];
  formationId: string;
} {
  const n = Math.max(1, Math.min(11, Math.round(count)));
  // A one-player team is an outfield player even when keepers are on (2v1 etc.).
  const hasKeeper = keeper && n >= 2;
  const outfield = hasKeeper ? n - 1 : n;
  const options = formationsFor(outfield);
  const id = formationId !== undefined && options.includes(formationId) ? formationId : options[0];
  const lines = id ? id.split('-').map(Number) : [];
  const xs = LINE_X[lines.length] ?? [];
  const players: Player[] = [];
  let number = 1;
  if (hasKeeper) {
    players.push({ id: `${teamId}${number}`, teamId, number, role: 'GK', home: { ...KEEPER_HOME } });
    number++;
  }
  lines.forEach((k, li) => {
    for (const y of lineYs(k)) {
      players.push({ id: `${teamId}${number}`, teamId, number, role: roleFor(li, lines.length), home: { x: xs[li], y } });
      number++;
    }
  });
  return { players, formationId: id };
}
