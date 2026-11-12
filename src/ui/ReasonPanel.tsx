import type { Reason } from '../engine/types';
import { nameOf } from '../engine/explain/render';
import { teamOf } from '../model/geometry';
import type { Player, Team } from '../model/types';
import { useBoard } from '../store/boardStore';
import { isExplained } from './visibility';

function ReasonCard({ player, team, reason, you, mode }: { player: Player; team: Team; reason: Reason; you: boolean; mode: 'kid' | 'coach' }) {
  const main = mode === 'kid' ? reason.kid : reason.coach;
  const detail = mode === 'kid' ? reason.kidDetail : reason.coachDetail;
  return (
    <div className={`reason${you ? ' you' : ''}`} data-testid={you ? 'reason-you' : 'reason-selected'} data-player={player.id} data-job={reason.jobId}>
      <span className="chip" style={{ background: team.color }}>
        {player.number}
      </span>
      <div className="reason-text">
        <div className="reason-who">
          {you ? 'YOU' : nameOf(player)} · {team.name}
        </div>
        <div className="reason-main">{main}</div>
        {detail && <div className="reason-detail">{detail}</div>}
      </div>
    </div>
  );
}

/** You's reason is always shown; tap any other player to see theirs next to it. */
export function ReasonPanel() {
  const board = useBoard((s) => s.board);
  const engine = useBoard((s) => s.engine);
  const selectedId = useBoard((s) => s.ui.selectedId);
  const passFromId = useBoard((s) => s.ui.passFromId);
  const { setup, view } = board;
  const find = (id: string | null): Player | undefined => setup.players.find((p) => p.id === id);
  const you = find(view.youId);
  const selected = selectedId !== view.youId ? find(selectedId) : undefined;
  const hidden = selected && !isExplained(board, selected.id);

  return (
    <footer className="reasons" data-testid="reasons">
      {passFromId && (
        <div className="reason tip" data-testid="pass-tip">
          <div className="reason-main">Now tap a teammate to pass.</div>
        </div>
      )}
      {you && engine?.reasons[you.id] && (
        <ReasonCard player={you} team={teamOf(setup, you.teamId)} reason={engine.reasons[you.id]} you mode={view.textMode} />
      )}
      {selected && !hidden && engine?.reasons[selected.id] && (
        <ReasonCard player={selected} team={teamOf(setup, selected.teamId)} reason={engine.reasons[selected.id]} you={false} mode={view.textMode} />
      )}
      {hidden && (
        <div className="reason tip" data-testid="reason-hidden">
          <div className="reason-main">Hidden by the Explain filter.</div>
        </div>
      )}
      {!you && !selected && !passFromId && (
        <div className="reason tip">
          <div className="reason-main">Tap a player to see why they move. Hold a player to make them You.</div>
        </div>
      )}
    </footer>
  );
}
