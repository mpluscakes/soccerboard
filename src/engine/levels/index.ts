import type { Strategy } from '../../model/types';
import type { LevelConfig } from '../types';
import level1 from './level1.json';
import level2 from './level2.json';

export const LEVELS: Record<number, LevelConfig> = { 1: level1, 2: level2 };

/** Level 3 (Tactics) arrives in phase 2; until then it plays as level 2. */
export function getLevel(id: number): LevelConfig {
  return LEVELS[id] ?? (id >= 3 ? LEVELS[2] : LEVELS[1]);
}

/** Phase 4 hook: a Strategy is just different weights for the same engine. */
export function applyStrategy(level: LevelConfig, strategy: Pick<Strategy, 'weightOverrides'>): LevelConfig {
  const weights: LevelConfig['weights'] = { ...level.weights };
  for (const [job, terms] of Object.entries(strategy.weightOverrides)) {
    const merged: Record<string, number> = { ...weights[job] };
    for (const [term, w] of Object.entries(terms ?? {})) if (w !== undefined) merged[term] = w;
    weights[job] = merged;
  }
  return { ...level, weights };
}
