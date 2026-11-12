import { describe, expect, it } from 'vitest';
import { formationsFor } from '../../src/model/formations';
import { ballPos, dist, inRect } from '../../src/model/geometry';
import { migrate } from '../../src/model/migrate';
import { PRESETS, initialSnapshot, makeSetup, newBoard } from '../../src/model/presets';
import { reduce } from '../../src/model/reduce';
import type { BoardState, PitchPreset } from '../../src/model/types';
import { History } from '../../src/store/history';

describe('board and setup', () => {
  it('1. a new board is 5v5 with one keeper per side at level 1; presets have the listed sizes', () => {
    const b = newBoard();
    expect(b.setup.pitch.preset).toBe('5v5');
    expect(b.view.levelId).toBe(1);
    for (const id of ['A', 'B'] as const) {
      const team = b.setup.players.filter((p) => p.teamId === id);
      expect(team).toHaveLength(5);
      expect(team.filter((p) => p.role === 'GK')).toHaveLength(1);
    }
    const want: Record<string, [number, number, number]> = {
      '4v4': [25, 18, 3],
      '5v5': [35, 25, 4],
      '7v7': [50, 35, 5],
      '9v9': [65, 45, 5],
      '11v11': [100, 64, 7.32],
    };
    for (const [preset, [length, width, goal]] of Object.entries(want)) {
      const pitch = makeSetup({ preset: preset as PitchPreset }).pitch;
      expect(Math.abs(pitch.length - length)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(pitch.width - width)).toBeLessThanOrEqual(0.1);
      expect(pitch.goalWidth).toBeCloseTo(goal);
    }
    expect(makeSetup({ preset: '4v4' }).pitch.keeperArea).toBeNull();
    expect(makeSetup({ preset: '5v5' }).pitch.keeperArea).not.toBeNull();
    const custom = makeSetup({ preset: 'custom', length: 42, width: 28, goalWidth: 3.6, box: { depth: 5, width: 9 } }).pitch;
    expect([custom.length, custom.width, custom.goalWidth, custom.keeperArea?.w, custom.keeperArea?.h]).toEqual([42, 28, 3.6, 5, 9]);
  });

  it('2. any team sizes from 1 to 11 load with a formation and no overlapping tokens', () => {
    for (const preset of Object.keys(PRESETS) as PitchPreset[]) {
      for (const keepers of [true, false]) {
        for (let a = 1; a <= 11; a++) {
          for (const bCount of [1, 2, 5, 11, a]) {
            for (const fa of formationsFor(keepers && a >= 2 ? a - 1 : a)) {
              const setup = makeSetup({ preset, countA: a, countB: bCount, keepers, formationA: fa });
              expect(setup.players.filter((p) => p.teamId === 'A')).toHaveLength(a);
              expect(setup.players.filter((p) => p.teamId === 'B')).toHaveLength(bCount);
              expect(setup.formationIds.A).toBe(fa);
              const pos = Object.values(initialSnapshot(setup).players).map((p) => p.pos);
              for (let i = 0; i < pos.length; i++) {
                expect(inRect(pos[i], { x: -setup.pitch.length / 2, y: -setup.pitch.width / 2, w: setup.pitch.length, h: setup.pitch.width })).toBe(true);
                for (let j = i + 1; j < pos.length; j++) {
                  expect(dist(pos[i], pos[j]), `${preset} ${a}v${bCount} ${fa}`).toBeGreaterThanOrEqual(2);
                }
              }
            }
          }
        }
      }
    }
    // The two named in the spec.
    expect(makeSetup({ preset: '4v4', countA: 2, countB: 1, keepers: false }).players).toHaveLength(3);
    expect(makeSetup({ preset: '11v11' }).players).toHaveLength(22);
  });

  it('3. setting an active area pulls every token inside and keeps drags inside', () => {
    const area = { x: 0, y: -12.5, w: 12, h: 10 };
    let b = reduce(newBoard(), { type: 'SET_ACTIVE_AREA', area });
    for (const p of Object.values(b.snapshot.players)) expect(inRect(p.pos, area)).toBe(true);
    b = reduce(b, { type: 'MOVE_PLAYER', id: 'A3', to: { x: -15, y: 10 } });
    expect(inRect(b.snapshot.players.A3.pos, area)).toBe(true);
    b = reduce(b, { type: 'MOVE_BALL', to: { x: 30, y: 30 }, snap: false });
    expect(inRect(ballPos(b.snapshot), area)).toBe(true);
    b = reduce(b, { type: 'SET_ACTIVE_AREA', area: null });
    expect(b.setup.activeArea).toBeUndefined();
  });

  it('4. exactly one player can be You at a time', () => {
    let b = reduce(newBoard(), { type: 'SET_YOU', id: 'A3' });
    expect(b.view.youId).toBe('A3');
    b = reduce(b, { type: 'SET_YOU', id: 'B2' });
    expect(b.view.youId).toBe('B2');
    expect(reduce(b, { type: 'SET_YOU', id: 'nobody' }).view.youId).toBe('B2');
    expect(reduce(b, { type: 'SET_YOU', id: null }).view.youId).toBeNull();
  });
});

describe('possession rules', () => {
  const b0 = newBoard();

  it('dropping the ball within 1.5 m of a player gives it to them; elsewhere it is loose', () => {
    const near = reduce(b0, { type: 'MOVE_BALL', to: { x: b0.snapshot.players.B3.pos.x + 1, y: b0.snapshot.players.B3.pos.y } });
    expect(near.snapshot.ball).toMatchObject({ kind: 'held', carrierId: 'B3' });
    const far = reduce(b0, { type: 'MOVE_BALL', to: { x: 0, y: 10 } });
    expect(far.snapshot.ball).toEqual({ kind: 'loose', pos: { x: 0, y: 10 } });
  });

  it('5. dragging the carrier carries the ball 0.7 m ahead in the drag direction', () => {
    const start = b0.snapshot.players.A5.pos;
    const b = reduce(b0, { type: 'MOVE_PLAYER', id: 'A5', to: { x: start.x, y: start.y + 3 } });
    expect(b.snapshot.ball).toMatchObject({ kind: 'held', carrierId: 'A5' });
    const ball = ballPos(b.snapshot);
    expect(ball.x).toBeCloseTo(start.x);
    expect(ball.y).toBeCloseTo(start.y + 3.7);
  });

  it('6. a pass travels to the teammate, who becomes the carrier', () => {
    let b = reduce(b0, { type: 'PASS', fromId: 'A5', toId: 'A3', t0: 0 });
    expect(b.snapshot.ball.kind).toBe('travelling');
    expect(ballPos(b.snapshot, 0)).toEqual(ballPos(b0.snapshot));
    b = reduce(b, { type: 'BALL_ARRIVE' });
    expect(b.snapshot.ball).toMatchObject({ kind: 'held', carrierId: 'A3' });
  });

  it('7. a kick to empty grass leaves a loose ball at that point; near a player they collect it', () => {
    let b = reduce(reduce(b0, { type: 'KICK', to: { x: 4, y: -9 }, t0: 0 }), { type: 'BALL_ARRIVE' });
    expect(b.snapshot.ball).toEqual({ kind: 'loose', pos: { x: 4, y: -9 } });
    const b4 = b0.snapshot.players.B4.pos;
    b = reduce(reduce(b0, { type: 'KICK', to: { x: b4.x - 1, y: b4.y }, t0: 0 }), { type: 'BALL_ARRIVE' });
    expect(b.snapshot.ball).toMatchObject({ kind: 'held', carrierId: 'B4' });
    // 12 m/s: half way after half the time.
    const k = reduce(b0, { type: 'KICK', to: { x: ballPos(b0.snapshot).x + 12, y: 0 }, t0: 1000 });
    expect(ballPos(k.snapshot, 1500).x).toBeCloseTo(ballPos(b0.snapshot).x + 6);
  });

  it('8. APPLY_TARGETS never moves a pinned player or the carrier; unpin restores it', () => {
    let b = reduce(b0, { type: 'PIN', id: 'A3' });
    const to = { x: 1, y: 1 };
    b = reduce(b, { type: 'APPLY_TARGETS', targets: { A3: to, A5: to, A4: to } });
    expect(b.snapshot.players.A3.pos).toEqual(b0.snapshot.players.A3.pos);
    expect(b.snapshot.players.A5.pos).toEqual(b0.snapshot.players.A5.pos);
    expect(b.snapshot.players.A4.pos).toEqual(to);
    b = reduce(reduce(b, { type: 'UNPIN', id: 'A3' }), { type: 'APPLY_TARGETS', targets: { A3: to } });
    expect(b.snapshot.players.A3.pos).toEqual(to);
  });

  it('reduce is pure: the input state is never changed', () => {
    const before = JSON.stringify(b0);
    reduce(b0, { type: 'MOVE_PLAYER', id: 'A5', to: { x: 3, y: 3 } });
    reduce(b0, { type: 'SET_LABEL', id: 'A5', label: 'Sam' });
    reduce(b0, { type: 'SET_ACTIVE_AREA', area: { x: 0, y: 0, w: 5, h: 5 } });
    expect(JSON.stringify(b0)).toBe(before);
  });
});

describe('history and persistence', () => {
  it('10. undo and redo walk through at least 50 actions; reset returns to the setup snapshot', () => {
    const h = new History<BoardState>();
    let b = newBoard();
    const states = [b];
    for (let i = 0; i < 60; i++) {
      h.push(b);
      b = reduce(b, { type: 'MOVE_PLAYER', id: 'A3', to: { x: -10 + i * 0.2, y: (i % 7) - 3 } });
      states.push(b);
    }
    for (let i = 59; i >= 0; i--) {
      b = h.undo(b)!;
      expect(b).toEqual(states[i]);
    }
    expect(h.undo(b)).toBeNull();
    for (let i = 1; i <= 60; i++) {
      b = h.redo(b)!;
      expect(b).toEqual(states[i]);
    }
    expect(h.redo(b)).toBeNull();
    const reset = reduce(b, { type: 'LOAD_SNAPSHOT', snapshot: initialSnapshot(b.setup) });
    expect(reset.snapshot).toEqual(newBoard().snapshot);
  });

  it('24. a saved board survives a round trip through storage and migrate', () => {
    let b = reduce(newBoard({ preset: '7v7' }), { type: 'MOVE_PLAYER', id: 'A3', to: { x: 3.25, y: -4.5 } });
    b = reduce(reduce(b, { type: 'PIN', id: 'A3' }), { type: 'SET_YOU', id: 'B2' });
    expect(migrate(JSON.parse(JSON.stringify(b)))).toEqual(b);
    expect(migrate(null)).toBeNull();
    expect(migrate({ schemaVersion: 99 })).toBeNull();
    expect(migrate({ schemaVersion: 1, setup: {} })).toBeNull();
  });
});
