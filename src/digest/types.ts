export type DigestStatus = 'ok' | 'retry' | 'fail';

/** One job's valid log entries, aggregated in file order. */
export type DigestRow = {
  job: string;
  /** Owner from the job's last entry; null is displayed as —. */
  owner: string | null;
  /** Number of valid entries for this job, including retries and failures. */
  runs: number;
  /** Number of entries whose status is retry. */
  retries: number;
  lastStatus: DigestStatus;
  /** Most recent provided error, or null when no entry provided one. */
  lastError: string | null;
  /** Original timestamp strings from the first and last entries; keep offsets. */
  firstAt: string;
  lastAt: string;
  /** True if any entry failed, even if the job later recovered. */
  anyFailure: boolean;
};

export type DigestNight = {
  /** One row per job, sorted by job ascending for both HTML and JSON. */
  rows: DigestRow[];
  /** Nonblank lines rejected as invalid JSON or invalid log entries. */
  badLines: number;
  /** Valid log entry counts by status, not counts of aggregated jobs. */
  counts: { ok: number; retry: number; fail: number };
};

/**
 * Read runsDir/<night>.jsonl, where night is YYYY-MM-DD.
 * Missing file: null. Empty file: empty rows, zero badLines and zero counts.
 * Malformed lines are counted and skipped, never fatal; blank lines are ignored.
 * Other filesystem errors reject the promise rather than masquerading as missing.
 * This is a type only: import the actual readNight function from reader.ts.
 */
export type ReadNight = (
  runsDir: string,
  night: string,
) => Promise<DigestNight | null>;
