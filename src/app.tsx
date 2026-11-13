import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';
import { registerDigestHtml } from './digest/html-route.js';
import { registerDigestJson } from './digest/json-route.js';
import { readBoardNights } from './digest/board.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', async (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} nights={await readBoardNights(config.runsDir)} />
      </Layout>,
    ),
  );

  registerDigestHtml(app, config);
  registerDigestJson(app, config);

  return app;
}
