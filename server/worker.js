/**
 * PCR Narrative relay and org directory.
 *
 * Started as a proxy that held one API key so nobody's phone had to. It now
 * also does the thing a shared squad code could never do: tell people apart.
 *
 * The distinction matters. A shared code says "somebody who has the code". It
 * cannot say who, cannot be withdrawn from one person without changing it for
 * everyone, and cannot answer "who generated this narrative and when" — which
 * is the question a compliance conversation opens with. Per-person tokens, a
 * roster an admin can revoke from, and an audit trail are what make this an app
 * for a squad rather than for one person.
 *
 * What this deliberately does NOT do: store reports, narratives, or notes.
 * Those stay on the phone that made them. Keeping patient content off the
 * server means the server holds names and usage counts, which is a far smaller
 * thing to protect and a far smaller thing to lose. Requests pass through in
 * memory to the provider and nothing about their content is written down.
 *
 * Storage is a single KV namespace, keyed as:
 *
 *   org:<orgId>              org record, including the config members receive
 *   invite:<code>            invite code → org and the role it grants
 *   tok:<sha256(token)>      token → { orgId, memberId }; the token itself is
 *                            never stored, so a dump of KV grants nobody access
 *   mem:<orgId>:<memberId>   member record (name, role, status, usage)
 *   aud:<orgId>:<ts>:<rand>  audit entries, newest sorting last
 *   plan:<orgId>             the squad's plan for shared boards (see boardPlan)
 *
 * Setup is in server/README.md.
 *
 * It also hosts the scene command board's shared boards (prototypes/scene-command):
 * one Durable Object per squad, holding a small document store that tablets
 * read and write over a WebSocket at /v1/board. That is incident and shift
 * data the squad chose to share between its own tablets, kept apart from the
 * KV namespace above.
 */

import { DurableObject } from 'cloudflare:workers';

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

const MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_DAILY_LIMIT = 300;
const AUDIT_TTL_DAYS = 90;

/** Endpoints that require a personal account rather than a shared squad code. */
const ACCOUNT_ROUTES = new Set([
  '/v1/me',
  '/v1/org/config',
  '/v1/members',
  '/v1/members/status',
  '/v1/invites',
  '/v1/guest-invites',
  '/v1/audit',
]);

/* Guests: another department (fire, police) working an MCI or event with the squad. A guest invite is for one
   agency and runs out; a guest device can reach only the incident and event boards, never the squad's daily
   calls, its roster or its settings. */
const GUEST_AGENCIES = ['fire', 'police'];
const GUEST_HOURS = [12, 24, 72, 168];
const GUEST_PATHS = /^(now\/incident|now\/event|mci(\/.*)?|evts(\/.*)?)$/;
const guestPathOk = (path) => GUEST_PATHS.test(path);

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

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

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/** URL-safe, no ambiguity between similar glyphs — these get read aloud. */
function randomCode(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = parseList(env.ALLOWED_ORIGINS);
  const allowOrigin = allowed.length === 0 ? origin || '*' : allowed.includes(origin) ? origin : '';

  const headers = {
    'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization, x-squad-code, x-bootstrap-code',
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

/** Error shape matches the AI providers', so one extractor in the app reads both. */
function fail(status, message, request, env) {
  return json({ error: { message } }, status, request, env);
}

function kv(env) {
  return env.ORG_DATA ?? null;
}

/* ------------------------------------------------------------------ *
 * Identity
 * ------------------------------------------------------------------ */

function bearer(request) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : '';
}

/**
 * Resolve the caller.
 *
 * Two kinds. A `member` is a person: a token issued when they joined, tied to a
 * name and a role, revocable on its own. A `legacy` caller presented a shared
 * squad code from before orgs existed; it still works so that a phone in
 * someone's pocket does not stop mid-shift, but it is anonymous by
 * construction and the audit log says so.
 */
async function authenticate(request, env, tokenOverride) {
  const token = tokenOverride || bearer(request);
  const store = kv(env);

  if (token && store) {
    const pointer = await store.get(`tok:${await sha256(token)}`, 'json');
    if (pointer) {
      const member = await store.get(`mem:${pointer.orgId}:${pointer.memberId}`, 'json');
      if (member && member.status === 'active') {
        if (member.role === 'guest' && Date.parse(member.expiresAt || '') <= Date.now()) return { kind: 'expired', member };
        return { kind: 'member', orgId: pointer.orgId, member };
      }
      if (member) return { kind: 'revoked', member };
    }
    return { kind: 'unknown' };
  }

  const presented = request.headers.get('x-squad-code') || '';
  const codes = parseList(env.ACCESS_CODES);
  if (presented && codes.some((c) => safeEqual(c, presented))) {
    return { kind: 'legacy', code: presented };
  }

  return { kind: 'none' };
}

function isAdmin(auth) {
  return auth.kind === 'member' && auth.member.role === 'admin';
}

/* ------------------------------------------------------------------ *
 * Rate limiting and audit
 * ------------------------------------------------------------------ */

async function overDailyLimit(env, subject) {
  const store = kv(env);
  if (!store) return false;

  const limit = Number(env.DAILY_LIMIT || DEFAULT_DAILY_LIMIT);
  if (!Number.isFinite(limit) || limit <= 0) return false;

  const day = new Date().toISOString().slice(0, 10);
  const key = `rate:${await sha256(subject)}:${day}`;
  const used = Number((await store.get(key)) || 0);
  if (used >= limit) return true;

  // Not atomic: two requests in the same instant can read the same count. A
  // quota guard stopping runaway use does not need exact accounting.
  await store.put(key, String(used + 1), { expirationTtl: 60 * 60 * 36 });
  return false;
}

/**
 * Record that a narrative was generated. Deliberately records *that* it
 * happened and by whom — never the notes, the narrative, or anything about the
 * patient. An audit log that itself holds PHI is a liability, not a control.
 */
async function audit(env, orgId, entry) {
  const store = kv(env);
  if (!store || !orgId) return;

  const at = new Date().toISOString();
  const key = `aud:${orgId}:${at}:${randomCode(6)}`;
  await store.put(key, JSON.stringify({ at, ...entry }), {
    expirationTtl: 60 * 60 * 24 * AUDIT_TTL_DAYS,
  });
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

async function createOrg(request, env) {
  const store = kv(env);
  if (!store) return fail(503, 'This relay has no storage bound. See server/README.md.', request, env);

  const bootstrap = (env.BOOTSTRAP_CODE || '').trim();
  if (!bootstrap) {
    return fail(503, 'This relay has no BOOTSTRAP_CODE set, so no org can be created.', request, env);
  }
  if (!safeEqual(bootstrap, request.headers.get('x-bootstrap-code') || '')) {
    return fail(401, 'That setup code was not recognised.', request, env);
  }

  const body = await request.json().catch(() => null);
  const orgName = String(body?.orgName || '').trim();
  const adminName = String(body?.adminName || '').trim();
  if (!orgName || !adminName) {
    return fail(400, 'An organization name and your own name are both required.', request, env);
  }

  const orgId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const token = randomToken();
  const inviteCode = randomCode();
  const now = new Date().toISOString();

  await store.put(
    `org:${orgId}`,
    JSON.stringify({ id: orgId, name: orgName, createdAt: now, config: null }),
  );
  await store.put(
    `invite:${inviteCode}`,
    JSON.stringify({ orgId, role: 'member', createdAt: now, disabled: false }),
  );
  await store.put(
    `mem:${orgId}:${memberId}`,
    JSON.stringify({
      id: memberId,
      orgId,
      name: adminName,
      role: 'admin',
      status: 'active',
      certLevel: '',
      joinedAt: now,
      lastSeenAt: now,
      requests: 0,
    }),
  );
  await store.put(`tok:${await sha256(token)}`, JSON.stringify({ orgId, memberId }));

  // Only the relay owner holds the setup code, so whoever sets up a squad can
  // also say it is their own and should never hit the shared boards' trial.
  if (body?.plan === 'comp') {
    await store.put(`plan:${orgId}`, JSON.stringify({ tier: 'comp', setAt: now }));
  }

  await audit(env, orgId, { action: 'org_created', memberId, name: adminName });

  return json({ orgId, orgName, memberId, inviteCode, token, role: 'admin' }, 200, request, env);
}

async function join(request, env) {
  const store = kv(env);
  if (!store) return fail(503, 'This relay has no storage bound.', request, env);

  const body = await request.json().catch(() => null);
  const code = String(body?.inviteCode || '').trim().toUpperCase();
  const name = String(body?.name || '').trim();
  const certLevel = String(body?.certLevel || '').trim();

  if (!code) return fail(400, 'An invite code is required.', request, env);
  if (!name) return fail(400, 'Your name is required, so the log can say who did what.', request, env);

  const invite = await store.get(`invite:${code}`, 'json');
  if (!invite || invite.disabled) {
    return fail(401, 'That invite code is not valid. Ask your admin for a current one.', request, env);
  }
  const guest = invite.role === 'guest';
  if (guest && !(Date.parse(invite.expiresAt || '') > Date.now())) {
    return fail(401, 'That guest invite has run out. Ask the squad for a new one.', request, env);
  }
  const role = guest ? 'guest' : invite.role === 'admin' ? 'admin' : 'member';

  const org = await store.get(`org:${invite.orgId}`, 'json');
  if (!org) return fail(404, 'That invite points at an organization that no longer exists.', request, env);

  const memberId = crypto.randomUUID();
  const token = randomToken();
  const now = new Date().toISOString();

  await store.put(
    `mem:${invite.orgId}:${memberId}`,
    JSON.stringify({
      id: memberId,
      orgId: invite.orgId,
      name,
      certLevel,
      role,
      ...(guest ? { agency: invite.agency, dept: invite.dept || '', expiresAt: invite.expiresAt } : {}),
      status: 'active',
      joinedAt: now,
      lastSeenAt: now,
      requests: 0,
    }),
  );
  await store.put(`tok:${await sha256(token)}`, JSON.stringify({ orgId: invite.orgId, memberId }));

  await audit(env, invite.orgId, { action: guest ? 'guest_joined' : 'member_joined', memberId, name, ...(guest ? { agency: invite.agency, dept: invite.dept || '' } : {}) });

  return json(
    {
      token,
      member: { id: memberId, name, certLevel, role, ...(guest ? { agency: invite.agency, dept: invite.dept || '', expiresAt: invite.expiresAt } : {}) },
      org: { id: org.id, name: org.name, ...(guest ? {} : { config: org.config }) },
    },
    200,
    request,
    env,
  );
}

async function me(auth, request, env) {
  const store = kv(env);
  const org = store ? await store.get(`org:${auth.orgId}`, 'json') : null;
  // So a tablet the board turned away can say why, and until when.
  const record = store ? await store.get(`plan:${auth.orgId}`, 'json') : null;
  return json(
    {
      boardPlan: record ? boardPlan(record) : null,
      member: {
        id: auth.member.id,
        name: auth.member.name,
        certLevel: auth.member.certLevel,
        role: auth.member.role,
        ...(auth.member.role === 'guest' ? { agency: auth.member.agency, dept: auth.member.dept || '', expiresAt: auth.member.expiresAt } : {}),
      },
      org: org ? { id: org.id, name: org.name, ...(auth.member.role === 'guest' ? {} : { config: org.config }) } : null,
    },
    200,
    request,
    env,
  );
}

async function putConfig(auth, request, env) {
  const store = kv(env);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail(400, 'A config object is required.', request, env);

  const org = await store.get(`org:${auth.orgId}`, 'json');
  if (!org) return fail(404, 'Organization not found.', request, env);

  org.config = body.config ?? body;
  if (typeof body.orgName === 'string' && body.orgName.trim()) org.name = body.orgName.trim();
  await store.put(`org:${auth.orgId}`, JSON.stringify(org));

  await audit(env, auth.orgId, {
    action: 'config_updated',
    memberId: auth.member.id,
    name: auth.member.name,
  });

  return json({ ok: true, org: { id: org.id, name: org.name, config: org.config } }, 200, request, env);
}

async function listMembers(auth, request, env) {
  const store = kv(env);
  const list = await store.list({ prefix: `mem:${auth.orgId}:` });
  const members = [];
  for (const key of list.keys) {
    const member = await store.get(key.name, 'json');
    if (member) {
      members.push({
        id: member.id,
        name: member.name,
        certLevel: member.certLevel,
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt,
        lastSeenAt: member.lastSeenAt,
        requests: member.requests ?? 0,
      });
    }
  }
  members.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return json({ members }, 200, request, env);
}

async function setMemberStatus(auth, request, env) {
  const store = kv(env);
  const body = await request.json().catch(() => null);
  const memberId = String(body?.memberId || '').trim();
  const status = body?.status === 'active' ? 'active' : 'revoked';
  if (!memberId) return fail(400, 'A member id is required.', request, env);

  if (memberId === auth.member.id && status === 'revoked') {
    // Otherwise an admin can lock the whole org out of its own settings.
    return fail(400, 'You cannot revoke your own access.', request, env);
  }

  const key = `mem:${auth.orgId}:${memberId}`;
  const member = await store.get(key, 'json');
  if (!member) return fail(404, 'No such member.', request, env);

  member.status = status;
  await store.put(key, JSON.stringify(member));

  await audit(env, auth.orgId, {
    action: status === 'revoked' ? 'member_revoked' : 'member_restored',
    memberId: auth.member.id,
    name: auth.member.name,
    subject: member.name,
  });

  return json({ ok: true }, 200, request, env);
}

async function rotateInvite(auth, request, env) {
  const store = kv(env);
  const body = await request.json().catch(() => ({}));
  const role = body?.role === 'admin' ? 'admin' : 'member';

  // Disable every current code for this org, so a link that has been forwarded
  // around stops working the moment an admin decides it should.
  const list = await store.list({ prefix: 'invite:' });
  for (const key of list.keys) {
    const invite = await store.get(key.name, 'json');
    if (invite?.orgId === auth.orgId && !invite.disabled && invite.role !== 'guest') {
      await store.put(key.name, JSON.stringify({ ...invite, disabled: true }));
    }
  }

  const inviteCode = randomCode();
  await store.put(
    `invite:${inviteCode}`,
    JSON.stringify({ orgId: auth.orgId, role, createdAt: new Date().toISOString(), disabled: false }),
  );

  await audit(env, auth.orgId, {
    action: 'invite_rotated',
    memberId: auth.member.id,
    name: auth.member.name,
  });

  return json({ inviteCode, role }, 200, request, env);
}

async function guestInvite(auth, request, env) {
  const store = kv(env);
  const body = await request.json().catch(() => ({}));
  const agency = String(body?.agency || '');
  if (!GUEST_AGENCIES.includes(agency)) return fail(400, `A guest invite is for one of: ${GUEST_AGENCIES.join(', ')}.`, request, env);
  const hours = GUEST_HOURS.includes(Number(body?.hours)) ? Number(body.hours) : 24;
  const dept = String(body?.dept || '').trim().slice(0, 80);
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const inviteCode = randomCode();
  await store.put(
    `invite:${inviteCode}`,
    JSON.stringify({ orgId: auth.orgId, role: 'guest', agency, dept, expiresAt, createdAt: new Date().toISOString(), by: auth.member.id, disabled: false }),
    { expirationTtl: hours * 60 * 60 + 7 * 24 * 60 * 60 },
  );
  await audit(env, auth.orgId, { action: 'guest_invite_made', memberId: auth.member.id, name: auth.member.name, agency, dept, hours });
  return json({ inviteCode, agency, dept, expiresAt }, 200, request, env);
}

async function readAudit(auth, request, env) {
  const store = kv(env);
  const list = await store.list({ prefix: `aud:${auth.orgId}:`, limit: 200 });
  const entries = [];
  for (const key of list.keys) {
    const entry = await store.get(key.name, 'json');
    if (entry) entries.push(entry);
  }
  entries.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return json({ entries: entries.slice(0, 100) }, 200, request, env);
}

async function generate(auth, request, env) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return fail(413, 'Those notes are too long to send.', request, env);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return fail(400, 'Malformed request.', request, env);
  }

  const provider = PROVIDERS[payload?.providerId];
  if (!provider) return fail(400, `Unknown provider "${payload?.providerId}".`, request, env);
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

  if (auth.kind === 'member') {
    const store = kv(env);
    if (store) {
      const key = `mem:${auth.orgId}:${auth.member.id}`;
      const member = await store.get(key, 'json');
      if (member) {
        member.lastSeenAt = new Date().toISOString();
        member.requests = (member.requests ?? 0) + 1;
        await store.put(key, JSON.stringify(member));
      }
    }
    await audit(env, auth.orgId, {
      action: 'narrative_generated',
      memberId: auth.member.id,
      name: auth.member.name,
      provider: payload.providerId,
      status: upstream.status,
    });
  }

  // The provider's response passes through untouched — the app already knows
  // how to read every provider's success and error shapes.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      ...corsHeaders(request, env),
    },
  });
}

/* ------------------------------------------------------------------ *
 * Shared boards
 * ------------------------------------------------------------------ */

const BOARD_PROTOCOL = 'pcr-board';
const BOARD_PATH = /^[A-Za-z0-9_.~:@+-]{1,200}(\/[A-Za-z0-9_.~:@+-]{1,200}){0,9}$/;
const BOARD_MAX_DOC = 256 * 1024;
const BOARD_MAX_SUBS = 24;
const BOARD_TRIAL_DAYS = 60;
const BOARD_GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const PLAN_TIERS = ['trial', 'squad', 'comp', 'off'];

const trialDays = (env) => {
  const n = Number(env.BOARD_TRIAL_DAYS);
  return env.BOARD_TRIAL_DAYS !== undefined && env.BOARD_TRIAL_DAYS !== '' && Number.isFinite(n) && n >= 0 ? n : BOARD_TRIAL_DAYS;
};

/**
 * Whether a squad's tablets may share a board, and what to tell them about it.
 * Sharing is the paid part of the scene command board; any tablet runs the
 * whole board on its own for free. So this gates the shared board only, never
 * the narratives the rest of this relay serves.
 *
 *   trial  free, from the first time the squad shares a board, BOARD_TRIAL_DAYS long
 *   squad  paid through `paidThrough` (a date), then BOARD_GRACE_DAYS more, so a
 *          late invoice never stops a squad's tablets in the middle of a call
 *   comp   no end date: the relay owner's own squad, a pilot, a county agency
 *   off    sharing turned off by the relay owner
 *
 * A tablet already connected when a plan ends keeps sharing until it next
 * reconnects, for the same reason.
 */
function boardPlan(record, now = Date.now()) {
  const p = record || {};
  if (p.tier === 'comp') return { tier: 'comp', active: true };
  if (p.tier === 'off') return { tier: 'off', active: false };
  if (p.tier === 'squad') {
    const through = Date.parse(p.paidThrough || '');
    if (!Number.isFinite(through)) return { tier: 'squad', active: true };
    const end = through + DAY_MS;
    const graceEnd = end + BOARD_GRACE_DAYS * DAY_MS;
    return { tier: 'squad', active: now < graceEnd, grace: now >= end, paidThrough: p.paidThrough, endsAt: new Date(graceEnd).toISOString() };
  }
  const ends = Date.parse(p.trialEndsAt || '');
  return { tier: 'trial', active: Number.isFinite(ends) && now < ends, endsAt: p.trialEndsAt || null };
}

function newTrial(env, by) {
  const start = Date.now();
  return {
    tier: 'trial',
    trialStartedAt: new Date(start).toISOString(),
    trialEndsAt: new Date(start + trialDays(env) * DAY_MS).toISOString(),
    setAt: new Date(start).toISOString(),
    by,
  };
}

const PLAN_REFUSALS = {
  trial: "Your squad's free trial of shared boards has ended. Each tablet still works on its own.",
  squad: "Your squad's plan has lapsed. Each tablet still works on its own.",
  off: 'Shared boards are turned off for this squad. Each tablet still works on its own.',
};

/**
 * The relay owner's view of every squad and its plan. Guarded by the same
 * setup code that creates squads: both are the owner's, and only the owner's.
 */
function ownerGuard(request, env) {
  const bootstrap = (env.BOOTSTRAP_CODE || '').trim();
  if (!kv(env)) return fail(503, 'This relay has no storage bound.', request, env);
  if (!bootstrap) return fail(503, 'This relay has no BOOTSTRAP_CODE set.', request, env);
  if (!safeEqual(bootstrap, request.headers.get('x-bootstrap-code') || '')) {
    return fail(401, 'That setup code was not recognised.', request, env);
  }
  return null;
}

async function orgMembers(store, orgId) {
  const out = [];
  let cursor;
  do {
    const page = await store.list({ prefix: `mem:${orgId}:`, cursor });
    for (const { name } of page.keys) { const m = await store.get(name, 'json'); if (m) out.push(m); }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && out.length < 2000);
  return out;
}
async function boardStats(env, orgId) {
  if (!env.BOARD) return null;
  try {
    const res = await env.BOARD.get(env.BOARD.idFromName(orgId)).fetch('https://board.internal/stats');
    return res.ok ? await res.json() : null;
  } catch { return null; }
}
const latest = (...ts) => ts.map((t) => (typeof t === 'number' ? t : Date.parse(t || ''))).filter(Number.isFinite).reduce((a, b) => Math.max(a, b), 0) || null;

async function squadSummary(env, store, org, withStats) {
  const record = await store.get(`plan:${org.id}`, 'json');
  const members = await orgMembers(store, org.id);
  const now = Date.now();
  const people = members.filter((m) => m.role !== 'guest');
  const guests = members.filter((m) => m.role === 'guest');
  const out = {
    id: org.id, name: org.name, createdAt: org.createdAt, plan: record ? boardPlan(record) : null,
    planSince: record ? record.trialStartedAt || record.setAt || null : null,
    members: {
      active: people.filter((m) => m.status === 'active').length,
      admins: people.filter((m) => m.status === 'active' && m.role === 'admin').length,
      revoked: people.filter((m) => m.status !== 'active').length,
      guests: guests.filter((m) => m.status === 'active' && Date.parse(m.expiresAt || '') > now).length,
      guestAgencies: [...new Set(guests.filter((m) => m.status === 'active' && Date.parse(m.expiresAt || '') > now).map((m) => m.agency))],
    },
  };
  if (withStats) {
    const b = await boardStats(env, org.id);
    out.board = b;
    out.lastActiveAt = latest(b && b.lastWriteAt, ...(b ? b.devices.map((d) => d.at) : []), ...members.map((m) => m.lastSeenAt));
  }
  return out;
}

async function ownerSquads(request, env) {
  const refused = ownerGuard(request, env);
  if (refused) return refused;
  const store = kv(env);
  const orgs = [];
  let cursor;
  do {
    const page = await store.list({ prefix: 'org:', cursor });
    for (const { name } of page.keys) { const org = await store.get(name, 'json'); if (org) orgs.push(org); }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && orgs.length < 2000);
  const body = await request.clone().json().catch(() => ({}));
  const withStats = body?.stats !== false;
  const squads = [];
  for (let i = 0; i < orgs.length; i += 8) squads.push(...(await Promise.all(orgs.slice(i, i + 8).map((o) => squadSummary(env, store, o, withStats)))));
  squads.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return json({ squads, trialDays: trialDays(env), graceDays: BOARD_GRACE_DAYS, at: new Date().toISOString() }, 200, request, env);
}

/* One squad in full, for the owner: its people (names and roles, never tokens), guests and when they run out,
   the devices that use its board, and its recent audit log. */
async function ownerSquad(request, env) {
  const refused = ownerGuard(request, env);
  if (refused) return refused;
  const store = kv(env);
  const body = await request.json().catch(() => null);
  const org = body?.orgId ? await store.get(`org:${String(body.orgId)}`, 'json') : null;
  if (!org) return fail(404, 'No squad with that ID on this relay.', request, env);
  const summary = await squadSummary(env, store, org, true);
  const members = (await orgMembers(store, org.id)).map((m) => ({
    id: m.id, name: m.name, role: m.role, status: m.status, joinedAt: m.joinedAt, lastSeenAt: m.lastSeenAt,
    ...(m.role === 'guest' ? { agency: m.agency, dept: m.dept || '', expiresAt: m.expiresAt } : {}),
  })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const list = await store.list({ prefix: `aud:${org.id}:`, limit: 200 });
  const audit = [];
  for (const key of list.keys) { const e = await store.get(key.name, 'json'); if (e) audit.push(e); }
  audit.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return json({ ...summary, people: members, audit: audit.slice(0, 60) }, 200, request, env);
}

async function ownerSetPlan(request, env) {
  const refused = ownerGuard(request, env);
  if (refused) return refused;
  const store = kv(env);
  const body = await request.json().catch(() => null);
  const orgId = String(body?.orgId || '');
  const tier = String(body?.tier || '');
  if (!PLAN_TIERS.includes(tier)) return fail(400, `The plan is one of: ${PLAN_TIERS.join(', ')}.`, request, env);
  const org = orgId ? await store.get(`org:${orgId}`, 'json') : null;
  if (!org) return fail(404, 'No squad with that ID on this relay.', request, env);

  let record;
  if (tier === 'trial') {
    record = newTrial(env, 'owner');
  } else if (tier === 'squad') {
    const paidThrough = String(body?.paidThrough || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidThrough) || !Number.isFinite(Date.parse(paidThrough))) {
      return fail(400, 'A squad plan needs the date it is paid through, as YYYY-MM-DD.', request, env);
    }
    record = { tier, paidThrough, setAt: new Date().toISOString(), by: 'owner' };
  } else {
    record = { tier, setAt: new Date().toISOString(), by: 'owner' };
  }
  await store.put(`plan:${org.id}`, JSON.stringify(record));
  await audit(env, org.id, { action: 'plan_set', tier, paidThrough: record.paidThrough || null });
  return json({ id: org.id, name: org.name, plan: boardPlan(record) }, 200, request, env);
}

/**
 * Refusals on a WebSocket have to be a WebSocket: a browser that gets a plain
 * 401 back from an upgrade sees only "connection failed", with no status and
 * no reason. So the socket is accepted and closed at once with a code the
 * page can act on.
 */
function refuseSocket(code, reason) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.close(code, reason);
  return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': BOARD_PROTOCOL } });
}

async function openBoard(request, env) {
  if ((request.headers.get('upgrade') || '').toLowerCase() !== 'websocket') {
    return fail(426, 'The board connects over a WebSocket.', request, env);
  }
  if (!env.BOARD) return refuseSocket(4503, 'This relay was deployed without board storage. Redeploy it.');

  const origin = request.headers.get('origin') || '';
  const allowed = parseList(env.ALLOWED_ORIGINS);
  if (allowed.length && origin && !allowed.includes(origin)) return refuseSocket(4403, 'This page is not allowed to use this relay.');

  const offered = (request.headers.get('sec-websocket-protocol') || '').split(',').map((p) => p.trim());
  const token = offered.find((p) => p && p !== BOARD_PROTOCOL) || '';
  const auth = await authenticate(request, env, token);
  if (auth.kind === 'revoked') return refuseSocket(4403, 'Your access to this organization has been withdrawn.');
  if (auth.kind === 'expired') return refuseSocket(4403, 'This guest access has ended. Ask the squad for a new guest link.');
  if (auth.kind !== 'member') return refuseSocket(4401, 'This tablet is not signed in to the squad.');

  // The trial starts the first time a squad shares a board, not when it was set
  // up, so a squad that has used narratives for a year still gets its 60 days.
  const store = kv(env);
  let record = await store.get(`plan:${auth.orgId}`, 'json');
  if (!record) {
    record = newTrial(env, auth.member.id);
    await store.put(`plan:${auth.orgId}`, JSON.stringify(record));
    await audit(env, auth.orgId, { action: 'board_trial_started', memberId: auth.member.id, name: auth.member.name });
  }
  const plan = boardPlan(record);
  if (!plan.active) return refuseSocket(4402, PLAN_REFUSALS[plan.tier] || PLAN_REFUSALS.off);

  const stub = env.BOARD.get(env.BOARD.idFromName(auth.orgId));
  const headers = new Headers(request.headers);
  headers.set('x-member-id', auth.member.id);
  headers.set('x-member-name', auth.member.name || '');
  headers.set('x-member-role', auth.member.role || 'member');
  headers.set('x-plan', JSON.stringify(plan));
  return stub.fetch(new Request(request, { headers }));
}

/**
 * One squad's boards. A tiny document store with live subscriptions: a page
 * can set a document at a path, read one, and subscribe to a document or to
 * the documents directly under a collection path. It has the same shape as the
 * store the board uses when it is hosted in Claude, so the board's sync code
 * is the same either way.
 *
 * It uses the WebSocket hibernation API, so an idle squad with tablets
 * connected costs nothing while nobody is tapping.
 */
export class Board extends DurableObject {
  async fetch(request) {
    // The relay owner's console asks for a summary; nothing outside this worker can reach a Durable Object.
    if (new URL(request.url).pathname === '/stats') return Response.json(await this.stats());
    // Otherwise reached only through openBoard, after the caller was authenticated.
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      member: request.headers.get('x-member-id') || '',
      name: request.headers.get('x-member-name') || '',
      guest: request.headers.get('x-member-role') === 'guest',
      plan: JSON.parse(request.headers.get('x-plan') || 'null'),
      peer: '', dev: '', role: '', at: Date.now(), subs: [],
    });
    return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': BOARD_PROTOCOL } });
  }

  send(ws, msg) {
    try { ws.send(JSON.stringify(msg)); } catch { /* socket already gone */ }
  }

  peers(except) {
    return this.ctx.getWebSockets()
      .filter((ws) => ws !== except)
      .map((ws) => ws.deserializeAttachment() || {})
      .filter((a) => a.peer)
      .map((a) => ({ peer: a.peer, dev: a.dev, role: a.role, name: a.name, at: a.at }));
  }

  broadcastPeers(except) {
    const peers = this.peers(except);
    for (const ws of this.ctx.getWebSockets()) if (ws !== except) this.send(ws, { type: 'peers', peers });
  }

  async read(path) {
    const segments = path.split('/').length;
    if (segments % 2 === 0) return { type: 'doc', path, data: (await this.ctx.storage.get('d:' + path)) ?? null };
    const found = await this.ctx.storage.list({ prefix: 'd:' + path + '/' });
    const docs = [];
    for (const [key, data] of found) {
      const p = key.slice(2);
      if (p.split('/').length === segments + 1) docs.push([p, data]);
    }
    return { type: 'col', path, docs };
  }

  async webSocketMessage(ws, raw) {
    let m;
    try { m = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const a = ws.deserializeAttachment() || { subs: [] };
    const bad = (why) => this.send(ws, { type: 'err', rid: m.rid, code: 'invalid_argument', message: why });
    const pathOk = typeof m.path === 'string' && BOARD_PATH.test(m.path) && !m.path.split('/').some((x) => x === '.' || x === '..');
    if (a.guest && pathOk && ['sub', 'get', 'set'].includes(m.type) && !guestPathOk(m.path)) {
      return this.send(ws, { type: 'err', rid: m.rid, path: m.path, code: 'permission_denied', message: 'Guests see the incident and event boards only.' });
    }

    switch (m.type) {
      case 'hello':
      case 'presence': {
        a.peer = String(m.peer || a.peer || '').slice(0, 40);
        if (m.dev !== undefined) a.dev = String(m.dev).slice(0, 40);
        if (m.role !== undefined) a.role = String(m.role).slice(0, 20);
        a.at = Date.now();
        ws.serializeAttachment(a);
        // Which devices use this board, and when last: for the owner's console. Counts and names, no board data.
        if (a.dev) await this.ctx.storage.put(`m:dev:${a.member}:${a.dev}`, { name: a.name, role: a.role, guest: !!a.guest, at: a.at });
        if (m.type === 'hello') this.send(ws, { type: 'welcome', name: a.name, plan: a.plan || null });
        this.broadcastPeers();
        return;
      }
      case 'sub': {
        if (!pathOk) return bad('That path is not valid.');
        if (!a.subs.includes(m.path)) {
          if (a.subs.length >= BOARD_MAX_SUBS) return bad('Too many subscriptions.');
          a.subs.push(m.path);
          ws.serializeAttachment(a);
        }
        this.send(ws, await this.read(m.path));
        return;
      }
      case 'unsub': {
        a.subs = a.subs.filter((p) => p !== m.path);
        ws.serializeAttachment(a);
        return;
      }
      case 'get': {
        if (!pathOk || m.path.split('/').length % 2) return bad('A document path is needed.');
        const r = await this.read(m.path);
        this.send(ws, { type: 'got', rid: m.rid, path: m.path, data: r.data });
        return;
      }
      case 'set': {
        if (!pathOk || m.path.split('/').length % 2) return bad('A document path is needed.');
        if (!m.data || typeof m.data !== 'object' || Array.isArray(m.data)) return bad('A document is an object.');
        if (JSON.stringify(m.data).length > BOARD_MAX_DOC) return bad('That document is over 256 KB.');
        await this.ctx.storage.put('d:' + m.path, m.data);
        if (Date.now() - (this.lastWrite || 0) > 30000) { this.lastWrite = Date.now(); await this.ctx.storage.put('m:last', this.lastWrite); }
        this.send(ws, { type: 'ok', rid: m.rid });
        const parent = m.path.split('/').slice(0, -1).join('/');
        for (const other of this.ctx.getWebSockets()) {
          const o = other.deserializeAttachment() || {};
          if ((o.subs || []).some((p) => p === m.path || p === parent)) this.send(other, { type: 'doc', path: m.path, data: m.data });
        }
        return;
      }
      default:
        return bad('Unknown message.');
    }
  }

  /* What this squad has and how it is being used, without anything a patient or member typed: the squad's setup in
     counts, which devices connect, and whether an MCI, an event or today's board is running. */
  async stats() {
    const st = this.ctx.storage, doc = async (p) => (await st.get('d:' + p)) ?? null;
    const evsOf = async (root) => {
      const out = [];
      for (const [, d] of await st.list({ prefix: `d:${root}/devices/` })) if (d && Array.isArray(d.events)) out.push(...d.events);
      const undone = new Set(out.filter((e) => e.type === 'undo').map((e) => e.p && e.p.target));
      return out.filter((e) => e.type !== 'undo' && !undone.has(e.id)).sort((x, y) => x.t - y.t);
    };
    const board = async (pointer, root) => {
      const ptr = await doc(pointer);
      if (!ptr || !ptr.id) return null;
      const d = await doc(`${root}/${ptr.id}`);
      if (!d || !d.base) return null;
      return { id: ptr.id, base: d.base, createdAt: d.createdAt || ptr.at || null, events: await evsOf(`${root}/${ptr.id}`) };
    };
    const last = (evs) => (evs.length ? evs[evs.length - 1].t : null);
    const count = (evs, type) => evs.filter((e) => e.type === type).length;

    let incident = null;
    const inc = await board('now/incident', 'mci');
    if (inc) {
      const I = { ...(inc.base.incident || {}) };
      let level = I.mciLevel || 0, clear = !!(inc.base.bench || {}).clear, pts = Object.values(inc.base.triage || {}).reduce((a, n) => a + (Number(n) || 0), 0);
      for (const e of inc.events) {
        if (e.type === 'incEdit' && e.p && e.p.fields) Object.assign(I, e.p.fields);
        if (e.type === 'mci' && e.p) level = e.p.L || 0;
        if (e.type === 'tri' && e.p) pts += e.p.d || 0;
        if (e.type === 'bench' && e.p && e.p.id === 'clear') clear = !!e.p.on;
      }
      const used = !inc.base.fresh || inc.events.some((e) => e.type === 'incEdit' || e.type === 'mci');
      incident = used ? {
        type: String(I.type || '').slice(0, 60), place: [I.location, I.municipality].filter(Boolean).join(', ').slice(0, 120),
        level, patients: Math.max(0, pts), transports: count(inc.events, 'tx') + (inc.base.transports || []).length,
        clear, sample: !!inc.base.sample, startedAt: I.dispatchAt || inc.createdAt, lastAt: last(inc.events),
        agencies: [...new Set(inc.events.map((e) => e.role).filter(Boolean))],
      } : null;
    }
    let event = null;
    const ev = await board('now/event', 'evts');
    if (ev && !ev.base.none) {
      const ended = ev.events.find((e) => e.type === 'evEnd');
      event = {
        name: String((ev.base.event || {}).name || '').slice(0, 80), place: String((ev.base.event || {}).location || '').slice(0, 120),
        posts: (ev.base.posts || []).length + count(ev.events, 'postAdd') - count(ev.events, 'postDel'),
        people: (ev.base.people || []).length + count(ev.events, 'personAdd'),
        patients: (ev.base.pts || []).length + count(ev.events, 'ptAdd') - count(ev.events, 'ptDel'),
        sample: !!ev.base.sample, startedAt: ev.base.startedAt || ev.createdAt, endedAt: ended ? ended.t : (ev.base.ended || null), lastAt: last(ev.events),
      };
    }
    let day = null;
    const dy = await board('now/day', 'days');
    if (dy) {
      day = {
        id: dy.id, calls: (dy.base.calls || []).length + count(dy.events, 'callAdd'),
        crew: (dy.base.crew || []).length + count(dy.events, 'crewIn'), sample: !!dy.base.sample, lastAt: last(dy.events),
      };
    }
    const c = await doc('squad/config');
    const config = c ? {
      name: String((c.agency || {}).name || '').slice(0, 80), type: (c.agency || {}).type || 'ems', num: String((c.agency || {}).num || '').slice(0, 10),
      logo: !!(c.agency || {}).logo, units: (c.roster || []).length, members: (c.members || []).length,
      cameras: (c.cameras || []).length, feeds: (c.feeds || []).length, favorites: (c.favHosp || []).length, contacts: (c.contacts || []).length,
      par: !!(c.features || {}).par, savedAt: c.savedAt || null,
    } : null;
    const devices = [...(await st.list({ prefix: 'm:dev:' })).values()].sort((x, y) => y.at - x.at).slice(0, 200);
    const online = this.ctx.getWebSockets().map((w) => w.deserializeAttachment() || {}).filter((a) => a.peer)
      .map((a) => ({ name: a.name, role: a.role, guest: !!a.guest, since: a.at }));
    return { online, devices, lastWriteAt: (await st.get('m:last')) || null, config, incident, event, day };
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code, 'Closing'); } catch { /* already closed */ }
    this.broadcastPeers(ws);
  }

  async webSocketError(ws) {
    this.broadcastPeers(ws);
  }
}

/* ------------------------------------------------------------------ *
 * Hospital ED status
 * ------------------------------------------------------------------ */

/**
 * New Jersey's public Emergency Department Status board (njdivert.juvare.com)
 * publishes every hospital's status, reason and comment as one file, which
 * its own page reads every three minutes. Pages elsewhere can't read it from
 * a browser, so the relay fetches it and passes on just those fields. Kept in
 * memory for 90 seconds, so however many tablets ask, the source sees about
 * one request a minute from each relay instance.
 */
const DIVERT_SOURCE = 'https://njdivert.juvare.com/njdivert.juvare.com.json';
const DIVERT_TTL_MS = 90 * 1000;
let divertMemo = { at: 0, body: null };

async function divertStatus(request, env) {
  if (request.method !== 'GET') return fail(405, 'Method not allowed.', request, env);
  if (!divertMemo.body || Date.now() - divertMemo.at > DIVERT_TTL_MS) {
    let data;
    try {
      const upstream = await fetch(DIVERT_SOURCE, { headers: { accept: 'application/json' } });
      if (!upstream.ok) throw new Error(String(upstream.status));
      data = await upstream.json();
    } catch {
      if (divertMemo.body) return json({ ...divertMemo.body, stale: true }, 200, request, env);
      return fail(502, 'The NJ ED status site is not answering right now.', request, env);
    }
    const text = (v, max) => String(v ?? '').trim().slice(0, max);
    divertMemo = {
      at: Date.now(),
      body: {
        source: 'njdivert.juvare.com',
        updated: text(data?.updateDateTime, 40),
        hospitals: (Array.isArray(data?.statuses) ? data.statuses : []).slice(0, 400).map((h) => ({
          id: text(h.id, 20),
          name: text(h.resourceName, 120),
          county: text(h.county, 40),
          status: text(h.edStatus, 40),
          reason: text(h.edStatusReason, 80),
          comment: text(h.comments, 300),
          color: text(h.colorCode, 16).toLowerCase(),
        })),
      },
    };
  }
  return json(divertMemo.body, 200, request, env);
}

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (path === '/v1/health') {
      const providers = Object.entries(PROVIDERS)
        .filter(([, p]) => !!env[p.secret])
        .map(([id]) => id);
      return json(
        {
          ok: true,
          service: 'pcr-relay',
          providers,
          // Lets the app tell an org-capable relay from an older one and offer
          // the right screens, rather than failing on an endpoint that is not
          // there yet.
          features: [...(kv(env) ? ['orgs'] : []), ...(env.BOARD ? ['board'] : []), ...(env.BOARD && kv(env) ? ['plans'] : []), 'divert'],
        },
        200,
        request,
        env,
      );
    }

    // Unauthenticated: creating an org needs the setup code, joining needs an
    // invite code. Both are checked inside.
    if (path === '/v1/orgs' && request.method === 'POST') return createOrg(request, env);
    if (path === '/v1/join' && request.method === 'POST') return join(request, env);
    // The relay owner's screens: also the setup code, checked inside.
    if (path === '/v1/owner/squads' && request.method === 'POST') return ownerSquads(request, env);
    if (path === '/v1/owner/plan' && request.method === 'POST') return ownerSetPlan(request, env);
    if (path === '/v1/owner/squad' && request.method === 'POST') return ownerSquad(request, env);

    // The board authenticates inside, from the WebSocket subprotocol, and is
    // not counted against the daily AI request limit: a tablet reconnecting
    // after a dropped signal should not eat into anyone's narratives.
    if (path === '/v1/board') return openBoard(request, env);

    // Public data, passed through: hospital ED status for the board.
    if (path === '/v1/divert') return divertStatus(request, env);

    const auth = await authenticate(request, env);

    if (auth.kind === 'revoked') {
      return fail(
        403,
        'Your access to this organization has been withdrawn. Ask your admin if this is unexpected.',
        request,
        env,
      );
    }
    if (auth.kind === 'expired') return fail(403, 'This guest access has ended. Ask the squad for a new guest link.', request, env);
    if (auth.kind === 'unknown') {
      return fail(401, 'This device is not signed in. Open the invite link you were sent.', request, env);
    }
    if (auth.kind === 'none') {
      const configured = parseList(env.ACCESS_CODES).length > 0 || !!kv(env);
      return fail(
        configured ? 401 : 503,
        configured
          ? 'This device is not signed in. Open the invite link you were sent.'
          : 'This relay is not set up yet. See server/README.md.',
        request,
        env,
      );
    }

    const subject = auth.kind === 'member' ? `${auth.orgId}:${auth.member.id}` : auth.code;
    if (await overDailyLimit(env, subject)) {
      return fail(429, "Today's request limit for this account has been reached.", request, env);
    }

    if (path === '/v1/generate') {
      if (request.method !== 'POST') return fail(405, 'Method not allowed.', request, env);
      if (auth.kind === 'member' && auth.member.role === 'guest') return fail(403, 'Guests use the shared boards only.', request, env);
      return generate(auth, request, env);
    }

    // Unknown paths are reported as unknown before anything about permissions,
    // so "you are not allowed to do that" always means the thing exists.
    if (!ACCOUNT_ROUTES.has(path)) return fail(404, 'Not found.', request, env);

    if (auth.kind !== 'member') {
      return fail(
        403,
        'This needs a personal account. Open the invite link your admin sent you.',
        request,
        env,
      );
    }

    if (path === '/v1/me') {
      if (request.method !== 'GET') return fail(405, 'Method not allowed.', request, env);
      return me(auth, request, env);
    }

    // Everything past here changes the org, so it is admins only.
    if (!isAdmin(auth)) {
      return fail(403, 'Only an admin for this organization can do that.', request, env);
    }

    if (path === '/v1/org/config' && request.method === 'PUT') return putConfig(auth, request, env);
    if (path === '/v1/members' && request.method === 'GET') return listMembers(auth, request, env);
    if (path === '/v1/members/status' && request.method === 'POST') {
      return setMemberStatus(auth, request, env);
    }
    if (path === '/v1/invites' && request.method === 'POST') return rotateInvite(auth, request, env);
    if (path === '/v1/guest-invites' && request.method === 'POST') return guestInvite(auth, request, env);
    if (path === '/v1/audit' && request.method === 'GET') return readAudit(auth, request, env);

    return fail(404, 'Not found.', request, env);
  },
};
