import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { lane } from '../lane.js';
import { Digest } from '../views/digest.js';
import { Layout } from '../views/layout.js';
import { readNight } from './reader.js';

export function registerDigestHtml(app: Hono, config: RigConfig) {
  app.get('/digest/:night', async (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return c.notFound();

    const digest = await readNight(config.runsDir, night);
    if (digest === null) {
      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <h1>digest · {night}</h1>
          <p>night not found</p>
        </Layout>,
        404,
      );
    }

    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <Digest night={night} digest={digest} />
      </Layout>,
    );
  });
}
