/**
 * AI provider registry.
 *
 * The app talks to one of several APIs. They differ in request shape, auth
 * header, and where the generated text sits in the response, so each provider
 * supplies those three things and the rest of the app stays provider-agnostic.
 *
 * On the deliberate omission of OpenAI / ChatGPT: it has no sustainable free
 * API tier. The consumer ChatGPT app and the API are separate products with
 * separate billing, and a free ChatGPT account grants zero API credits. The one
 * genuinely free OpenAI option requires opting in to sharing your API traffic
 * for model training, which is the wrong direction for an app headed toward
 * patient data. Adding it would mean a second paid provider with no capability
 * Claude does not already cover — so it is left out until there is a reason.
 */

export type ProviderId = 'gemini' | 'anthropic';

export interface ProviderModel {
  id: string;
  label: string;
  note?: string;
}

export interface BuildRequestArgs {
  apiKey: string;
  model: string;
  system: string;
  userContent: string;
  schema: Record<string, unknown>;
  /** Provider-specific hint for how hard to think. Ignored where unsupported. */
  effort: 'low' | 'medium' | 'high';
  maxTokens: number;
}

export interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface AiProvider {
  id: ProviderId;
  label: string;
  /** True when the provider has a usable free tier with no card required. */
  free: boolean;
  blurb: string;
  /** Where to get a key. Shown in Settings. */
  keyUrl: string;
  keyUrlLabel: string;
  /** Expected key prefix, used only for a soft warning. */
  keyPrefix: string;
  /** How to describe this provider's data handling. Shown in Settings. */
  privacyNote: string;
  models: ProviderModel[];
  defaultModel: string;
  buildRequest: (args: BuildRequestArgs) => BuiltRequest;
  /** Pull the generated text out of a successful response body. */
  extractText: (body: any) => string | null;
  /** Pull a useful message out of an error body. */
  extractError: (body: any) => string | null;
}

/* ------------------------------------------------------------------ *
 * Google Gemini
 * ------------------------------------------------------------------ */

const gemini: AiProvider = {
  id: 'gemini',
  label: 'Google Gemini',
  free: true,
  blurb: 'Free tier, no credit card. The one to start with.',
  keyUrl: 'https://aistudio.google.com/apikey',
  keyUrlLabel: 'aistudio.google.com/apikey',
  keyPrefix: 'AIza',
  privacyNote:
    "On the free tier Google's terms say your submitted content is used to improve their products and may be seen by human reviewers, and tell you not to submit personal information. That is fine for fake patients and disqualifying for real ones.",
  models: [
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', note: 'Recommended. Current free-tier default.' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    {
      id: 'gemini-3.5-flash-lite',
      label: 'Gemini 3.5 Flash-Lite',
      note: 'Highest free daily limits. Weaker on sparse notes.',
    },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
  ],
  defaultModel: 'gemini-3.6-flash',

  buildRequest: ({ apiKey, model, system, userContent, schema }) => ({
    url: 'https://generativelanguage.googleapis.com/v1beta/interactions',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: {
      model,
      system_instruction: system,
      input: userContent,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema,
      },
    },
  }),

  // Read defensively. Google has more than one response shape in circulation
  // (the Interactions API's `steps`, the older generateContent `candidates`),
  // and guessing wrong means a working request that looks like a failure.
  extractText: (body: any) => {
    if (typeof body?.output_text === 'string' && body.output_text.trim()) {
      return body.output_text;
    }

    const steps = Array.isArray(body?.steps) ? body.steps : [];
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      const content = steps[i]?.content;
      if (!Array.isArray(content)) continue;
      const text = content
        .map((c: any) => (typeof c?.text === 'string' ? c.text : ''))
        .join('')
        .trim();
      if (text) return text;
    }

    const legacy = body?.candidates?.[0]?.content?.parts
      ?.map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim();
    return legacy || null;
  },

  extractError: (body: any) =>
    body?.error?.message ?? (typeof body?.message === 'string' ? body.message : null),
};

/* ------------------------------------------------------------------ *
 * Anthropic Claude
 * ------------------------------------------------------------------ */

const anthropic: AiProvider = {
  id: 'anthropic',
  label: 'Anthropic Claude',
  free: false,
  blurb: 'Paid only — no free tier. Strongest on terse, fragmentary field notes.',
  keyUrl: 'https://console.anthropic.com/settings/keys',
  keyUrlLabel: 'console.anthropic.com',
  keyPrefix: 'sk-ant-',
  privacyNote:
    'Paid API. Anthropic does not train on API inputs by default. Real patient information still requires a signed BAA and a HIPAA-eligible configuration first.',
  models: [
    { id: 'claude-opus-5', label: 'Claude Opus 5', note: 'Highest quality on sparse notes.' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Near-Opus, faster and cheaper.' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'Cheapest. Fine for clean notes.' },
  ],
  defaultModel: 'claude-opus-5',

  buildRequest: ({ apiKey, model, system, userContent, schema, effort, maxTokens }) => ({
    url: 'https://api.anthropic.com/v1/messages',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model,
      max_tokens: maxTokens,
      system,
      output_config: {
        effort,
        format: { type: 'json_schema', schema },
      },
      messages: [{ role: 'user', content: userContent }],
    },
  }),

  extractText: (body: any) => {
    // A safety refusal returns HTTP 200 with empty content, so this is checked
    // by the caller before extraction; here we only read text blocks.
    const text = body?.content?.find((b: any) => b?.type === 'text')?.text;
    return typeof text === 'string' && text.trim() ? text : null;
  },

  extractError: (body: any) => body?.error?.message ?? null,
};

export const PROVIDERS: AiProvider[] = [gemini, anthropic];

export const DEFAULT_PROVIDER_ID: ProviderId = 'gemini';

export function getProvider(id: ProviderId): AiProvider {
  return PROVIDERS.find((p) => p.id === id) ?? gemini;
}

/** The provider + model the app should use for a request. */
export interface AiConfig {
  providerId: ProviderId;
  model: string;
}
