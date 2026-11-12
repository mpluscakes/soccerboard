import { nameOf } from '../engine/explain/render';
import type { Role } from '../model/types';
import { useBoard } from '../store/boardStore';

const ROLES: { id: Role; label: string }[] = [
  { id: 'GK', label: 'Keeper' },
  { id: 'DEF', label: 'Defender' },
  { id: 'MID', label: 'Midfield' },
  { id: 'FWD', label: 'Forward' },
];

/** Long-press (touch) or right-click (mouse) menu for one player. */
export function PlayerMenu() {
  const menu = useBoard((s) => s.ui.menu);
  const board = useBoard((s) => s.board);
  const { dispatch, setUi } = useBoard.getState();
  if (!menu) return null;
  const player = board.setup.players.find((p) => p.id === menu.id);
  const state = board.snapshot.players[menu.id];
  if (!player || !state) return null;
  const isYou = board.view.youId === player.id;
  const isCarrier = board.snapshot.ball.kind === 'held' && board.snapshot.ball.carrierId === player.id;
  // Ignore the tail end of the long-press that opened the menu.
  const armed = (): boolean => performance.now() - menu.openedAt > 350;
  const close = (): void => {
    if (armed()) setUi({ menu: null });
  };
  const width = 232;
  const left = Math.max(8, Math.min(menu.x - width / 2, window.innerWidth - width - 8));
  const height = 356;
  // Below the finger where there is room, otherwise above it.
  const top = menu.y + 12 + height <= window.innerHeight ? menu.y + 12 : Math.max(8, Math.min(menu.y - height - 12, window.innerHeight - height - 8));

  return (
    <>
      <div className="backdrop clear" onPointerDown={close} data-testid="menu-backdrop" />
      <div className="popover player-menu" style={{ left, top, width }} data-testid="player-menu" role="menu">
        <div className="menu-title">{nameOf(player)}</div>
        <button
          role="menuitem"
          data-testid="menu-you"
          onClick={() => {
            if (!armed()) return;
            dispatch({ type: 'SET_YOU', id: isYou ? null : player.id }, { commit: true });
            close();
          }}
        >
          {isYou ? 'Stop being You' : 'Make this player You'}
        </button>
        <button
          role="menuitem"
          data-testid="menu-pin"
          disabled={isCarrier && !state.pinned}
          onClick={() => {
            if (!armed()) return;
            dispatch({ type: state.pinned ? 'UNPIN' : 'PIN', id: player.id }, { commit: true });
            close();
          }}
        >
          {state.pinned ? 'Unpin (move on their own again)' : 'Pin here'}
        </button>
        <button
          role="menuitem"
          data-testid="menu-reason"
          onClick={() => {
            if (armed()) setUi({ selectedId: player.id, menu: null });
          }}
        >
          Show reason
        </button>
        <div className="menu-row" role="group" aria-label="Role">
          {ROLES.map((r) => (
            <button
              key={r.id}
              className={player.role === r.id ? 'on' : ''}
              data-testid={`menu-role-${r.id}`}
              onClick={() => armed() && dispatch({ type: 'SET_ROLE', id: player.id, role: r.id }, { commit: true })}
            >
              {r.label}
            </button>
          ))}
        </div>
        <label className="menu-name">
          <span>Name</span>
          <input
            data-testid="menu-name"
            type="text"
            maxLength={12}
            placeholder={`Number ${player.number}`}
            value={player.label ?? ''}
            onChange={(e) => dispatch({ type: 'SET_LABEL', id: player.id, label: e.target.value })}
          />
        </label>
      </div>
    </>
  );
}
