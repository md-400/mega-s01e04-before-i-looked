import type { DigestNight } from '../digest/types.js';

export function Digest({ night, digest }: { night: string; digest: DigestNight }) {
  const rows = digest.rows.toSorted((a, b) => a.job.localeCompare(b.job));

  return (
    <>
      <h1>digest · {night}</h1>
      <p>
        ok: {digest.counts.ok} · retry: {digest.counts.retry} · fail: {digest.counts.fail}
      </p>
      <p class={digest.badLines > 0 ? 'warn' : 'mute'}>bad lines: {digest.badLines}</p>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">job</th>
              <th scope="col">owner</th>
              <th scope="col">runs</th>
              <th scope="col">retries</th>
              <th scope="col">last status</th>
              <th scope="col">last error</th>
              <th scope="col">first time</th>
              <th scope="col">last time</th>
              <th scope="col">any failure</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
                <td class={row.lastStatus === 'fail' ? 'warn' : undefined}>{row.lastStatus}</td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
                <td class={row.anyFailure ? 'warn' : undefined}>{row.anyFailure ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
