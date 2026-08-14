import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { AccountError, joinOrg } from '@/ai/account';
import { Banner, Body, Button, Card, Field, Muted, Screen, SectionLabel } from '@/components/ui';
import type { CertLevel } from '@/domain/types';
import { useSettings } from '@/state/settingsStore';
import { setMemberToken } from '@/storage/secure';
import { notify } from '@/util/dialog';

/**
 * Accepting an invite.
 *
 * The one screen in the app that asks for a name, and it earns the question:
 * everything this app records about who did what depends on the answer. A
 * shared code could never produce it.
 *
 * No password, no email, no verification code. For a crew of a dozen people
 * whose admin sent the link personally, an emailed round-trip would be friction
 * bought at the price of nothing — the invite link is already the credential.
 * What this buys over a shared code is that the resulting access belongs to one
 * person and can be taken away from them alone.
 */
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const relayUrl = useSettings((s) => s.relayUrl);
  const profile = useSettings((s) => s.profile);
  const { setAccount, applyOrgConfig, setProfile } = useSettings();

  const [name, setName] = useState('');
  const [certLevel, setCertLevel] = useState<CertLevel>(profile.certLevel);
  const [busy, setBusy] = useState(false);

  const inviteCode = (code ?? '').trim();

  const join = async () => {
    if (!name.trim()) {
      notify('Your name is needed', 'It is what the log uses to say who wrote a narrative.');
      return;
    }
    setBusy(true);
    try {
      const result = await joinOrg({ relayUrl, inviteCode, name: name.trim(), certLevel });
      await setMemberToken(result.token);
      setAccount(result.account);
      applyOrgConfig(result.account.orgName, result.config);
      setProfile({ certLevel });
      router.replace('/');
      notify(
        `Welcome, ${result.account.name}`,
        `You are signed in to ${result.account.orgName}. Nothing else to set up — start a report.\n\nStill practice data only: use fake patients.`,
      );
    } catch (error) {
      notify(
        'Could not join',
        error instanceof AccountError ? error.message : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!inviteCode) {
    return (
      <Screen>
        <Banner tone="danger" title="This invite is incomplete">
          The link did not carry an invite code. Ask whoever sent it for a fresh one.
        </Banner>
        <Button label="Go back" variant="secondary" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Screen
        footer={
          <Button
            label="Join"
            onPress={join}
            loading={busy}
            disabled={name.trim().length === 0}
          />
        }>
        <SectionLabel>Joining your squad</SectionLabel>
        <Card>
          <Body>
            You have been invited to a squad account. There is no API key to get and nothing to pay
            for — just tell the app who you are.
          </Body>
          <Field
            label="Your name"
            hint="Shown to your admin, and recorded against the narratives you generate."
            value={name}
            onChangeText={setName}
            placeholder="J. Rivera"
            autoCapitalize="words"
          />
          <Field
            label="Certification level"
            hint="Used to keep the narrative's scope of practice right."
            value={certLevel}
            onChangeText={(value) => setCertLevel(value as CertLevel)}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </Card>

        <Muted>
          Your reports never leave your phone. What your squad server knows about you is your name,
          your certification level, and how many narratives you have generated — never their
          contents.
        </Muted>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({ flex: { flex: 1 } });
