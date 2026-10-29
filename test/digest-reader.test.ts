import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/index.js';

describe('readNight', () => {
  it('aggregates 2026-10-28 into 5 jobs and counts 1 bad line', () => {
    const result = readNight('runs', '2026-10-28');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.digest.badLines).toBe(1);
    expect(result.digest.rows).toHaveLength(5);
    expect(result.digest.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const refresh = result.digest.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh.retries).toBe(3);
    expect(refresh.lastStatus).toBe('ok');
    const render = result.digest.rows.find((r) => r.job === 'digest/render')!;
    expect(render.owner).toBeNull();
    const backup = result.digest.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
  });

  it('returns missing when the night file is absent', () => {
    expect(readNight('runs', '2099-01-01')).toEqual({ ok: false, reason: 'missing' });
  });
});
