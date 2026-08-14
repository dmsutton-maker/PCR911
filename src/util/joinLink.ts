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
 * Two kinds of link. An **invite** carries an invite code: opening it asks who
 * you are and issues you your own account, so what ends up on the phone is
 * personal and revocable. A **squad-code** link carries a shared credential
 * directly, which is what relays did before accounts existed.
 *
 * Either way, anyone holding the link can use it until it is rotated — send one
 * the way you would send a password. The difference is what happens next: an
 * invite turns into an identity an admin can withdraw from one person, while a
 * shared code can only be changed for everybody at once.
 */

export interface JoinPayload {
  relayUrl: string;
  /** An invite code, when the link is an invitation to join an org as a person. */
  inviteCode?: string;
  /** A shared squad code, for relays that predate org accounts. */
  code?: string;
  /** An already-issued member token, for signing an existing account in. */
  token?: string;
}

export function buildJoinLink(baseUrl: string, payload: JoinPayload): string {
  const base = baseUrl.replace(/#.*$/, '');
  const params = new URLSearchParams({ join: '1', u: payload.relayUrl });
  if (payload.inviteCode) params.set('i', payload.inviteCode);
  if (payload.code) params.set('c', payload.code);
  if (payload.token) params.set('t', payload.token);
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
  const inviteCode = (params.get('i') || '').trim();
  const code = (params.get('c') || '').trim();
  const token = (params.get('t') || '').trim();
  if (!relayUrl || (!inviteCode && !code && !token)) return null;

  return {
    relayUrl,
    inviteCode: inviteCode || undefined,
    code: code || undefined,
    token: token || undefined,
  };
}
