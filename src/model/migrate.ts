import { defaultView } from './presets';
import type { BoardState } from './types';

export const CURRENT_SCHEMA = 1;

type Migration = (old: any) => any;
/** migrations[n] upgrades a saved board from schema n to n + 1. */
const migrations: Record<number, Migration> = {};

/** Upgrade anything we saved earlier to the current schema, or null if unusable. */
export function migrate(saved: unknown): BoardState | null {
  if (!saved || typeof saved !== 'object') return null;
  let s: any = saved;
  let version = typeof s.schemaVersion === 'number' ? s.schemaVersion : 0;
  while (version < CURRENT_SCHEMA) {
    const step = migrations[version];
    if (!step) return null;
    s = step(s);
    version++;
  }
  if (version !== CURRENT_SCHEMA) return null;
  if (!isBoard(s)) return null;
  // Fill in any view fields added since the board was saved.
  return { ...s, view: { ...defaultView(s.setup), ...s.view } };
}

function isBoard(s: any): s is BoardState {
  if (!s.setup?.pitch || !Array.isArray(s.setup.players) || !Array.isArray(s.setup.teams)) return false;
  if (!s.snapshot?.players || !s.snapshot.ball || !s.view) return false;
  for (const p of s.setup.players) {
    const ps = s.snapshot.players[p.id];
    if (!ps || typeof ps.pos?.x !== 'number' || typeof ps.pos?.y !== 'number') return false;
  }
  const b = s.snapshot.ball;
  if (b.kind === 'held') return !!s.snapshot.players[b.carrierId];
  return b.kind === 'loose' || b.kind === 'travelling';
}
