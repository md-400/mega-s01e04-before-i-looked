import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { readBoardNights } from '../src/digest/board.js';
import { readStatus } from '../src/status.js';
import { StatusBoard } from '../src/views/status.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  let runsDir: string;

  beforeEach(async () => {
    runsDir = await mkdtemp(join(tmpdir(), 'rig-board-'));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(runsDir, { recursive: true, force: true });
  });

  // The integrator wires this async helper into app.tsx's existing layout.
  function boardApp() {
    const app = new Hono();
    app.get('/', async (c) => c.html(
      <StatusBoard
        status={readStatus({ ...config, runsDir })}
        nights={await readBoardNights(runsDir)}
      />,
    ));
    return app;
  }

  it('shows the lane banner and the nights on disk', async () => {
    await writeFile(join(runsDir, '2026-10-28.jsonl'), '');
    vi.stubEnv('LANE_MARKER', 'TEST-MARKER');
    const res = await createApp({ ...config, runsDir }).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('links nights newest first with event counts, not final job statuses', async () => {
    const entry = (status: string) => JSON.stringify({
      at: '2026-10-28T22:00:00+01:00', job: 'same-job', owner: null, status,
    });
    await writeFile(join(runsDir, '2026-10-28.jsonl'), [
      entry('retry'), entry('retry'), entry('fail'), entry('ok'), entry('ok'),
      'not json', entry('invalid'),
    ].join('\n'));
    await writeFile(join(runsDir, '2026-10-29.jsonl'), '');
    await writeFile(join(runsDir, 'notes.txt'), 'ignored');

    const nights = await readBoardNights(runsDir);
    expect(nights).toEqual([
      { night: '2026-10-29', counts: { ok: 0, retry: 0, fail: 0 } },
      { night: '2026-10-28', counts: { ok: 2, retry: 2, fail: 1 } },
    ]);

    const res = await boardApp().request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<a href="/digest/2026-10-29">2026-10-29</a> · ok 0 / retry 0 / fail 0');
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a> · ok 2 / retry 2 / fail 1');
    expect(html.indexOf('/digest/2026-10-29')).toBeLessThan(html.indexOf('/digest/2026-10-28'));
    expect(html).not.toContain('notes.txt');
  });

  it('shows an empty state when no nights exist', async () => {
    const res = await boardApp().request('/');
    expect(await res.text()).toContain('nothing in runs/');
  });

  it('keeps a link but shows missing counts as dashes', async () => {
    const app = new Hono();
    app.get('/', (c) => c.html(
      <StatusBoard status={{ ...readStatus({ ...config, runsDir }), nights: ['2026-10-28'] }} />,
    ));
    const res = await app.request('/');
    expect(await res.text()).toContain('<a href="/digest/2026-10-28">2026-10-28</a> · ok — / retry — / fail —');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
