import * as Clipboard from 'expo-clipboard';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AccountError,
  type AuditEntry,
  fetchAudit,
  listMembers,
  type Member,
  rotateInvite,
  setMemberStatus,
} from '@/ai/account';
import { normalizeRelayUrl } from '@/ai/connection';
import {
  Banner,
  Body,
  Button,
  Card,
  Divider,
  Heading,
  Loading,
  Muted,
  Row,
  Screen,
  SectionLabel,
} from '@/components/ui';
import { useSettings } from '@/state/settingsStore';
import { colors, space } from '@/theme';
import { getAppBaseUrl } from '@/util/appUrl';
import { confirm, notify } from '@/util/dialog';
import { buildJoinLink } from '@/util/joinLink';
import { formatShort } from '@/util/time';

/**
 * The admin console: who is on the squad, and what they have been doing.
 *
 * Only shown to admins, and only when the phone is signed in to an org. The two
 * things it exists for are the two a shared code cannot do — remove one person
 * without disturbing anyone else, and answer who generated a given narrative.
 */
export default function TeamScreen() {
  const account = useSettings((s) => s.account);
  const relayUrl = useSettings((s) => s.relayUrl);

  const [members, setMembers] = useState<Member[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setMembers(await listMembers());
      setError('');
    } catch (e) {
      setMembers([]);
      setError(e instanceof AccountError ? e.message : 'Could not reach your squad server.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!account || account.role !== 'admin') {
    return (
      <Screen>
        <Banner tone="info" title="Admins only">
          This screen manages who is on your squad. Ask your admin if you need something changed.
        </Banner>
      </Screen>
    );
  }

  const newInvite = async () => {
    const ok = await confirm({
      title: 'Create a new invite link?',
      message:
        'Any invite link you have already sent stops working immediately. People who have already joined are unaffected.',
      confirmLabel: 'Create',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const code = await rotateInvite('member');
      setInviteCode(code);
      const link = buildJoinLink(getAppBaseUrl(), {
        relayUrl: normalizeRelayUrl(relayUrl),
        inviteCode: code,
      });
      await Clipboard.setStringAsync(link);
      notify(
        'Invite link copied',
        'Send it to whoever is joining. They open it, type their name, and they are working — no key, no account to create.\n\nAnyone with the link can join until you replace it, so send it the way you would send a password.',
      );
    } catch (e) {
      notify('Could not create an invite', e instanceof AccountError ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const toggleMember = async (member: Member) => {
    const revoking = member.status === 'active';
    const ok = await confirm({
      title: revoking ? `Remove ${member.name}?` : `Restore ${member.name}?`,
      message: revoking
        ? 'Their app stops working immediately. Reports already on their phone stay there — this app cannot reach them.'
        : 'Their existing app starts working again.',
      confirmLabel: revoking ? 'Remove' : 'Restore',
      destructive: revoking,
    });
    if (!ok) return;

    try {
      await setMemberStatus(member.id, revoking ? 'revoked' : 'active');
      await load();
    } catch (e) {
      notify('Could not change that', e instanceof AccountError ? e.message : 'Try again.');
    }
  };

  const openAudit = async () => {
    setShowAudit((v) => !v);
    if (audit.length === 0) {
      try {
        setAudit(await fetchAudit());
      } catch {
        // The roster above already reports a connection problem; no need twice.
      }
    }
  };

  return (
    <Screen>
      <SectionLabel>{account.orgName}</SectionLabel>
      <Card>
        <Body>
          You are an admin. Everyone here shares one AI account — nobody needs a key, and you can
          remove any one person without affecting the others.
        </Body>
        <Button label="Create an invite link" onPress={newInvite} loading={busy} />
        {inviteCode ? (
          <Muted>
            Current code: <Muted style={s.code}>{inviteCode}</Muted> — already copied to your
            clipboard as a link.
          </Muted>
        ) : null}
      </Card>

      {error ? <Banner tone="danger" title="Could not load your squad">{error}</Banner> : null}

      <SectionLabel>People</SectionLabel>
      {members === null ? (
        <Card>
          <Loading label="Loading…" />
        </Card>
      ) : members.length === 0 ? (
        <Card>
          <Muted>Nobody has joined yet. Create an invite link above and send it out.</Muted>
        </Card>
      ) : (
        <Card>
          {members.map((member, i) => (
            <View key={member.id}>
              {i > 0 ? <Divider /> : null}
              <Row>
                <View style={s.flex}>
                  <Heading>
                    {member.name}
                    {member.role === 'admin' ? '  ·  admin' : ''}
                    {member.status === 'revoked' ? '  ·  removed' : ''}
                  </Heading>
                  <Muted>
                    {member.certLevel ? `${member.certLevel} · ` : ''}
                    {member.requests} narrative{member.requests === 1 ? '' : 's'}
                    {member.lastSeenAt ? ` · last used ${formatShort(member.lastSeenAt)}` : ''}
                  </Muted>
                </View>
                {member.id === account.memberId ? (
                  <Muted style={s.you}>you</Muted>
                ) : (
                  <Button
                    label={member.status === 'active' ? 'Remove' : 'Restore'}
                    variant={member.status === 'active' ? 'danger' : 'secondary'}
                    onPress={() => toggleMember(member)}
                  />
                )}
              </Row>
            </View>
          ))}
        </Card>
      )}

      <SectionLabel>Activity</SectionLabel>
      <Card>
        <Row>
          <View style={s.flex}>
            <Body>Who generated what, and when.</Body>
            <Muted>
              Records that a narrative was generated and by whom — never the notes, the narrative, or
              anything about a patient.
            </Muted>
          </View>
          <Button label={showAudit ? 'Hide' : 'Show'} variant="ghost" onPress={openAudit} />
        </Row>
        {showAudit ? (
          <>
            <Divider />
            {audit.length === 0 ? (
              <Muted>Nothing recorded yet.</Muted>
            ) : (
              audit.map((entry, i) => (
                <Muted key={`${entry.at}-${i}`}>
                  {formatShort(entry.at)} — {entry.name ?? 'someone'} · {describeAction(entry)}
                </Muted>
              ))
            )}
          </>
        ) : null}
      </Card>

      <Banner tone="warning" title="What this does not yet give you">
        A name here is what someone typed when they joined, not a verified identity, and the log
        lives on your relay rather than in a tamper-evident store. That is enough to run a squad and
        not enough for a compliance audit. Real patient data still needs a BAA first.
      </Banner>
    </Screen>
  );
}

function describeAction(entry: AuditEntry): string {
  switch (entry.action) {
    case 'narrative_generated':
      return `generated a narrative${entry.provider ? ` (${entry.provider})` : ''}`;
    case 'member_joined':
      return 'joined the squad';
    case 'member_revoked':
      return `removed ${entry.subject ?? 'someone'}`;
    case 'member_restored':
      return `restored ${entry.subject ?? 'someone'}`;
    case 'invite_rotated':
      return 'created a new invite link';
    case 'config_updated':
      return 'changed the squad settings';
    case 'org_created':
      return 'created the squad';
    default:
      return entry.action;
  }
}

const s = StyleSheet.create({
  flex: { flex: 1, gap: space.xs },
  code: { color: colors.accent },
  you: { color: colors.textFaint, marginLeft: space.sm },
});
