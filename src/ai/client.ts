import { Platform } from 'react-native';

import { getApiKey } from '@/storage/secure';

/**
 * Minimal Claude Messages API client.
 *
 * Phase 1 calls api.anthropic.com directly from the device using a key the user
 * pastes into Settings. That is acceptable for a personal test build with fake
 * data and is NOT acceptable for real PHI — see docs/SECURITY-PHI.md for the
 * server-proxy + BAA path that has to be in place first.
 *
 * The API key lives in the keystore and is read per-request; it is never held
 * in Redux/zustand state, never logged, and never written to a report.
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export class MissingApiKeyError extends Error {
  constructor() {
    super('No Claude API key is set. Add one in Settings → Claude API.');
    this.name = 'MissingApiKeyError';
  }
}

export class ClaudeApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ClaudeApiError';
    this.status = status;
  }
}

/** Turn any failure into something a user standing in an ambulance bay can act on. */
export function describeError(error: unknown): string {
  if (error instanceof MissingApiKeyError) return error.message;
  if (error instanceof ClaudeApiError) {
    switch (error.status) {
      case 401:
        return 'That API key was rejected. Check it in Settings → Claude API.';
      case 403:
        return 'This API key does not have access to the selected model.';
      case 404:
        return 'The selected model was not found. Pick a different one in Settings.';
      case 429:
        return 'Rate limited by the API. Wait a moment and try again.';
      case 529:
        return 'The API is temporarily overloaded. Try again in a moment.';
      default:
        return error.status >= 500
          ? 'The API had a server error. Your notes are saved — try again.'
          : error.message;
    }
  }
  if (error instanceof Error && /Network request failed/i.test(error.message)) {
    return 'No network connection. Your notes are saved on this device; generate when you have signal.';
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

interface JsonRequest {
  model: string;
  system: string;
  userContent: string;
  /** JSON Schema the response must conform to. */
  schema: Record<string, unknown>;
  /** Lower effort for cheap classification-style calls. */
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  signal?: AbortSignal;
}

interface ClaudeResponse {
  content: { type: string; text?: string }[];
  stop_reason: string;
  stop_details?: { category?: string | null; explanation?: string } | null;
}

/**
 * One structured-output request. Every AI feature in this app goes through
 * here, so there is exactly one place that talks to the network.
 */
export async function requestJson<T>({
  model,
  system,
  userContent,
  schema,
  effort = 'medium',
  maxTokens = 16000,
  signal,
}: JsonRequest): Promise<T> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new MissingApiKeyError();

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': API_VERSION,
  };
  // Expo web is a development convenience only; the browser fetch needs this
  // header to talk to the API at all. Native builds do not send it.
  if (Platform.OS === 'web') headers['anthropic-dangerous-direct-browser-access'] = 'true';

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      output_config: {
        effort,
        format: { type: 'json_schema', schema },
      },
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      // Non-JSON error body; the status-based message above is good enough.
    }
    throw new ClaudeApiError(response.status, message);
  }

  const body = (await response.json()) as ClaudeResponse;

  // A safety refusal returns HTTP 200 with an empty or partial content array,
  // so stop_reason has to be checked before reading content.
  if (body.stop_reason === 'refusal') {
    throw new ClaudeApiError(
      200,
      'The model declined to process this input. Check that the notes describe a patient encounter and contain nothing off-topic.',
    );
  }
  if (body.stop_reason === 'max_tokens') {
    throw new ClaudeApiError(200, 'The response was cut off. Try shortening the notes.');
  }

  const text = body.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new ClaudeApiError(200, 'The API returned an empty response.');

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ClaudeApiError(200, 'The API returned a response that could not be read.');
  }
}
