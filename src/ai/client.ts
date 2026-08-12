import { Platform } from 'react-native';

import {
  type ConnectionMode,
  NotConfiguredError,
  relayEndpoint,
  resolveConnection,
} from './connection';
import { type AiConfig, getProvider } from './providers';

/**
 * The one place in the app that talks to a network.
 *
 * Which API it talks to depends on the provider chosen in Settings, and *how*
 * it gets there depends on the connection mode: straight to the provider with
 * the user's own key, or through a squad relay that holds the key on the
 * server. Everything provider-specific lives in providers.ts; everything about
 * which route to take lives in connection.ts.
 *
 * Neither route is PHI-capable on its own — see docs/SECURITY-PHI.md.
 */

export class AiApiError extends Error {
  readonly status: number;
  /** Which route produced this, since the same status means different things. */
  readonly via: ConnectionMode;
  constructor(status: number, message: string, via: ConnectionMode = 'own_key') {
    super(message);
    this.name = 'AiApiError';
    this.status = status;
    this.via = via;
  }
}

/** Turn any failure into something a user standing in an ambulance bay can act on. */
export function describeError(error: unknown): string {
  if (error instanceof NotConfiguredError) return error.message;
  if (error instanceof AiApiError) {
    const viaRelay = error.via === 'relay';
    switch (error.status) {
      case 400:
        return `The request was rejected: ${error.message}`;
      case 401:
      case 403:
        return viaRelay
          ? 'That squad code was not accepted. Check it in Settings → AI provider, or ask whoever set this up whether it changed.'
          : 'That API key was rejected. Check it in Settings → AI provider.';
      case 404:
        return 'That model name was not found. Pick a different model in Settings → AI provider.';
      case 413:
        return 'Those notes are too long to send. Shorten them and try again.';
      case 429:
        return viaRelay
          ? "The squad's daily limit or the provider's rate limit was reached. Wait a minute and try again."
          : 'Rate limit or free-tier quota reached. Wait a minute and try again, or switch model.';
      case 502:
        return 'The squad relay could not reach the AI provider. Try again in a moment.';
      case 503:
        return viaRelay
          ? `The squad relay is not fully set up: ${error.message}`
          : error.message;
      case 529:
        return 'The API is temporarily overloaded. Try again in a moment.';
      default:
        return error.status >= 500
          ? 'The API had a server error. Your notes are saved — try again.'
          : error.message;
    }
  }
  if (error instanceof Error && /Network request failed|Failed to fetch/i.test(error.message)) {
    return 'No network connection. Your notes are saved on this device; generate when you have signal.';
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

/** Some models wrap JSON in a markdown fence despite being asked not to. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

interface JsonRequest {
  config: AiConfig;
  system: string;
  userContent: string;
  schema: Record<string, unknown>;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  signal?: AbortSignal;
}

export async function requestJson<T>({
  config,
  system,
  userContent,
  schema,
  effort = 'medium',
  maxTokens = 16000,
  signal,
}: JsonRequest): Promise<T> {
  const provider = getProvider(config.providerId);
  const connection = await resolveConnection(provider.id);

  const providerBody = provider.buildBody({
    model: config.model || provider.defaultModel,
    system,
    userContent,
    schema,
    effort,
    maxTokens,
  });

  let url: string;
  let headers: Record<string, string>;
  let payload: unknown;

  if (connection.mode === 'relay') {
    url = relayEndpoint(connection.relayUrl, '/v1/generate');
    headers = { 'content-type': 'application/json', 'x-squad-code': connection.code };
    // The relay chooses the destination and supplies the key from its own
    // table; the phone sends only which provider and what to ask it.
    payload = { providerId: provider.id, body: providerBody };
  } else {
    url = provider.url;
    headers = { 'content-type': 'application/json', ...provider.authHeaders(connection.apiKey) };
    // Anthropic requires an explicit opt-in for browser-originated requests.
    // Only needed on the direct route — through the relay the call is
    // server-to-server and this header would be meaningless.
    if (Platform.OS === 'web' && provider.id === 'anthropic') {
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    payload = providerBody;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const errorBody = await response.json();
      // The relay deliberately mirrors the providers' `{ error: { message } }`
      // shape, so one extractor reads both.
      message = provider.extractError(errorBody) ?? message;
    } catch {
      // Non-JSON error body; the status-based message is good enough.
    }
    throw new AiApiError(response.status, message, connection.mode);
  }

  const body = await response.json();

  // Anthropic returns HTTP 200 with an empty body on a safety refusal, so
  // stop_reason has to be checked before reading content.
  if (body?.stop_reason === 'refusal') {
    throw new AiApiError(
      200,
      'The model declined to process this input. Check that the notes describe a patient encounter and contain nothing off-topic.',
    );
  }
  if (body?.stop_reason === 'max_tokens') {
    throw new AiApiError(200, 'The response was cut off. Try shortening the notes.');
  }

  const text = provider.extractText(body);
  if (!text) throw new AiApiError(200, 'The API returned an empty response.');

  try {
    return JSON.parse(stripCodeFence(text)) as T;
  } catch {
    throw new AiApiError(200, 'The API returned a response that could not be read.');
  }
}
