import { describe, expect, it } from 'vitest';
import { computeTargets, getLevel } from '../../src/engine';
import type { EngineResult } from '../../src/engine';
import { ballPos, boundsOf, dist, distToSegment, inRect, keeperAreaFor, ownGoal, teamOf } from '../../src/model/geometry';
import { reduce } from '../../src/model/reduce';
import type { BoardState, Player, TeamId } from '../../src/model/types';
import { board, jitter, run, simulate, withHeld, withLoose } from './helpers';
import { fixture, loadFixtures } from './loadFixtures';

const fixtures = loadFixtures();
const team = (b: BoardState, id: TeamId): Player[] => b.setup.players.filter((p) => p.teamId === id);
const outfield = (b: BoardState, id: TeamId): Player[] => team(b, id).filter((p) => p.role !== 'GK');
const jobs = (r: EngineResult, players: Player[], job: string): Player[] => players.filter((p) => r.reasons[p.id].jobId === job);

describe('engine acceptance criteria', () => {
  it('3. an active area keeps every engine target inside it', () => {
    const f = fixture('04');
    const area = f.board.setup.activeArea!;
    for (const b of [f.board, withLoose(f.board, { x: 11, y: -8 }), withHeld(f.board, 'B1')]) {
      const { history, board: end } = simulate(b, 4);
      for (const r of history) for (const t of Object.values(r.targets)) expect(inRect(t, area)).toBe(true);
      for (const s of Object.values(end.snapshot.players)) expect(inRect(s.pos, area)).toBe(true);
    }
  });

  it('11. computeTargets is deterministic: identical input gives byte-identical output', () => {
    expect(fixtures).toHaveLength(10);
    for (const f of fixtures) {
      const level = getLevel(f.level);
      const a = computeTargets(f.board, level);
      const b = computeTargets(JSON.parse(JSON.stringify(f.board)), level);
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      // ...and with a previous result fed back in.
      const a2 = computeTargets(f.board, level, a);
      const b2 = computeTargets(f.board, level, JSON.parse(JSON.stringify(a)));
      expect(JSON.stringify(b2)).toBe(JSON.stringify(a2));
    }
  });

  it('12. 5v5 L1, A has the ball: the nearest teammate is the supporter with a clear pass lane', () => {
    for (const b of [fixture('01').board, jitter(fixture('01').board, 21, 3), jitter(fixture('01').board, 22, 4)]) {
      const r = run(b);
      const carrierId = (b.snapshot.ball as { carrierId: string }).carrierId;
      const carrierPos = b.snapshot.players[carrierId].pos;
      const mates = outfield(b, 'A').filter((p) => p.id !== carrierId);
      const nearest = [...mates].sort((p, q) => dist(b.snapshot.players[p.id].pos, carrierPos) - dist(b.snapshot.players[q.id].pos, carrierPos))[0];
      expect(r.reasons[nearest.id].jobId).toBe('supporter');
      const target = r.targets[nearest.id];
      for (const opp of team(b, 'B')) {
        expect(distToSegment(b.snapshot.players[opp.id].pos, ballPos(b.snapshot), target)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('13. 5v5 L1, B has the ball: one presser; every other A outfield target is goal-side of the ball', () => {
    for (const b of [fixture('02').board, withHeld(jitter(fixture('01').board, 31, 4), 'B3'), withHeld(fixture('01').board, 'B2')]) {
      const r = run(b);
      expect(jobs(r, team(b, 'A'), 'presser')).toHaveLength(1);
      const goal = ownGoal(b.setup.pitch, teamOf(b.setup, 'A'));
      const ball = ballPos(b.snapshot);
      for (const p of outfield(b, 'A')) {
        if (r.reasons[p.id].jobId === 'presser') continue;
        expect(dist(r.targets[p.id], goal)).toBeLessThan(dist(ball, goal));
      }
    }
  });

  it('14. loose ball: exactly one chaser per team, and nobody else ends up closer to the ball', () => {
    for (const f of [fixture('03'), fixture('07')]) {
      const r = run(f.board);
      const ball = ballPos(f.board.snapshot);
      for (const id of ['A', 'B'] as const) {
        const chasers = jobs(r, team(f.board, id), 'chaser');
        expect(chasers).toHaveLength(1);
        const chaserDist = dist(r.targets[chasers[0].id], ball);
        for (const p of outfield(f.board, id)) {
          if (p.id !== chasers[0].id) expect(dist(r.targets[p.id], ball)).toBeGreaterThanOrEqual(chaserDist);
        }
      }
    }
  });

  it('15. no two teammates share a spot: targets stay spaceDist / 2 apart', () => {
    for (const f of fixtures) {
      const level = getLevel(f.level);
      const half = (level.spaceDistFactor * f.board.setup.pitch.width) / 2;
      const check = (r: EngineResult, b: BoardState): void => {
        const fixed = (id: string): boolean => b.snapshot.players[id].pinned || r.reasons[id].jobId === 'carrier';
        for (const id of ['A', 'B'] as const) {
          const ps = team(b, id);
          for (let i = 0; i < ps.length; i++) {
            for (let j = i + 1; j < ps.length; j++) {
              if (fixed(ps[i].id) && fixed(ps[j].id)) continue; // the user put them there
              const pair = [r.reasons[ps[i].id].jobId, r.reasons[ps[j].id].jobId].sort().join('+');
              const min = pair === 'cover+presser' ? Math.min(3, half) : half;
              expect(dist(r.targets[ps[i].id], r.targets[ps[j].id]), `${f.name} ${ps[i].id}/${ps[j].id}`).toBeGreaterThanOrEqual(min - 1e-3);
            }
          }
        }
      };
      check(run(f.board), f.board);
      const sim = simulate(f.board, 3);
      check(sim.history[sim.history.length - 1], sim.board);
    }
  });

  it('16. the keeper stands on the ball-to-goal line inside the keeper area, and steps aside on our ball', () => {
    const cases: BoardState[] = [
      fixture('02').board,
      fixture('03').board,
      withLoose(fixture('01').board, { x: -14, y: 9 }),
      withLoose(fixture('01').board, { x: 10, y: -11 }),
      fixture('06').board,
      withLoose(board({ preset: '4v4', keepers: true }), { x: 3, y: 6 }),
    ];
    for (const b of cases) {
      const r = run(b);
      const t = teamOf(b.setup, 'A');
      const goal = ownGoal(b.setup.pitch, t);
      const keeper = team(b, 'A').find((p) => p.role === 'GK')!;
      const target = r.targets[keeper.id];
      expect(r.reasons[keeper.id].jobId).toBe('keeper');
      expect(distToSegment(target, ballPos(b.snapshot), goal)).toBeLessThanOrEqual(1);
      const area = keeperAreaFor(b.setup.pitch, t);
      if (area) expect(inRect(target, area)).toBe(true);
      else expect(Math.abs(target.x - goal.x)).toBeLessThanOrEqual(6);
    }
    // Own team has the ball: beside the goal, still inside the area.
    for (const b of [fixture('01').board, fixture('05').board]) {
      const r = run(b);
      const t = teamOf(b.setup, 'A');
      const keeper = team(b, 'A').find((p) => p.role === 'GK')!;
      const target = r.targets[keeper.id];
      expect(Math.abs(target.y)).toBeGreaterThan(b.setup.pitch.goalWidth / 2);
      expect(inRect(target, keeperAreaFor(b.setup.pitch, t)!)).toBe(true);
      expect(r.reasons[keeper.id].kid).toMatch(/pass back/);
    }
  });

  it('17. level 2, 7v7: one width player per flank; one cover player 3 to 7 m goal-side of the presser', () => {
    for (const b of [fixture('05').board, jitter(board({ preset: '7v7' }, 2), 41, 3)]) {
      const r = run(b);
      const wide = jobs(r, team(b, 'A'), 'width');
      expect(wide.map((p) => r.reasons[p.id].refs?.side).sort()).toEqual([-1, 1]);
      for (const p of wide) expect(Math.sign(r.targets[p.id].y)).toBe(r.reasons[p.id].refs?.side);

      const cover = jobs(r, team(b, 'B'), 'cover');
      const presser = jobs(r, team(b, 'B'), 'presser');
      expect(cover).toHaveLength(1);
      expect(presser).toHaveLength(1);
      const goal = ownGoal(b.setup.pitch, teamOf(b.setup, 'B'));
      const d = dist(r.targets[cover[0].id], r.targets[presser[0].id]);
      expect(d).toBeGreaterThanOrEqual(3);
      expect(d).toBeLessThanOrEqual(7);
      expect(dist(r.targets[cover[0].id], goal)).toBeLessThan(dist(r.targets[presser[0].id], goal));
    }
    // Level 1 has neither job.
    const r1 = run(board({ preset: '7v7' }, 1));
    expect(Object.values(r1.reasons).some((x) => x.jobId === 'width' || x.jobId === 'cover')).toBe(false);
  });

  it('18. dragging the ball slowly across the pitch does not make targets flip back and forth', () => {
    for (const start of [fixture('01').board, fixture('05').board]) {
      const L = start.setup.pitch.length;
      const W = start.setup.pitch.width;
      const seconds = 12;
      // The ball crosses the pitch corner to corner at walking pace.
      const { history } = simulate(withLoose(start, { x: -L / 2 + 2, y: -W / 2 + 2 }), seconds, (b, t) =>
        reduce(b, { type: 'MOVE_BALL', snap: false, to: { x: -L / 2 + 2 + ((L - 4) * t) / seconds, y: -W / 2 + 2 + ((W - 4) * t) / seconds } }),
      );
      const ticksPerSecond = Math.round(1 / 0.066);
      for (const id of Object.keys(history[0].targets)) {
        // A flip-back: the target returns to a spot it left less than a second ago.
        const flips: number[] = [];
        for (let i = 2; i < history.length; i++) {
          const now = history[i].targets[id];
          const before = history[i - 1].targets[id];
          if (dist(now, before) < 0.01) continue;
          for (let k = Math.max(0, i - ticksPerSecond); k < i - 1; k++) {
            if (dist(history[k].targets[id], now) < 0.01) {
              flips.push(i);
              break;
            }
          }
        }
        for (let i = 0; i < flips.length; i++) {
          const inWindow = flips.filter((f) => f >= flips[i] && f < flips[i] + ticksPerSecond).length;
          expect(inWindow, `${id} flips within a second`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('settles: once the ball stops, every fixture board comes to rest', () => {
    for (const f of fixtures) {
      const { history, board: end } = simulate(f.board, 14);
      const last = history[history.length - 1];
      for (let i = history.length - 30; i < history.length; i++) expect(history[i].targets, f.name).toEqual(last.targets);
      for (const [id, s] of Object.entries(end.snapshot.players)) expect(dist(s.pos, last.targets[id]), `${f.name} ${id}`).toBeLessThan(0.01);
      for (const s of Object.values(end.snapshot.players)) expect(inRect(s.pos, boundsOf(end.setup))).toBe(true);
    }
  }, 60_000);

  it('8. the engine never changes a pinned player or the carrier', () => {
    const f = fixture('09');
    const { board: end, history } = simulate(f.board, 5);
    for (const id of ['A5', 'B3', 'B10']) {
      expect(end.snapshot.players[id].pos).toEqual(f.board.snapshot.players[id].pos);
      for (const r of history) expect(r.targets[id]).toEqual(f.board.snapshot.players[id].pos);
      expect(history[0].reasons[id].kid.length).toBeGreaterThan(0); // still gets a job and a reason
    }
  });
});
