import type { ExplainTemplate } from '../types';

/**
 * All explanation text lives here so wording can be tuned in one place.
 * kid: 15 words or fewer, no jargon (see bannedWords.ts). coach: free.
 */
export const JOB_TEXT = {
  carrier: { kid: "You have the ball. Look up: who's open?", coach: 'On the ball: scan for the open pass.' },
  supporter: {
    kid: 'Get open! Stand where nothing blocks a pass from {carrier}.',
    coach: 'Support: offer {carrier} a clear passing lane.',
  },
  runner: {
    kid: 'Run toward their goal so {carrier} can pass it forward.',
    coach: 'Depth: stretch the defence with a forward run.',
  },
  width: {
    kid: 'Stay wide, near the side line, to stretch them out.',
    coach: 'Width: hold the flank to stretch their shape.',
  },
  shapeAttack: {
    kid: "Keep your spot so we're not all in one place.",
    coach: 'Balance: hold your position to keep the team shape.',
  },
  presser: {
    kid: 'Go to the ball! Stand between them and our goal.',
    coach: 'First defender: pressure the ball from goal-side.',
  },
  cover: {
    kid: "Be the backup. If {presser} gets beaten, you're next.",
    coach: 'Second defender: cover depth behind {presser}.',
  },
  marker: {
    kid: 'Stay between {mark} and our goal, like a wall.',
    coach: 'Mark {mark} goal-side.',
  },
  shapeDefend: {
    kid: 'Stay close to your teammates so there are no big gaps.',
    coach: 'Stay compact: close the gaps between units.',
  },
  chaser: { kid: "Loose ball! You're closest, go get it.", coach: 'Nearest player: win the loose ball.' },
  hold: { kid: "Don't all chase. Stay where you can help.", coach: 'Hold shape and be ready for the transition.' },
  keeperDefend: {
    kid: 'Stand between the ball and the middle of our goal.',
    coach: 'Keeper: narrow the angle on the ball-to-goal line.',
  },
  keeperAttack: {
    kid: 'Step to the side so we can pass back to you.',
    coach: 'Keeper: offer a back-pass option beside the goal.',
  },
} satisfies Record<string, ExplainTemplate>;

export const TERM_TEXT = {
  spacing: { kid: 'Not too close, or one defender can stop two of you.', coach: 'Spacing: distance to the nearest teammate.' },
  passLane: { kid: 'Nobody is in the way of the pass.', coach: 'Open passing lane from the ball.' },
  passDistance: { kid: 'Close enough for an easy pass.', coach: 'Within comfortable passing range.' },
  supportAngle: { kid: 'On an angle, so you make a triangle.', coach: 'Support angle: 30 to 60 degrees off the ball line.' },
  forward: { kid: 'Closer to their goal is more dangerous.', coach: 'Progress toward the opponent goal.' },
  goalSide: { kid: 'Between them and our goal.', coach: 'Goal-side of the mark.' },
  pressBall: { kid: 'Close enough to stop them.', coach: 'Pressing distance, goal-side of the carrier.' },
  cover: { kid: 'Ready to help if they get past.', coach: 'Cover depth behind and inside the presser.' },
  width: { kid: 'Wide, near the side line.', coach: 'In the flank channel.' },
  shape: { kid: 'Where your position should be right now.', coach: 'Formation slot, shifted toward the ball.' },
  keeperArc: { kid: 'Covering the middle of the goal.', coach: 'On the keeper arc for this ball position.' },
  onside: { kid: "Stay level so you're not offside.", coach: 'Onside: not beyond the second-last defender.' },
  getBall: { kid: 'Be first to the ball.', coach: 'Shortest path to the loose ball.' },
} satisfies Record<string, ExplainTemplate>;
