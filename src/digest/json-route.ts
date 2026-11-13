import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from './reader.js';

export function registerDigestJson(app: Hono, config: RigConfig): void {
  app.get('/api/digest/:night', async (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return c.notFound();

    const date = new Date(`${night}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== night) {
      return c.notFound();
    }

    const digest = await readNight(config.runsDir, night);
    if (digest === null) return c.notFound();

    return c.json(digest);
  });
}
