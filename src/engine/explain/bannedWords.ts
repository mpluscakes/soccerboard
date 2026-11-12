/** Jargon that must never appear in kid sentences (coach text may use it). */
export const BANNED_WORDS = [
  'overload',
  'transition',
  'half-space',
  'halfspace',
  'compact',
  'compactness',
  'press',
  'pressing',
  'counter-press',
  'channel',
  'pivot',
  'rotation',
  'underlap',
  'overlap',
  'third man',
  'block',
  'low block',
  'phase',
  'unit',
  'units',
  'zonal',
  'depth',
  'tempo',
  'trigger',
  'cover shadow',
  'recycle',
  'goal-side',
];

export const MAX_KID_WORDS = 15;

export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/** Banned words found in a sentence (whole words / phrases, case-insensitive). */
export function findBanned(sentence: string): string[] {
  const s = sentence.toLowerCase();
  return BANNED_WORDS.filter((w) => new RegExp(`(^|[^a-z])${w.replace(/[-\s]/g, '[-\\s]')}([^a-z]|$)`).test(s));
}
