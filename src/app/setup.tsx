import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { AccountError, createOrg } from '@/ai/account';
import { checkRelay, normalizeRelayUrl } from '@/ai/connection';
import { Banner, Body, Button, Card, Field, Muted, Screen, SectionLabel } from '@/components/ui';
import { useSettings } from '@/state/settingsStore';
import { type as textStyles } from '@/theme';
import { setMemberToken } from '@/storage/secure';
import { getAppBaseUrl } from '@/util/appUrl';
import { notify } from '@/util/dialog';
import { buildJoinLink } from '@/util/joinLink';

/**
 * Creating a squad, once.
 *
 * This exists so that setting up an org is four boxes on a phone rather than a
 * hand-written HTTP request. The person doing it is a squad lead, not a
 * developer, and "paste this JavaScript into a browser console" is not a setup
 * step — it is a reason to give up.
 *
 * Reached by typing /setup after the relay is deployed. Not linked from
 * anywhere, because everyone except the one person creating the squad should
 * arrive through an invite instead.
 */
export default function SetupScreen() {
  const { setRelayUrl, setConnectionMode, setAccount } = useSettings();
  const existingRelay = useSettings((s) => s.relayUrl);

  const [relay, setRelay] = useState(existingRelay);
  const [bootstrapCode, setBootstrapCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const create = async () => {
    const url = normalizeRelayUrl(relay);
    if (!url || !bootstrapCode.trim() || !orgName.trim() || !adminName.trim()) {
      notify('Everything is needed', 'All four boxes have to be filled in.');
      return;
    }

    setBusy(true);
    try {
      // Check the address first, so a typo is caught here rather than looking
      // like a rejected setup code.
      const health = await checkRelay(url);
      if (!health.ok) {
        notify('That address did not answer', health.error ?? 'Check it and try again.');
        return;
      }

      const result = await createOrg({
        relayUrl: url,
        bootstrapCode: bootstrapCode.trim(),
        orgName: orgName.trim(),
        adminName: adminName.trim(),
      });

      await setMemberToken(result.token);
      setRelayUrl(url);
      setConnectionMode('relay');
      setAccount(result.account);
      setBootstrapCode('');

      const link = buildJoinLink(getAppBaseUrl(), {
        relayUrl: url,
        inviteCode: result.inviteCode,
      });
      setInviteLink(link);
      await Clipboard.setStringAsync(link);

      notify(
        `${result.account.orgName} is set up`,
        'You are signed in as its admin, and an invite link is on your clipboard. Send it to anyone who needs the app.',
      );
    } catch (error) {
      notify(
        'Could not create the squad',
        error instanceof AccountError ? error.message : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (inviteLink) {
    return (
      <Screen
        footer={
          <>
            <Button
              label="Copy the invite link again"
              onPress={async () => {
                await Clipboard.setStringAsync(inviteLink);
                notify('Copied', 'Send it the way you would send a password.');
              }}
            />
            <Button label="Done" variant="secondary" onPress={() => router.replace('/')} />
          </>
        }>
        <Banner tone="success" title="Your squad is ready">
          You are signed in as admin. Everything else is at Settings → Your squad.
        </Banner>
        <Card>
          <SectionLabel>Invite link</SectionLabel>
          <Text selectable style={textStyles.small}>
            {inviteLink}
          </Text>
          <Muted>
            Whoever opens this types their name and starts working — no key, no password, no
            account to create. Anyone holding the link can join until you replace it, so send it
            the way you would send a password.
          </Muted>
        </Card>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Screen footer={<Button label="Create the squad" onPress={create} loading={busy} />}>
        <SectionLabel>Create your squad</SectionLabel>
        <Card>
          <Body>
            Do this once, on the phone you want to administer from. Everyone else joins through a
            link you will get at the end.
          </Body>
          <Field
            label="Squad server address"
            hint="From the Deploy relay step. Looks like https://pcr-relay.something.workers.dev"
            value={relay}
            onChangeText={setRelay}
            placeholder="https://pcr-relay.workers.dev"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Setup code"
            hint="The BOOTSTRAP_CODE you put into GitHub secrets. Used only here, only once."
            value={bootstrapCode}
            onChangeText={setBootstrapCode}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Field
            label="Squad name"
            value={orgName}
            onChangeText={setOrgName}
            placeholder="Station 12"
            autoCapitalize="words"
          />
          <Field
            label="Your name"
            hint="You will be its first admin."
            value={adminName}
            onChangeText={setAdminName}
            placeholder="D. Sutton"
            autoCapitalize="words"
          />
        </Card>

        <Muted>
          Nothing about a patient ever reaches this server. It holds your squad&apos;s names, roles,
          and how many narratives each person has generated — never the narratives themselves.
        </Muted>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({ flex: { flex: 1 } });
