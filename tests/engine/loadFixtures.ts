import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Fixture } from './helpers';

const dir = join(__dirname, 'fixtures');

export function loadFixtures(): Fixture[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(dir, n), 'utf8')) as Fixture);
}

export const fixture = (prefix: string): Fixture => {
  const f = loadFixtures().find((x) => x.name.startsWith(prefix));
  if (!f) throw new Error(`no fixture ${prefix}`);
  return f;
};
