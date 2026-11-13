import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const night = '2026-10-28';
const entry = {
  at: '2026-10-28T23:00:02+01:00',
  job: 'lane/sync',
  status: 'ok',
  owner: 'rook',
};

describe('readNight', () => {
  let runsDir: string;

  beforeEach(async () => {
    runsDir = await mkdtemp(join(tmpdir(), 'rig-reader-'));
  });

  afterEach(async () => {
    await rm(runsDir, { recursive: true, force: true });
  });

  async function writeEntries(entries: unknown[]) {
    await writeFile(join(runsDir, `${night}.jsonl`), entries.map((value) => JSON.stringify(value)).join('\n'));
  }

  it('reads the real fixture without dropping its null owner or malformed line', async () => {
    const result = await readNight(new URL('../runs/', import.meta.url).pathname, night);
    expect(result?.badLines).toBe(1);
    expect(result?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(result?.rows.map((row) => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(result?.rows[0]).toEqual({
      job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok',
      lastError: null, firstAt: '2026-10-29T05:41:09+01:00',
      lastAt: '2026-10-29T05:41:09+01:00', anyFailure: false,
    });
    expect(result?.rows[1]).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(result?.rows[2]).toMatchObject({ runs: 8, retries: 1 });
    expect(result?.rows[3]).toMatchObject({ anyFailure: true, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('aggregates in file order, preserves offsets, and keeps failures after recovery', async () => {
    await writeEntries([
      { ...entry, status: 'fail', error: 'first error' },
      { ...entry, at: '2026-10-28T20:00:00-04:00', status: 'retry', owner: 'next', error: 'latest error' },
      { ...entry, at: '2026-10-28T01:00:00+05:30', owner: null },
    ]);
    expect(await readNight(runsDir, night)).toEqual({
      rows: [{
        job: 'lane/sync', owner: null, runs: 3, retries: 1, lastStatus: 'ok',
        lastError: 'latest error', firstAt: entry.at, lastAt: '2026-10-28T01:00:00+05:30',
        anyFailure: true,
      }],
      badLines: 0,
      counts: { ok: 1, retry: 1, fail: 1 },
    });
  });

  it('retains an explicitly supplied empty error and updates the owner from the last entry', async () => {
    await writeEntries([
      { ...entry, owner: null, error: 'old error' },
      { ...entry, status: 'retry', error: '' },
      entry,
    ]);
    const result = await readNight(runsDir, night);
    expect(result?.rows[0]).toMatchObject({ owner: 'rook', lastError: '', runs: 3, retries: 1 });
    expect(result?.counts).toEqual({ ok: 2, retry: 1, fail: 0 });
  });

  it('counts invalid nonblank lines and ignores blank lines, including CRLF', async () => {
    const invalid = [
      null, [], true, 1, 'text', {},
      { ...entry, at: 7 }, { ...entry, at: '' }, { ...entry, at: 'not a time' },
      { ...entry, job: null }, { ...entry, job: '   ' },
      { ...entry, status: 'unknown' }, { ...entry, status: '__proto__' },
      { ...entry, owner: 7 },
      { at: entry.at, job: entry.job, status: entry.status },
      { ...entry, error: 7 }, { ...entry, error: null },
    ];
    await writeFile(join(runsDir, `${night}.jsonl`), [
      ' ', '\t', '', JSON.stringify(entry), '{broken',
      ...invalid.map((value) => JSON.stringify(value)), '',
    ].join('\r\n'));
    const result = await readNight(runsDir, night);
    expect(result?.badLines).toBe(invalid.length + 1);
    expect(result?.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
    expect(result?.rows).toHaveLength(1);
  });

  it('sorts job names and handles special object keys as ordinary jobs', async () => {
    await writeEntries(['z', 'constructor', 'a', '__proto__'].map((job) => ({ ...entry, job })));
    expect((await readNight(runsDir, night))?.rows.map((row) => row.job))
      .toEqual(['__proto__', 'a', 'constructor', 'z']);
  });

  it('returns null for a missing file', async () => {
    expect(await readNight(runsDir, night)).toBeNull();
  });

  it.each(['', ' \n\r\n\t'])('returns zero counts and no rows for an empty or blank file', async (contents) => {
    await writeFile(join(runsDir, `${night}.jsonl`), contents);
    expect(await readNight(runsDir, night)).toEqual({
      rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('returns an empty digest with bad line counts when no entries are valid', async () => {
    await writeEntries([null, { status: 'ok' }]);
    expect(await readNight(runsDir, night)).toEqual({
      rows: [], badLines: 2, counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it.each([
    '../2026-10-28', '../../2026-10-28', '/2026-10-28', '2026-10-28/../2026-10-28',
    '..\\2026-10-28', '%2e%2e%2f2026-10-28', '2026-10-28.jsonl', '2026-10-28\0',
    '2026-10-28\n', '', '2026-1-01', '2026-13-01', '2026-02-30', '2026-02-29',
  ])('rejects invalid night %j before reading a file', async (invalidNight) => {
    // A file where the runs directory belongs would reject a valid read with ENOTDIR.
    const notDirectory = join(runsDir, 'file');
    await writeFile(notDirectory, 'not a directory');
    expect(await readNight(notDirectory, invalidNight)).toBeNull();
  });

  it('accepts a leap-day night', async () => {
    await writeFile(join(runsDir, '2024-02-29.jsonl'), '');
    expect(await readNight(runsDir, '2024-02-29')).not.toBeNull();
  });

  it('propagates filesystem errors other than a missing file', async () => {
    await mkdir(join(runsDir, `${night}.jsonl`));
    await expect(readNight(runsDir, night)).rejects.toMatchObject({ code: 'EISDIR' });
    const notDirectory = join(runsDir, 'file');
    await writeFile(notDirectory, 'not a directory');
    await expect(readNight(notDirectory, night)).rejects.toMatchObject({ code: 'ENOTDIR' });
  });
});
