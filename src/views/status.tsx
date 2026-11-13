import type { Status } from '../status.js';
import type { BoardNight } from '../digest/board.js';

export function StatusBoard({ status, nights }: { status: Status; nights?: BoardNight[] }) {
  const boardNights = nights ?? status.nights.map((night) => ({ night, counts: null }));
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {boardNights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {boardNights.map(({ night, counts }) => (
            <li>
              <a href={`/digest/${night}`}>{night}</a>
              {' · '}ok {counts?.ok ?? '—'} / retry {counts?.retry ?? '—'} / fail {counts?.fail ?? '—'}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
