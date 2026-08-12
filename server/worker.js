/**
 * PCR Narrative relay.
 *
 * A Cloudflare Worker that sits between the app and the AI provider so that the
 * provider API key lives on a server the squad lead controls instead of on
 * every member's phone. Members authenticate with a squad code; they never see,
 * hold, or need a provider key.
 *
 * This exists for two reasons, and the second one matters more:
 *
 *   1. Distribution. Handing someone a link beats walking them through creating
 *      a Google Cloud account.
 *   2. Control. A key on a phone cannot be rotated, scoped per user, audited, or
 *      revoked when the phone is lost. A key here can. That is a precondition
 *      for ever putting real patient information through this app — see
 *      docs/SECURITY-PHI.md. This relay is necessary for that, not sufficient:
 *      a signed BAA and a HIPAA-eligible provider configuration are still
 *      required, and both are business steps rather than code.
 *
 * Deliberately not a general-purpose proxy. The caller supplies a provider id
 * and a request body; the destination URL and auth headers are chosen here from
 * a fixed table. There is no code path that lets a caller pick the host.
 *
 * Setup lives in server/README.md.
 */

const PROVIDERS = {
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/interactions',
    secret: 'GEMINI_API_KEY',
    authHeaders: (key) => ({ 'x-goog-api-key': key }),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    secret: 'ANTHROPIC_API_KEY',
    authHeaders: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
  },
};

/** Generous enough for long notes, small enough that nobody can post a video. */
const MAX_BODY_BYTES = 256 * 1024;

const DEFAULT_DAILY_LIMIT = 300;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Compare without leaking length or position through timing. Squad codes are
 * long random strings, so this is belt-and-braces, but a relay whose only guard
 * is a string comparison should not do that comparison carelessly.
 */
function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = parseList(env.ALLOWED_ORIGINS);

  // With no allowlist configured, echo the caller's origin. The squad code is
  // the actual access control here — CORS only decides which page may read the
  // response, and a browser-origin allowlist stops nothing that curl can do.
  // Setting ALLOWED_ORIGINS is still worthwhile: it keeps a stolen code from
  // being usable from someone else's copy of the web app.
  const allowOrigin = allowed.length === 0 ? origin || '*' : allowed.includes(origin) ? origin : '';

  const headers = {
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'content-type, x-squad-code',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
  if (allowOrigin) headers['access-control-allow-origin'] = allowOrigin;
  return headers;
}

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(request, env) },
  });
}

/**
 * Error shape matches what the providers themselves return, so the app's
 * existing error extraction reads relay errors and upstream errors identically.
 */
function fail(status, message, request, env) {
  return json({ error: { message } }, status, request, env);
}

/**
 * Per-code daily cap, enforced only when a KV namespace is bound.
 *
 * Optional on purpose: requiring a KV namespace would add a setup step for
 * someone who is not a developer, and the relay is useful without it. Bind
 * RATE_LIMIT to turn it on.
 */
async function overDailyLimit(env, code) {
  if (!env.RATE_LIMIT) return false;

  const limit = Number(env.DAILY_LIMIT || DEFAULT_DAILY_LIMIT);
  if (!Number.isFinite(limit) || limit <= 0) return false;

  const day = new Date().toISOString().slice(0, 10);
  // Never store the code itself — a KV listing should not hand out credentials.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  const id = [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  const key = `count:${id}:${day}`;

  const used = Number((await env.RATE_LIMIT.get(key)) || 0);
  if (used >= limit) return true;

  // Not atomic. Two requests landing in the same millisecond can both read the
  // same count, so the cap is approximate — which is fine for a quota guard
  // whose job is stopping runaway use, not exact accounting.
  await env.RATE_LIMIT.put(key, String(used + 1), { expirationTtl: 60 * 60 * 36 });
  return false;
}

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    // Lets the app confirm a pasted relay URL is really a relay, and report
    // which providers actually have a key configured, before anyone tries to
    // generate a narrative and gets a confusing failure.
    if (url.pathname === '/v1/health') {
      const configured = Object.entries(PROVIDERS)
        .filter(([, p]) => !!env[p.secret])
        .map(([id]) => id);
      return json({ ok: true, service: 'pcr-relay', providers: configured }, 200, request, env);
    }

    if (url.pathname !== '/v1/generate') {
      return fail(404, 'Not found. The relay URL should be the base address only.', request, env);
    }
    if (request.method !== 'POST') {
      return fail(405, 'Method not allowed.', request, env);
    }

    const codes = parseList(env.ACCESS_CODES);
    if (codes.length === 0) {
      return fail(
        503,
        'This relay has no squad codes configured yet. Set the ACCESS_CODES secret.',
        request,
        env,
      );
    }

    const presented = request.headers.get('x-squad-code') || '';
    if (!presented || !codes.some((c) => safeEqual(c, presented))) {
      return fail(401, 'That squad code was not recognised.', request, env);
    }

    if (await overDailyLimit(env, presented)) {
      return fail(429, "This squad code has hit today's request limit.", request, env);
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return fail(413, 'Those notes are too long to send.', request, env);
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return fail(400, 'Malformed request.', request, env);
    }

    const provider = PROVIDERS[payload?.providerId];
    if (!provider) {
      return fail(400, `Unknown provider "${payload?.providerId}".`, request, env);
    }
    if (!payload?.body || typeof payload.body !== 'object') {
      return fail(400, 'Missing request body.', request, env);
    }

    const apiKey = env[provider.secret];
    if (!apiKey) {
      return fail(
        503,
        `This relay has no ${payload.providerId} key configured. Set the ${provider.secret} secret.`,
        request,
        env,
      );
    }

    let upstream;
    try {
      upstream = await fetch(provider.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...provider.authHeaders(apiKey) },
        body: JSON.stringify(payload.body),
      });
    } catch {
      return fail(502, 'The relay could not reach the AI provider.', request, env);
    }

    // Pass the provider's response through untouched. The app already knows how
    // to read every provider's success and error shapes, and re-wrapping them
    // here would mean maintaining that knowledge twice.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        ...corsHeaders(request, env),
      },
    });
  },
};
