import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { DigestNight, DigestStatus } from '../src/digest/types.js';

const night = '2026-10-28';
const firstAt = '2026-10-28T01:15:00+05:30';
const lastAt = '2026-10-28T02:45:00-03:00';

function entry(
  job: string,
  status: DigestStatus = 'ok',
  owner: string | null = 'reader',
  at = firstAt,
  error?: string,
) {
  return JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });
}

function tableRows(html: string): string[] {
  return (html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) ?? []).filter((row) => /<td\b/.test(row));
}

function cells(row: string): string[] {
  return [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((match) =>
    match[1].replace(/<[^>]*>/g, '').trim(),
  );
}

describe('digest routes', () => {
  let runsDir: string;
  let config: RigConfig;

  beforeEach(async () => {
    runsDir = await mkdtemp(join(tmpdir(), 'rig-digest-routes-'));
    config = {
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    };
  });

  afterEach(async () => {
    await rm(runsDir, { recursive: true, force: true });
  });

  async function writeNight(lines: string[]) {
    await writeFile(join(runsDir, `${night}.jsonl`), lines.join('\n'), 'utf8');
  }

  async function requestNight() {
    const app = createApp(config);
    const [page, api] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(api.headers.get('content-type')).toContain('application/json');
    const html = await page.text();
    const digest: DigestNight = await api.json();
    return { html, digest };
  }

  it('returns the DigestNight object and the same sorted, aggregated jobs in one HTML table', async () => {
    await writeNight([
      entry('zeta', 'retry'),
      entry('alpha', 'ok', null),
      entry('zeta', 'ok', 'new-owner', lastAt),
    ]);

    const { html, digest } = await requestNight();

    expect(digest).toEqual({
      rows: [
        {
          job: 'alpha', owner: null, runs: 1, retries: 0, lastStatus: 'ok',
          lastError: null, firstAt, lastAt: firstAt, anyFailure: false,
        },
        {
          job: 'zeta', owner: 'new-owner', runs: 2, retries: 1, lastStatus: 'ok',
          lastError: null, firstAt, lastAt, anyFailure: false,
        },
      ],
      badLines: 0,
      counts: { ok: 2, retry: 1, fail: 0 },
    });
    expect(html.match(/<table\b/g)).toHaveLength(1);
    const rows = tableRows(html);
    expect(rows.map((row) => cells(row)[0])).toEqual(digest.rows.map((row) => row.job));
    expect(cells(rows[0])).toContain('—');
    expect(cells(rows[1])).toContain('new-owner');
    expect(rows[1]).toContain(firstAt);
    expect(rows[1]).toContain(lastAt);
    expect(rows[1]).not.toContain('2026-10-27T19:45:00.000Z');
    expect(rows[1]).not.toContain('2026-10-28T05:45:00.000Z');
    expect(html).not.toMatch(/<script\b/i);
  });

  it.each(['/digest/', '/api/digest/'])('returns 404 for a missing file via %s', async (route) => {
    const response = await createApp(config).request(`${route}${night}`);
    expect(response.status).toBe(404);
  });

  it('renders nothing ran for an empty file and returns an empty DigestNight', async () => {
    await writeNight([]);

    const { html, digest } = await requestNight();

    expect(html).toMatch(/nothing ran/i);
    expect(tableRows(html)).toEqual([]);
    expect(digest).toEqual({ rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('skips malformed and invalid entries, ignores blank lines, and still serves valid rows', async () => {
    await writeNight([
      entry('zeta'),
      'not valid JSON',
      '',
      '   ',
      JSON.stringify({ at: firstAt, job: 'invalid-status', status: 'unknown', owner: null }),
      entry('alpha', 'fail', null, lastAt, 'disk full'),
    ]);

    const { html, digest } = await requestNight();

    expect(digest.badLines).toBe(2);
    expect(digest.counts).toEqual({ ok: 1, retry: 0, fail: 1 });
    expect(digest.rows.map((row) => row.job)).toEqual(['alpha', 'zeta']);
    expect(tableRows(html).map((row) => cells(row)[0])).toEqual(['alpha', 'zeta']);
    expect(html).toContain('disk full');
    expect(html).not.toContain('not valid JSON');
    expect(html).not.toContain('invalid-status');
  });

  it('keeps a malformed-only night available rather than treating it as missing', async () => {
    await writeNight(['{broken']);

    const { html, digest } = await requestNight();

    expect(html).toMatch(/nothing ran/i);
    expect(digest).toEqual({ rows: [], badLines: 1, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('escapes log markup in HTML while preserving original strings in JSON', async () => {
    const job = '<script>alert("job")</script>';
    const owner = '<img src=x onerror="alert(1)">';
    const error = '<svg onload="alert(2)"> & failed';
    await writeNight([entry(job, 'fail', owner, firstAt, error)]);

    const { html, digest } = await requestNight();

    expect(digest.rows[0]).toMatchObject({ job, owner, lastError: error });
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;svg');
    expect(html).toContain('&amp; failed');
    expect(html).not.toMatch(/<(?:script|img|svg)\b/i);
    expect(html).not.toContain(job);
    expect(html).not.toContain(owner);
    expect(html).not.toContain(error);
  });

  it('marks three retries and historical failure, even after recovery, but not two retries', async () => {
    await writeNight([
      entry('two-retries', 'retry'),
      entry('three-retries', 'retry'),
      entry('recovered', 'fail', 'reader', firstAt, 'temporary failure'),
      entry('two-retries', 'retry'),
      entry('three-retries', 'retry'),
      entry('three-retries', 'retry'),
      entry('two-retries', 'ok', 'reader', lastAt),
      entry('three-retries', 'ok', 'reader', lastAt),
      entry('recovered', 'ok', 'reader', lastAt),
    ]);

    const { html, digest } = await requestNight();

    expect(digest.counts).toEqual({ ok: 3, retry: 5, fail: 1 });
    expect(digest.rows).toEqual([
      {
        job: 'recovered', owner: 'reader', runs: 2, retries: 0, lastStatus: 'ok',
        lastError: 'temporary failure', firstAt, lastAt, anyFailure: true,
      },
      {
        job: 'three-retries', owner: 'reader', runs: 4, retries: 3, lastStatus: 'ok',
        lastError: null, firstAt, lastAt, anyFailure: false,
      },
      {
        job: 'two-retries', owner: 'reader', runs: 3, retries: 2, lastStatus: 'ok',
        lastError: null, firstAt, lastAt, anyFailure: false,
      },
    ]);
    const rows = tableRows(html);
    expect(rows.map((row) => cells(row)[0])).toEqual(digest.rows.map((row) => row.job));
    // .warn is the shared layout's visible warning treatment.
    expect(rows[0]).toMatch(/class="[^"]*\bwarn\b[^"]*"/);
    expect(rows[1]).toMatch(/class="[^"]*\bwarn\b[^"]*"/);
    expect(rows[2]).not.toMatch(/class="[^"]*\bwarn\b[^"]*"/);
  });
});
