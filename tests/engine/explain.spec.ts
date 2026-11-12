import { describe, expect, it } from 'vitest';
import { allTerms, getLevel, jobRules } from '../../src/engine';
import { MAX_KID_WORDS, findBanned, wordCount } from '../../src/engine/explain/bannedWords';
import { JOB_TEXT, TERM_TEXT } from '../../src/engine/explain/templates';
import { reduce } from '../../src/model/reduce';
import { simulate } from './helpers';
import { loadFixtures } from './loadFixtures';

describe('explanations', () => {
  it('20. every player, every tick, has a kid sentence with names filled in', () => {
    for (const f of loadFixtures()) {
      // Give one player a typed name so both kinds of name are exercised.
      const named = reduce(f.board, { type: 'SET_LABEL', id: f.board.setup.players[1].id, label: 'Sam' });
      const { history } = simulate(named, 2);
      for (const r of history) {
        for (const p of named.setup.players) {
          const reason = r.reasons[p.id];
          expect(reason, `${f.name} ${p.id}`).toBeDefined();
          expect(reason.kid.trim().length).toBeGreaterThan(0);
          expect(reason.coach.trim().length).toBeGreaterThan(0);
          for (const text of [reason.kid, reason.coach, reason.kidDetail, reason.coachDetail]) expect(text).not.toMatch(/[{}]/);
        }
      }
    }
  });

  it('21. kid sentences use 15 words or fewer and no banned jargon', () => {
    const kid = [...Object.values(JOB_TEXT), ...Object.values(TERM_TEXT)].map((t) => t.kid);
    for (const s of kid) {
      // Placeholders become a name of at most two words ("number 7").
      const worst = s.replace(/\{\w+\}/g, 'number 10');
      expect(wordCount(worst), s).toBeLessThanOrEqual(MAX_KID_WORDS);
      expect(findBanned(s), s).toEqual([]);
    }
    // ...and the same for what the engine actually renders.
    for (const f of loadFixtures()) {
      const { history } = simulate(f.board, 1);
      for (const r of history) {
        for (const reason of Object.values(r.reasons)) {
          for (const s of [reason.kid, reason.kidDetail]) {
            expect(wordCount(s), s).toBeLessThanOrEqual(MAX_KID_WORDS);
            expect(findBanned(s), s).toEqual([]);
          }
        }
      }
    }
    // The checker itself catches jargon.
    expect(findBanned('Make an overload in the half-space')).toEqual(expect.arrayContaining(['overload', 'half-space']));
    expect(findBanned('Stand where nothing blocks a pass')).toEqual([]);
  });

  it('every weighted job and term is registered', () => {
    const jobIds = new Set(jobRules().map((j) => j.id));
    const termIds = new Set(allTerms().map((t) => t.id));
    for (const id of [1, 2]) {
      for (const [job, terms] of Object.entries(getLevel(id).weights)) {
        expect(jobIds.has(job), job).toBe(true);
        for (const term of Object.keys(terms)) expect(termIds.has(term), term).toBe(true);
      }
    }
  });
});
