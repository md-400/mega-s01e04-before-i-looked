import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { DigestNight, DigestRow } from '../src/digest/types.js';
import { Digest } from '../src/views/digest.js';
import { Layout } from '../src/views/layout.js';

const row: DigestRow = {
  job: 'alpha',
  owner: null,
  runs: 5,
  retries: 3,
  lastStatus: 'ok',
  lastError: 'connection lost',
  firstAt: '2026-10-28T01:00:00+02:00',
  lastAt: '2026-10-28T02:00:00+02:00',
  anyFailure: true,
};

async function render(rows: DigestRow[], badLines = 0) {
  const digest: DigestNight = { rows, badLines, counts: { ok: 1, retry: 3, fail: 1 } };
  const app = new Hono();
  app.get('/', (c) => c.html(
    <Layout title="digest" lane={{ id: 'test-lane', marker: 'view-test' }}>
      <Digest night="2026-10-28" digest={digest} />
    </Layout>,
  ));
  const response = await app.request('/');
  expect(response.status).toBe(200);
  return response.text();
}

describe('digest view', () => {
  it('shows every field, original time offsets, counts, and the lane in one table', async () => {
    const html = await render([row], 1);
    expect(html).toContain('test-lane');
    expect(html).toContain('view-test');
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('<td>alpha</td><td>—</td><td>5</td>');
    expect(html).toContain('connection lost');
    expect(html).toContain(row.firstAt);
    expect(html).toContain(row.lastAt);
    expect(html).toContain('ok: 1 · retry: 3 · fail: 1');
    expect(html).toContain('<p class="warn">bad lines: 1</p>');
    expect(html.match(/<table>/g)).toHaveLength(1);
    expect(html.match(/<style>/g)).toHaveLength(1);
    expect(html).not.toContain('<script');
  });

  it('preserves the shared reader code-point order without locale sorting or mutation', async () => {
    const jobs = ['!job', 'Zebra', '_job', 'alpha', 'éclair'];
    const rows = jobs.map((job) => ({ ...row, job }));
    const html = await render(rows);
    const renderedJobs = [...html.matchAll(/<tr><td>(.*?)<\/td>/g)].map((match) => match[1]);
    expect(renderedJobs).toEqual(jobs);
    expect(rows.map((entry) => entry.job)).toEqual(jobs);
  });

  it('marks three retries and historical failures even after recovery', async () => {
    const html = await render([row]);
    expect(html).toContain('<td class="warn">3</td>');
    expect(html).toContain('<td>ok</td>');
    expect(html).toContain('<td class="warn">yes</td>');
  });

  it('does not mark fewer than three retries and marks the last failure', async () => {
    const html = await render([{ ...row, retries: 2, lastStatus: 'fail', lastError: null }]);
    expect(html).toContain('<td>2</td>');
    expect(html).not.toContain('<td class="warn">2</td>');
    expect(html).toContain('<td class="warn">fail</td><td>—</td>');
    const healthyHtml = await render([{ ...row, retries: 0, anyFailure: false }]);
    expect(healthyHtml).toContain('<td>no</td>');
    expect(healthyHtml).not.toContain('<td class="warn">no</td>');
  });

  it('says nothing ran when there are no rows', async () => {
    const html = await render([]);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table>');
  });

  it('escapes log text rather than rendering it as markup', async () => {
    const html = await render([{ ...row, job: '<script>alert(1)</script>', owner: '<b>owner</b>' }]);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;owner&lt;/b&gt;');
    expect(html).not.toContain('<script');
  });
});
