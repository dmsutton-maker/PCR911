import { Platform } from 'react-native';

import { getApiKey } from '@/storage/secure';
import { type AiConfig, getProvider, type ProviderId } from './providers';

/**
 * The one place in the app that talks to a network.
 *
 * Which API it talks to depends on the provider the user chose in Settings;
 * everything provider-specific lives in providers.ts. Keys are read from the
 * keystore per request and never held in app state or written to a report.
 *
 * Phase 1 calls the provider directly from the device. That is fine for
 * practice data and is not acceptable for PHI — see docs/SECURITY-PHI.md.
 */

export class MissingApiKeyError extends Error {
  readonly providerId: ProviderId;
  constructor(providerId: ProviderId) {
    super(`No API key is set for ${getProvider(providerId).label}. Add one in Settings → AI provider.`);
    this.name = 'MissingApiKeyError';
    this.providerId = providerId;
  }
}

export class AiApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AiApiError';
    this.status = status;
  }
}

/** Turn any failure into something a user standing in an ambulance bay can act on. */
export function describeError(error: unknown): string {
  if (error instanceof MissingApiKeyError) return error.message;
  if (error instanceof AiApiError) {
    switch (error.status) {
      case 400:
        return `The request was rejected: ${error.message}`;
      case 401:
      case 403:
        return 'That API key was rejected. Check it in Settings → AI provider.';
      case 404:
        return 'That model name was not found. Pick a different model in Settings → AI provider.';
      case 429:
        return 'Rate limit or free-tier quota reached. Wait a minute and try again, or switch model.';
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

  const apiKey = await getApiKey(provider.id);
  if (!apiKey) throw new MissingApiKeyError(provider.id);

  const built = provider.buildRequest({
    apiKey,
    model: config.model || provider.defaultModel,
    system,
    userContent,
    schema,
    effort,
    maxTokens,
  });

  const headers = { ...built.headers };
  // Anthropic requires an explicit opt-in for browser-originated requests.
  if (Platform.OS === 'web' && provider.id === 'anthropic') {
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  const response = await fetch(built.url, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify(built.body),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const errorBody = await response.json();
      message = provider.extractError(errorBody) ?? message;
    } catch {
      // Non-JSON error body; the status-based message is good enough.
    }
    throw new AiApiError(response.status, message);
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
