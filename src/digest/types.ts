export type JobStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type DigestCounts = { ok: number; retry: number; fail: number };

export type DigestNight = {
  night: string;
  rows: DigestRow[];
  badLines: number;
  counts: DigestCounts;
};

export type ReadNightResult =
  | { ok: true; digest: DigestNight }
  | { ok: false; reason: 'missing' };

/** Signature: `readNight(runsDir, night)` — see `./read.ts`. */
export type ReadNight = (runsDir: string, night: string) => ReadNightResult;
