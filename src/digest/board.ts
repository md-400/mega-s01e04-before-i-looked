import { nightsOnDisk } from '../status.js';
import { readNight } from './reader.js';
import type { DigestNight } from './types.js';

export type BoardNight = {
  night: string;
  counts: DigestNight['counts'] | null;
};

/** Reuse the digest reader's event counts, never infer counts from job rows. */
export async function readBoardNights(runsDir: string): Promise<BoardNight[]> {
  return Promise.all(nightsOnDisk(runsDir).map(async (night) => ({
    night,
    // A file can disappear between listing the directory and reading it.
    counts: (await readNight(runsDir, night))?.counts ?? null,
  })));
}
