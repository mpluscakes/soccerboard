import type { Vec2 } from '../model/types';

export function Ball({ at, r, hitR, state }: { at: Vec2; r: number; hitR: number; state: string }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`} data-testid="ball" data-state={state}>
      <circle r={r} fill="#ffffff" stroke="#0f172a" strokeWidth={r * 0.22} />
      <circle r={r * 0.3} fill="#0f172a" />
      <circle r={hitR} fill="transparent" data-hit="ball" />
    </g>
  );
}
