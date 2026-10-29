import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestNight, DigestRow, JobStatus, ReadNightResult } from './types.js';

type LogLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error?: string;
};

const STATUSES = new Set<JobStatus>(['ok', 'retry', 'fail']);

function parseLine(line: string): LogLine | null {
  try {
    const raw = JSON.parse(line) as Record<string, unknown>;
    if (typeof raw.at !== 'string' || typeof raw.job !== 'string') return null;
    if (typeof raw.status !== 'string' || !STATUSES.has(raw.status as JobStatus)) return null;
    if (!(raw.owner === null || typeof raw.owner === 'string')) return null;
    const error = typeof raw.error === 'string' ? raw.error : undefined;
    return {
      at: raw.at,
      job: raw.job,
      status: raw.status as JobStatus,
      owner: raw.owner,
      ...(error !== undefined ? { error } : {}),
    };
  } catch {
    return null;
  }
}

export function readNight(runsDir: string, night: string): ReadNightResult {
  const path = join(runsDir, `${night}.jsonl`);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { ok: false, reason: 'missing' };
  }

  const byJob = new Map<
    string,
    {
      owner: string | null;
      runs: number;
      retries: number;
      lastStatus: JobStatus;
      lastError: string | null;
      firstAt: string;
      lastAt: string;
    }
  >();
  let badLines = 0;
  const counts = { ok: 0, retry: 0, fail: 0 };

  for (const line of text.split('\n')) {
    if (line === '') continue;
    const parsed = parseLine(line);
    if (!parsed) {
      badLines += 1;
      continue;
    }
    counts[parsed.status] += 1;
    const prev = byJob.get(parsed.job);
    if (!prev) {
      byJob.set(parsed.job, {
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error ?? null,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
      continue;
    }
    prev.runs += 1;
    if (parsed.status === 'retry') prev.retries += 1;
    prev.owner = parsed.owner;
    prev.lastStatus = parsed.status;
    prev.lastError = parsed.error ?? null;
    prev.lastAt = parsed.at;
  }

  const rows: DigestRow[] = [...byJob.entries()]
    .map(([job, row]) => ({ job, ...row }))
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  const digest: DigestNight = { night, rows, badLines, counts };
  return { ok: true, digest };
}
