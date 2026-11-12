import type { Snapshot, Setup, TeamId } from '../model/types';
import type { Phase } from './types';

/** The player on the ball. A pass in flight already belongs to its receiver. */
export function effectiveCarrier(snapshot: Snapshot): string | null {
  const b = snapshot.ball;
  if (b.kind === 'held') return snapshot.players[b.carrierId] ? b.carrierId : null;
  if (b.kind === 'travelling' && b.toId && snapshot.players[b.toId]) return b.toId;
  return null;
}

/** attack if the team holds the ball, defend if the other team does, loose if nobody does. */
export function phaseOf(setup: Setup, snapshot: Snapshot, teamId: TeamId): Phase {
  const carrierId = effectiveCarrier(snapshot);
  if (!carrierId) return 'loose';
  const carrier = setup.players.find((p) => p.id === carrierId);
  if (!carrier) return 'loose';
  return carrier.teamId === teamId ? 'attack' : 'defend';
}
