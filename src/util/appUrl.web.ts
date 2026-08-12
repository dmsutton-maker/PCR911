import { type JoinPayload, parseJoinHash } from './joinLink';

/**
 * Web side of invite links. Metro picks this file over appUrl.ts for web.
 */

export const PUBLIC_APP_URL = 'https://dmsutton-maker.github.io/PCR911/';

export function getAppBaseUrl(): string {
  try {
    if (typeof location === 'undefined') return PUBLIC_APP_URL;
    return `${location.origin}${location.pathname}`;
  } catch {
    return PUBLIC_APP_URL;
  }
}

/** The invite payload, if this page was opened from an invite link. */
export function readJoinLink(): JoinPayload | null {
  try {
    if (typeof location === 'undefined') return null;

    return parseJoinHash(location.hash || '');
  } catch {
    return null;
  }
}

/**
 * Remove the invite payload from the address bar.
 *
 * This matters for more than tidiness: left in place, the squad code sits in
 * the address bar, in the browser's history, and in whatever the user's next
 * screenshot happens to capture. `replaceState` also avoids adding a history
 * entry, so Back does not walk them into a re-import loop.
 *
 * On its own this is not enough: expo-router holds the initial URL in its own
 * state and writes it back on every sync, so an external strip is undone within
 * a frame. The caller replaces the route first, which fixes the router's copy,
 * and then calls this to clear anything the router left behind. It is a no-op
 * once the fragment is gone.
 */
export function clearJoinLink(): void {
  try {
    if (typeof location === 'undefined' || typeof history === 'undefined') return;
    if (typeof history.replaceState !== 'function') return;
    if (!parseJoinHash(location.hash || '')) return;
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  } catch {
    // A browser that refuses replaceState leaves the fragment visible. Nothing
    // more to do about it here, and it must not stop the invite being applied.
  }
}
