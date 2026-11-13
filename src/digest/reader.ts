import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, ReadNight } from './types.js';

type LogEntry = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function isLogEntry(value: unknown): value is LogEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return 'at' in value && typeof value.at === 'string'
    && value.at.trim().length > 0 && Number.isFinite(Date.parse(value.at))
    && 'job' in value && typeof value.job === 'string' && value.job.trim().length > 0
    && 'status' in value && (value.status === 'ok' || value.status === 'retry' || value.status === 'fail')
    && 'owner' in value && (typeof value.owner === 'string' || value.owner === null)
    && (!('error' in value) || typeof value.error === 'string');
}

function isNight(night: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return false;
  const date = new Date(`${night}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === night;
}

export const readNight: ReadNight = async (runsDir, night) => {
  if (!isNight(night)) return null;

  let contents: string;
  try {
    contents = await readFile(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  const jobs = new Map<string, DigestRow>();
  const counts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const line of contents.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      badLines++;
      continue;
    }
    if (!isLogEntry(entry)) {
      badLines++;
      continue;
    }

    counts[entry.status]++;
    const row = jobs.get(entry.job);
    if (row) {
      row.owner = entry.owner;
      row.runs++;
      row.retries += Number(entry.status === 'retry');
      row.lastStatus = entry.status;
      if (entry.error !== undefined) row.lastError = entry.error;
      row.lastAt = entry.at;
      row.anyFailure ||= entry.status === 'fail';
    } else {
      jobs.set(entry.job, {
        job: entry.job,
        owner: entry.owner,
        runs: 1,
        retries: Number(entry.status === 'retry'),
        lastStatus: entry.status,
        lastError: entry.error ?? null,
        firstAt: entry.at,
        lastAt: entry.at,
        anyFailure: entry.status === 'fail',
      });
    }
  }

  const rows = [...jobs.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return { rows, badLines, counts };
};
