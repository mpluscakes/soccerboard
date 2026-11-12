import { phaseOf } from '../engine/phase';
import type { BoardState } from '../model/types';

/**
 * The perspective filter: explain attackers, defenders, or both. You is always
 * explained. With a loose ball nobody is attacking or defending, so both show.
 */
export function isExplained(board: BoardState, playerId: string): boolean {
  if (board.view.youId === playerId) return true;
  const { perspective } = board.view;
  if (perspective === 'both') return true;
  const player = board.setup.players.find((p) => p.id === playerId);
  if (!player) return false;
  const phase = phaseOf(board.setup, board.snapshot, player.teamId);
  return phase === 'loose' || phase === perspective;
}
