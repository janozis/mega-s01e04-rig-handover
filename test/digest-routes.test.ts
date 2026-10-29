import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

function tempRuns(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
  }
  return {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  };
}

describe('digest routes', () => {
  it('GET /digest/:night returns 200 with rows', async () => {
    const config = tempRuns({
      '2026-10-28.jsonl':
        '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}\n',
    });
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('rig/rotate-logs');
  });

  it('GET /digest/:night returns 404 when the file is missing', async () => {
    const res = await createApp(tempRuns({})).request('/digest/2099-01-01');
    expect(res.status).toBe(404);
  });

  it('GET /digest/:night renders nothing ran for an empty file', async () => {
    const res = await createApp(tempRuns({ '2026-10-28.jsonl': '' })).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('GET /digest/:night still renders when a line is bad', async () => {
    const body =
      '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}\n' +
      '{"at":"broken\n';
    const res = await createApp(tempRuns({ '2026-10-28.jsonl': body })).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('rig/rotate-logs');
  });

  it('GET /api/digest/:night matches page job order', async () => {
    const body = [
      '{"at":"2026-10-28T23:00:02+01:00","job":"zebra","status":"ok","owner":"a"}',
      '{"at":"2026-10-28T23:01:02+01:00","job":"alpha","status":"ok","owner":"b"}',
      '',
    ].join('\n');
    const config = tempRuns({ '2026-10-28.jsonl': body });
    const app = createApp(config);
    const html = await (await app.request('/digest/2026-10-28')).text();
    const json = (await (await app.request('/api/digest/2026-10-28')).json()) as { job: string }[];
    expect(json.map((r) => r.job)).toEqual(['alpha', 'zebra']);
    const alphaAt = html.indexOf('alpha');
    const zebraAt = html.indexOf('zebra');
    expect(alphaAt).toBeGreaterThan(-1);
    expect(zebraAt).toBeGreaterThan(alphaAt);
  });

  it('GET /api/digest/:night returns 404 when missing', async () => {
    const res = await createApp(tempRuns({})).request('/api/digest/2099-01-01');
    expect(res.status).toBe(404);
  });
});
