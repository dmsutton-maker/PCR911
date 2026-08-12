import { getAccessCode, getApiKey } from '@/storage/secure';
import { useSettings } from '@/state/settingsStore';
import type { ProviderId } from './providers';

/**
 * How this phone reaches the AI provider.
 *
 * Two modes, and the difference is who holds the key:
 *
 *   relay    — the request goes to a small server the squad lead runs, which
 *              holds one provider key and authenticates callers with a squad
 *              code. Nobody on the crew ever obtains, sees, or stores a
 *              provider key. This is the mode to share with other people, and
 *              the only mode that could ever be part of a PHI-capable setup,
 *              because a key on a server can be rotated and revoked and a key
 *              on someone's phone cannot.
 *
 *   own_key  — the phone talks to the provider directly with a key the user
 *              pasted into Settings. Fine for one person evaluating the app,
 *              unworkable as soon as there is a second person.
 */

export type ConnectionMode = 'relay' | 'own_key';

export interface RelayConnection {
  mode: 'relay';
  relayUrl: string;
  code: string;
}

export interface DirectConnection {
  mode: 'own_key';
  apiKey: string;
}

export type Connection = RelayConnection | DirectConnection;

/** Raised when neither a squad code nor a personal key is available. */
export class NotConfiguredError extends Error {
  readonly mode: ConnectionMode;
  constructor(mode: ConnectionMode, message: string) {
    super(message);
    this.name = 'NotConfiguredError';
    this.mode = mode;
  }
}

/**
 * Accept whatever someone pastes. People paste trailing slashes, the full
 * endpoint path, and addresses with the scheme missing; none of those are worth
 * an error message.
 */
export function normalizeRelayUrl(input: string): string {
  let value = input.trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  value = value.replace(/\/+$/, '');
  value = value.replace(/\/v1\/(generate|health)$/i, '');
  return value;
}

export function relayEndpoint(relayUrl: string, path: string): string {
  return `${normalizeRelayUrl(relayUrl)}${path}`;
}

/** What the app should use for the next request, read fresh each time. */
export async function resolveConnection(providerId: ProviderId): Promise<Connection> {
  const { connectionMode, relayUrl } = useSettings.getState();

  if (connectionMode === 'relay') {
    const url = normalizeRelayUrl(relayUrl);
    if (!url) {
      throw new NotConfiguredError(
        'relay',
        'No squad relay address is set. Add it in Settings → AI provider, or switch to using your own API key.',
      );
    }
    const code = (await getAccessCode()) ?? '';
    if (!code) {
      throw new NotConfiguredError(
        'relay',
        'No squad code is set. Add the code you were given in Settings → AI provider.',
      );
    }
    return { mode: 'relay', relayUrl: url, code };
  }

  const apiKey = await getApiKey(providerId);
  if (!apiKey) {
    throw new NotConfiguredError(
      'own_key',
      'No API key is set. Add one in Settings → AI provider, or switch to a squad relay.',
    );
  }
  return { mode: 'own_key', apiKey };
}

/** Whether generation would work right now, for banners and settings rows. */
export async function isConfigured(providerId: ProviderId): Promise<boolean> {
  try {
    await resolveConnection(providerId);
    return true;
  } catch {
    return false;
  }
}

/** One line describing the current connection, for a settings row. */
export function describeConnection(mode: ConnectionMode, configured: boolean | null): string {
  if (configured === null) return 'Checking…';
  if (mode === 'relay') return configured ? 'Squad account · connected' : 'Squad account · not connected';
  return configured ? 'Your own key · set' : 'No key set — tap to add';
}

export interface RelayHealth {
  ok: boolean;
  /** Provider ids the relay actually has a key for. */
  providers: string[];
  error?: string;
}

/**
 * Confirm an address is a relay before the user discovers otherwise mid-call.
 * Reports which providers have keys, so Settings can say "this relay has no
 * Claude key" rather than letting generation fail with a 503 later.
 */
export async function checkRelay(relayUrl: string): Promise<RelayHealth> {
  const url = normalizeRelayUrl(relayUrl);
  if (!url) return { ok: false, providers: [], error: 'Enter the relay address first.' };

  try {
    const response = await fetch(`${url}/v1/health`, { method: 'GET' });
    if (!response.ok) {
      return { ok: false, providers: [], error: `The address answered with ${response.status}.` };
    }
    const body = await response.json();
    if (body?.service !== 'pcr-relay') {
      return { ok: false, providers: [], error: 'That address answered, but it is not a PCR relay.' };
    }
    return { ok: true, providers: Array.isArray(body.providers) ? body.providers : [] };
  } catch {
    return { ok: false, providers: [], error: 'Could not reach that address.' };
  }
}
