import { useEffect, useRef } from 'react';
import { teamOf } from '../model/geometry';
import { useBoard } from '../store/boardStore';
import { GOAL_PARTY_MS } from '../store/engineBridge';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  color: string;
}

const GOLD = ['#facc15', '#fde047', '#ffffff'];

/** A few seconds of fireworks over the board when the ball goes in the net. */
export function Fireworks() {
  const goal = useBoard((s) => s.ui.goal);
  const setup = useBoard((s) => s.board.setup);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const teamColor = goal ? teamOf(setup, goal.teamId).color : '#ffffff';
  const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!goal || !canvas || still) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    g.scale(dpr, dpr);

    const colors = [teamColor, ...GOLD];
    const sparks: Spark[] = [];
    const burst = (now: number): void => {
      const x = w * (0.15 + Math.random() * 0.7);
      const y = h * (0.15 + Math.random() * 0.45);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const n = 44;
      const speed = Math.min(w, h) * (0.35 + Math.random() * 0.25);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
        const v = speed * (0.55 + Math.random() * 0.45);
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: now, life: 900 + Math.random() * 500, color: Math.random() < 0.25 ? '#ffffff' : color });
      }
    };

    const start = performance.now();
    let last = start;
    let nextBurst = start;
    let raf = requestAnimationFrame(function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // New bursts for the first part of the party; the last ones then fade out.
      if (now >= nextBurst && now - start < GOAL_PARTY_MS - 1300) {
        burst(now);
        nextBurst = now + 220 + Math.random() * 180;
      }
      g.clearRect(0, 0, w, h);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        const age = (now - s.born) / s.life;
        if (age >= 1) {
          sparks.splice(i, 1);
          continue;
        }
        const drag = Math.pow(0.2, dt); // sparks slow down quickly, then drift and fall
        s.vx *= drag;
        s.vy = s.vy * drag + 90 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        g.globalAlpha = 1 - age * age;
        g.fillStyle = s.color;
        g.beginPath();
        g.arc(s.x, s.y, 3.6 * (1 - age * 0.5), 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    });
    return () => cancelAnimationFrame(raf);
  }, [goal, still, teamColor]);

  if (!goal) return null;
  return (
    <div className="goal-party" data-testid="goal-party" data-team={goal.teamId} aria-live="polite">
      <canvas ref={canvasRef} />
      <div className="goal-word" style={{ color: teamColor }}>
        GOAL!
      </div>
    </div>
  );
}
