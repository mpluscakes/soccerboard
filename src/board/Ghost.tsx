import { memo } from 'react';
import type { Vec2 } from '../model/types';

/** A player's suggested spot: a faint circle joined to them by a dashed arrow. */
export const Ghost = memo(function Ghost({ id, from, to, r, color, you }: { id: string; from: Vec2; to: Vec2; r: number; color: string; you: boolean }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  // Arrow runs from the token's edge to the ghost's edge.
  const a = { x: from.x + ux * r, y: from.y + uy * r };
  const b = { x: to.x - ux * r, y: to.y - uy * r };
  const head = r * 0.45;
  const stroke = you ? '#facc15' : '#ffffff';
  return (
    <g data-testid={`ghost-${id}`} opacity={you ? 0.95 : 0.7} style={{ pointerEvents: 'none' }}>
      <circle cx={to.x} cy={to.y} r={r} fill={color} fillOpacity={0.3} stroke={stroke} strokeWidth={r * 0.1} strokeDasharray={`${r * 0.3} ${r * 0.2}`} />
      {d > 2 * r && (
        <>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={r * 0.12} strokeDasharray={`${r * 0.4} ${r * 0.3}`} />
          <path
            d={`M${b.x},${b.y} L${b.x - ux * head - uy * head * 0.6},${b.y - uy * head + ux * head * 0.6} L${b.x - ux * head + uy * head * 0.6},${b.y - uy * head - ux * head * 0.6} Z`}
            fill={stroke}
          />
        </>
      )}
    </g>
  );
});
