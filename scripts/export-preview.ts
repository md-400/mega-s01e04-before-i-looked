import { writeFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

// Run from any directory. Deliberately do not load .env: the caller supplies lane values.
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const [output, ...extra] = process.argv.slice(2);
if (!output || extra.length) {
  throw new Error('Usage: pnpm exec tsx scripts/export-preview.ts /outside/repo/index.html');
}

// Require an existing destination directory, resolving symlinks before checking the boundary.
const destination = resolve(await realpath(dirname(resolve(output))), basename(output));
const fromRoot = relative(root, destination);
if (!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith('../')) {
  throw new Error('Preview output must be outside the repository.');
}

const config = loadConfig(resolve(root, 'rig.json'));
const app = createApp({ ...config, runsDir: resolve(root, config.runsDir) });
const response = await app.request('/digest/2026-10-28', { method: 'GET' });
if (response.status !== 200 || !response.headers.get('content-type')?.startsWith('text/html')) {
  throw new Error(`Digest export expected HTML with status 200; received ${response.status}.`);
}

// Preserve the actual server-rendered document, including its inline CSS and lane banner.
// Exclusive creation also refuses existing files/symlinks rather than overwriting other work.
await writeFile(destination, await response.text(), { encoding: 'utf8', flag: 'wx' });
console.log(`Exported /digest/2026-10-28 to ${destination}`);
