import { type JoinPayload } from './joinLink';

/**
 * Native side of invite links.
 *
 * The installed app has no custom URL scheme registered, so it cannot receive
 * an invite link — a squad lead running the native build sets the relay up by
 * hand in Settings. It can still *generate* links for everyone else, which is
 * the direction that matters, so the hosted web address is hardcoded here.
 */

export const PUBLIC_APP_URL = 'https://dmsutton-maker.github.io/PCR911/';

export function getAppBaseUrl(): string {
  return PUBLIC_APP_URL;
}

export function readJoinLink(): JoinPayload | null {
  return null;
}

export function clearJoinLink(): void {
  // Nothing to clear: there is no address bar.
}
