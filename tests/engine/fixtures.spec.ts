import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFixtures } from './helpers';

const dir = join(__dirname, 'fixtures');

// Regenerate with: UPDATE_FIXTURES=1 npx vitest run tests/engine/fixtures.spec.ts
describe('fixture boards', () => {
  it('match what the builders produce (10 boards)', () => {
    const built = buildFixtures();
    expect(built).toHaveLength(10);
    for (const f of built) {
      const file = join(dir, `${f.name}.json`);
      const json = JSON.stringify(f, null, 1) + '\n';
      if (process.env.UPDATE_FIXTURES || !existsSync(file)) writeFileSync(file, json);
      expect(readFileSync(file, 'utf8')).toBe(json);
    }
    expect(readdirSync(dir).filter((n) => n.endsWith('.json'))).toHaveLength(10);
  });
});
