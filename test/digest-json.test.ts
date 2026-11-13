import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RigConfig } from '../src/config.js';
import { registerDigestJson } from '../src/digest/json-route.js';
import type { DigestNight, ReadNight } from '../src/digest/types.js';

const { readNight } = vi.hoisted(() => ({ readNight: vi.fn<ReadNight>() }));
vi.mock('../src/digest/reader.js', () => ({ readNight }));

const config: RigConfig = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: '/unused/mock-runs',
};

function createApp() {
  const app = new Hono();
  registerDigestJson(app, config);
  return app;
}

describe('digest JSON route', () => {
  beforeEach(() => readNight.mockReset());

  it('returns the shared result unchanged, including row order and bad lines', async () => {
    const digest: DigestNight = {
      rows: ['z-job', 'a-job'].map((job) => ({
        job,
        owner: null,
        runs: 5,
        retries: 3,
        lastStatus: 'ok',
        lastError: 'earlier failure',
        firstAt: '2026-10-28T01:00:00+01:00',
        lastAt: '2026-10-28T02:00:00+01:00',
        anyFailure: true,
      })),
      badLines: 1,
      counts: { ok: 2, retry: 6, fail: 2 },
    };
    readNight.mockResolvedValue(digest);

    const response = await createApp().request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual(digest);
    expect(readNight).toHaveBeenCalledExactlyOnceWith(config.runsDir, '2026-10-28');
  });

  it('returns an empty digest as JSON rather than 404', async () => {
    const digest: DigestNight = { rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
    readNight.mockResolvedValue(digest);

    const response = await createApp().request('/api/digest/2026-10-29');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(digest);
  });

  it('returns 404 when the reader reports a missing file', async () => {
    readNight.mockResolvedValue(null);
    expect((await createApp().request('/api/digest/2026-10-30')).status).toBe(404);
  });

  it.each(['', 'not-a-night', '2026-1-02', '2026-13-01', '2026-02-30', '2025-02-29', '..%2Fsecret'])(
    'returns 404 without reading invalid night %s',
    async (night) => {
      expect((await createApp().request(`/api/digest/${night}`)).status).toBe(404);
      expect(readNight).not.toHaveBeenCalled();
    },
  );

  it('accepts a valid leap day', async () => {
    readNight.mockResolvedValue(null);
    await createApp().request('/api/digest/2024-02-29');
    expect(readNight).toHaveBeenCalledExactlyOnceWith(config.runsDir, '2024-02-29');
  });
});
