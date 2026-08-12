/**
 * Invite links.
 *
 * The point of the relay is that a crew member should not have to obtain an API
 * key, so it would be self-defeating to make them type a server address and a
 * squad code by hand. An invite link carries both: they open it, confirm, and
 * the app is configured.
 *
 * The payload rides in the URL **fragment**, not the query string. Fragments
 * are not sent to the server, so the squad code stays out of GitHub Pages'
 * request logs and out of any proxy in between.
 *
 * Worth being clear-eyed about what this is: anyone holding the link holds the
 * code. It is a shared credential distributed over whatever channel you send it
 * on, which is why the relay lets you list several codes and revoke one without
 * disturbing the others. It is not a per-person identity and should not be
 * mistaken for one.
 */

export interface JoinPayload {
  relayUrl: string;
  code: string;
}

export function buildJoinLink(baseUrl: string, payload: JoinPayload): string {
  const base = baseUrl.replace(/#.*$/, '');
  const params = new URLSearchParams({
    join: '1',
    u: payload.relayUrl,
    c: payload.code,
  });
  return `${base}#${params.toString()}`;
}

/** Accepts a raw `location.hash`, with or without the leading `#`. */
export function parseJoinHash(hash: string): JoinPayload | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }
  if (params.get('join') !== '1') return null;

  const relayUrl = (params.get('u') || '').trim();
  const code = (params.get('c') || '').trim();
  if (!relayUrl || !code) return null;

  return { relayUrl, code };
}
