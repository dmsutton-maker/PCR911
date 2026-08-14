import { useSettings } from '@/state/settingsStore';
import { getMemberToken } from '@/storage/secure';
import { normalizeRelayUrl, relayEndpoint } from './connection';

/**
 * The signed-in person.
 *
 * A squad code says "somebody who has the code". A member token says who — it
 * is issued to one person when they accept an invite, carries their role, and
 * can be withdrawn from them alone. That is what makes an admin able to remove
 * one crew member without changing anything for everybody else, and what lets
 * the relay's log answer "who generated this".
 *
 * The token lives in the keystore next to the other credentials and is never
 * shown back to the user. Nothing here touches reports: patient content stays
 * on the phone that made it and never reaches the org directory.
 */

export type MemberRole = 'admin' | 'member';

export interface Account {
  memberId: string;
  name: string;
  certLevel: string;
  role: MemberRole;
  orgId: string;
  orgName: string;
}

export interface Member {
  id: string;
  name: string;
  certLevel: string;
  role: MemberRole;
  status: 'active' | 'revoked';
  joinedAt: string;
  lastSeenAt: string;
  requests: number;
}

export interface AuditEntry {
  at: string;
  action: string;
  name?: string;
  subject?: string;
  provider?: string;
}

export class AccountError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AccountError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string; relayUrl?: string } = {},
): Promise<T> {
  const url = normalizeRelayUrl(options.relayUrl || useSettings.getState().relayUrl);
  if (!url) throw new AccountError(0, 'No relay address is set.');

  const token = options.token ?? (await getMemberToken());
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(relayEndpoint(url, path), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new AccountError(0, 'Could not reach your squad server.');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AccountError(
      response.status,
      payload?.error?.message ?? `That request failed (${response.status}).`,
    );
  }
  return payload as T;
}

/* ---------------- creating a squad ---------------- */

export interface CreateOrgResult {
  token: string;
  account: Account;
  inviteCode: string;
}

/**
 * Create the org, and make the caller its first admin.
 *
 * Guarded by a setup code held on the server rather than by an account,
 * because at this point there are no accounts — this is the request that makes
 * the first one. Used once per squad.
 */
export async function createOrg(args: {
  relayUrl: string;
  bootstrapCode: string;
  orgName: string;
  adminName: string;
}): Promise<CreateOrgResult> {
  const url = normalizeRelayUrl(args.relayUrl);
  if (!url) throw new AccountError(0, 'Enter your squad server address first.');

  let response: Response;
  try {
    response = await fetch(relayEndpoint(url, '/v1/orgs'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bootstrap-code': args.bootstrapCode },
      body: JSON.stringify({ orgName: args.orgName, adminName: args.adminName }),
    });
  } catch {
    throw new AccountError(0, 'Could not reach that address. Check it and try again.');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AccountError(
      response.status,
      payload?.error?.message ?? `That request failed (${response.status}).`,
    );
  }

  return {
    token: payload.token,
    inviteCode: payload.inviteCode,
    account: {
      memberId: payload.memberId,
      name: args.adminName,
      certLevel: '',
      role: 'admin',
      orgId: payload.orgId,
      orgName: payload.orgName,
    },
  };
}

/* ---------------- joining ---------------- */

export interface JoinResult {
  token: string;
  account: Account;
  config: unknown;
}

export async function joinOrg(args: {
  relayUrl: string;
  inviteCode: string;
  name: string;
  certLevel: string;
}): Promise<JoinResult> {
  const payload = await request<{
    token: string;
    member: { id: string; name: string; certLevel: string; role: MemberRole };
    org: { id: string; name: string; config: unknown };
  }>('/v1/join', {
    method: 'POST',
    relayUrl: args.relayUrl,
    // No token yet — this is the request that issues one.
    token: '',
    body: { inviteCode: args.inviteCode, name: args.name, certLevel: args.certLevel },
  });

  return {
    token: payload.token,
    account: {
      memberId: payload.member.id,
      name: payload.member.name,
      certLevel: payload.member.certLevel,
      role: payload.member.role,
      orgId: payload.org.id,
      orgName: payload.org.name,
    },
    config: payload.org.config,
  };
}

/** Re-read who we are and what the org currently wants. */
export async function fetchMe(): Promise<{ account: Account; config: unknown }> {
  const payload = await request<{
    member: { id: string; name: string; certLevel: string; role: MemberRole };
    org: { id: string; name: string; config: unknown } | null;
  }>('/v1/me');

  return {
    account: {
      memberId: payload.member.id,
      name: payload.member.name,
      certLevel: payload.member.certLevel,
      role: payload.member.role,
      orgId: payload.org?.id ?? '',
      orgName: payload.org?.name ?? '',
    },
    config: payload.org?.config ?? null,
  };
}

/* ---------------- admin ---------------- */

export async function listMembers(): Promise<Member[]> {
  const payload = await request<{ members: Member[] }>('/v1/members');
  return payload.members;
}

export async function setMemberStatus(memberId: string, status: 'active' | 'revoked'): Promise<void> {
  await request('/v1/members/status', { method: 'POST', body: { memberId, status } });
}

export async function rotateInvite(role: MemberRole = 'member'): Promise<string> {
  const payload = await request<{ inviteCode: string }>('/v1/invites', {
    method: 'POST',
    body: { role },
  });
  return payload.inviteCode;
}

export async function fetchAudit(): Promise<AuditEntry[]> {
  const payload = await request<{ entries: AuditEntry[] }>('/v1/audit');
  return payload.entries;
}

export async function pushOrgConfig(orgName: string, config: unknown): Promise<void> {
  await request('/v1/org/config', { method: 'PUT', body: { orgName, config } });
}
