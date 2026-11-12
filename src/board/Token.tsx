import { memo } from 'react';
import type { Player, Team, Vec2 } from '../model/types';

export interface TokenProps {
  player: Player;
  team: Team;
  /** centre in view coordinates */
  at: Vec2;
  r: number;
  hitR: number;
  pinned: boolean;
  you: boolean;
  selected: boolean;
  passing: boolean;
  glyphs: boolean;
}

/** A player: a circle with a number (or X / O), a ring for keepers, a halo for You. */
export const Token = memo(function Token({ player, team, at, r, hitR, pinned, you, selected, passing, glyphs }: TokenProps) {
  const glyph = glyphs ? (team.id === 'A' ? 'O' : 'X') : String(player.number);
  const sw = r * 0.12;
  return (
    <g transform={`translate(${at.x} ${at.y})`} data-testid={`player-${player.id}`} data-team={team.id} data-role={player.role}>
      {you && <circle r={r * 1.45} fill="rgba(250,204,21,0.28)" stroke="#facc15" strokeWidth={sw * 1.4} />}
      {(selected || passing) && (
        <circle r={r * 1.25} fill="none" stroke={passing ? '#fde047' : '#ffffff'} strokeWidth={sw} strokeDasharray={`${r * 0.35} ${r * 0.25}`} />
      )}
      <circle r={r} fill={team.color} stroke="#ffffff" strokeWidth={sw} />
      {player.role === 'GK' && <circle r={r * 0.74} fill="none" stroke="#fde047" strokeWidth={sw * 1.3} />}
      <text y={r * 0.34} textAnchor="middle" fontSize={r * 0.95} fontWeight={700} fill="#ffffff" style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {glyph}
      </text>
      {player.label && (
        <text
          y={r * 1.75}
          textAnchor="middle"
          fontSize={r * 0.7}
          fontWeight={600}
          fill="#ffffff"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={r * 0.12}
          paintOrder="stroke"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {player.label}
        </text>
      )}
      {you && (
        <g transform={`translate(0 ${-r * 1.75})`} data-testid="you-tag">
          <rect x={-r * 0.95} y={-r * 0.42} width={r * 1.9} height={r * 0.78} rx={r * 0.2} fill="#facc15" />
          <text y={r * 0.2} textAnchor="middle" fontSize={r * 0.6} fontWeight={800} fill="#422006" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            YOU
          </text>
        </g>
      )}
      {pinned && (
        <g transform={`translate(${r * 0.8} ${-r * 0.8})`} data-testid={`pin-${player.id}`}>
          <circle r={r * 0.42} fill="#0f172a" stroke="#ffffff" strokeWidth={sw * 0.6} />
          {/* a little map pin */}
          <circle cy={-r * 0.08} r={r * 0.15} fill="#f87171" />
          <line x1={0} y1={r * 0.05} x2={0} y2={r * 0.27} stroke="#f87171" strokeWidth={sw * 0.8} />
        </g>
      )}
      {/* Hit area: at least 44 x 44 px at every zoom. */}
      <circle r={hitR} fill="transparent" data-hit={player.id} />
    </g>
  );
});
