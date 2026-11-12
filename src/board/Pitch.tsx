import { memo } from 'react';
import { pitchRect } from '../model/geometry';
import { fitViewport } from '../model/presets';
import type { PitchSpec, Rect, Setup } from '../model/types';

const LINE = { stroke: '#f8fafc', strokeWidth: 2, fill: 'none', vectorEffect: 'non-scaling-stroke' as const };

function Goal({ pitch, end }: { pitch: PitchSpec; end: 1 | -1 }) {
  const depth = Math.max(0.8, pitch.length * 0.025);
  const x = end === 1 ? pitch.length / 2 : -pitch.length / 2 - depth;
  return (
    <rect
      data-testid={`goal-${end === 1 ? 'right' : 'left'}`}
      x={x}
      y={-pitch.goalWidth / 2}
      width={depth}
      height={pitch.goalWidth}
      {...LINE}
      fill="rgba(255,255,255,0.25)"
    />
  );
}

function KeeperArea({ area, mirror }: { area: Rect; mirror: boolean }) {
  const x = mirror ? -area.x - area.w : area.x;
  return <rect x={x} y={area.y} width={area.w} height={area.h} {...LINE} />;
}

/** Pitch markings in metres. The parent applies the landscape/portrait transform. */
export const Pitch = memo(function Pitch({ setup }: { setup: Setup }) {
  const { pitch, activeArea } = setup;
  const r = pitchRect(pitch);
  const fit = fitViewport(pitch);
  const circle = Math.min(9.15, pitch.width * 0.16);
  const stripes = 8;
  return (
    <g>
      <rect x={fit.x - 50} y={fit.y - 50} width={fit.w + 100} height={fit.h + 100} fill="#14532d" />
      {Array.from({ length: stripes }, (_, i) => (
        <rect key={i} x={r.x + (i * r.w) / stripes} y={r.y} width={r.w / stripes} height={r.h} fill={i % 2 ? '#1c7c3c' : '#1f8542'} />
      ))}
      <rect data-testid="pitch-outline" data-length={pitch.length} data-width={pitch.width} x={r.x} y={r.y} width={r.w} height={r.h} {...LINE} />
      <line x1={0} y1={r.y} x2={0} y2={r.y + r.h} {...LINE} />
      <circle cx={0} cy={0} r={circle} {...LINE} />
      <circle cx={0} cy={0} r={0.25} fill="#f8fafc" />
      {pitch.keeperArea && (
        <>
          <KeeperArea area={pitch.keeperArea} mirror={false} />
          <KeeperArea area={pitch.keeperArea} mirror />
        </>
      )}
      <Goal pitch={pitch} end={-1} />
      <Goal pitch={pitch} end={1} />
      {activeArea && (
        <>
          {/* Dim everything outside the active area. */}
          <path
            fillRule="evenodd"
            fill="rgba(2,20,10,0.55)"
            d={`M${fit.x - 50},${fit.y - 50}h${fit.w + 100}v${fit.h + 100}h${-(fit.w + 100)}z M${activeArea.x},${activeArea.y}h${activeArea.w}v${activeArea.h}h${-activeArea.w}z`}
          />
          <rect
            data-testid="active-area"
            x={activeArea.x}
            y={activeArea.y}
            width={activeArea.w}
            height={activeArea.h}
            fill="none"
            stroke="#fde047"
            strokeWidth={2}
            strokeDasharray="8 6"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </g>
  );
});
