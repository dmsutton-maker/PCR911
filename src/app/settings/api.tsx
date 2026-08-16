import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from 'react-native';

import { describeBakedConfig } from '@/ai/bakedConfig';
import {
  checkRelay,
  type ConnectionMode,
  normalizeRelayUrl,
  type RelayHealth,
} from '@/ai/connection';
import { getProvider, PROVIDERS, type ProviderId } from '@/ai/providers';
import {
  Banner,
  Body,
  Button,
  Card,
  Divider,
  Field,
  ListRow,
  Muted,
  Screen,
  SectionLabel,
} from '@/components/ui';
import { useSettings } from '@/state/settingsStore';
import {
  clearAccessCode,
  clearApiKey,
  getAccessCode,
  getApiKey,
  setAccessCode,
  setApiKey,
} from '@/storage/secure';
import { colors, space } from '@/theme';
import { getAppBaseUrl } from '@/util/appUrl';
import { confirm, notify } from '@/util/dialog';
import { buildJoinLink } from '@/util/joinLink';

const MODES: { id: ConnectionMode; title: string; subtitle: string }[] = [
  {
    id: 'relay',
    title: 'Squad account',
    subtitle: 'One shared account for the whole crew. Nobody needs an API key.',
  },
  {
    id: 'own_key',
    title: 'My own API key',
    subtitle: 'This phone talks to the AI provider directly. One person, one key.',
  },
];

export default function ApiScreen() {
  const {
    providerId,
    modelByProvider,
    connectionMode,
    relayUrl,
    account,
    setProviderId,
    setModel,
    setConnectionMode,
    setRelayUrl,
  } = useSettings();

  const [key, setKey] = useState('');
  const [storedKeys, setStoredKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const [urlDraft, setUrlDraft] = useState(relayUrl);
  const [codeDraft, setCodeDraft] = useState('');
  const [hasCode, setHasCode] = useState(false);
  const [health, setHealth] = useState<RelayHealth | null>(null);
  const [checking, setChecking] = useState(false);

  const bakedSummary = describeBakedConfig();
  const provider = getProvider(providerId);
  const selectedModel = modelByProvider[providerId] || provider.defaultModel;
  const hasStoredKey = storedKeys[providerId] ?? false;
  const relayReady = !!normalizeRelayUrl(relayUrl) && hasCode;

  const refresh = async () => {
    const entries = await Promise.all(
      PROVIDERS.map(async (p) => [p.id, !!(await getApiKey(p.id))] as const),
    );
    setStoredKeys(Object.fromEntries(entries));
    setHasCode(!!(await getAccessCode()));
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    setKey('');
  }, [providerId]);

  useEffect(() => {
    setUrlDraft(relayUrl);
  }, [relayUrl]);

  /* ---------------- squad relay ---------------- */

  const saveRelay = async () => {
    const url = normalizeRelayUrl(urlDraft);
    if (!url) {
      notify('Enter the relay address', 'It looks like https://pcr-relay.<something>.workers.dev');
      return;
    }

    setChecking(true);
    try {
      // Check before saving. A typo that gets stored quietly turns into a
      // baffling failure later, when the user is mid-report.
      const result = await checkRelay(url);
      setHealth(result);
      if (!result.ok) {
        notify('That address did not answer', result.error ?? 'Check it and try again.');
        return;
      }

      setRelayUrl(url);
      if (codeDraft.trim()) {
        await setAccessCode(codeDraft.trim());
        setCodeDraft('');
      }
      setConnectionMode('relay');
      await refresh();
      notify('Connected', 'The squad account is set up. Nothing else to enter.');
    } finally {
      setChecking(false);
    }
  };

  const testRelay = async () => {
    setChecking(true);
    try {
      setHealth(await checkRelay(urlDraft || relayUrl));
    } finally {
      setChecking(false);
    }
  };

  const copyInvite = async () => {
    const code = await getAccessCode();
    if (!code) return;
    const link = buildJoinLink(getAppBaseUrl(), { relayUrl: normalizeRelayUrl(relayUrl), code });
    await Clipboard.setStringAsync(link);
    notify(
      'Invite link copied',
      'Send it to whoever needs the app. They open it on their iPhone in Safari, tap Share → Add to Home Screen, and they are done — no key, no account.\n\nThe link contains the squad code, so send it the way you would send a password.',
    );
  };

  const forgetRelay = async () => {
    const ok = await confirm({
      title: 'Disconnect from the squad account?',
      message: 'Narrative generation will stop working until you reconnect or add your own API key.',
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!ok) return;
    await clearAccessCode();
    setRelayUrl('');
    setHealth(null);
    setConnectionMode('own_key');
    await refresh();
  };

  /* ---------------- personal key ---------------- */

  const saveKey = async () => {
    const trimmed = key.trim();
    if (!trimmed) return;

    // Only warn about a mistake we can actually be confident of: a key that
    // belongs to a different provider on the list. Warning because a key does
    // not match this provider's known prefixes is how people got told their
    // perfectly good key was wrong when Google changed its format.
    const belongsElsewhere = PROVIDERS.find(
      (p) => p.id !== provider.id && p.keyPrefixes.some((prefix) => trimmed.startsWith(prefix)),
    );
    if (belongsElsewhere) {
      const ok = await confirm({
        title: `That key belongs to ${belongsElsewhere.label}`,
        message: `You are saving it as your ${provider.label} key, so generation will fail. Switch to ${belongsElsewhere.label} above, or save it here anyway.`,
        confirmLabel: 'Save anyway',
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      await setApiKey(providerId, trimmed);
      // Read it back before claiming success. Saying "Saved" over a write that
      // did not happen sends people looking for a problem in their key.
      if (!(await getApiKey(providerId))) {
        throw new Error('The key did not stay saved.');
      }
      setKey('');
      await refresh();
      notify('Saved', `${provider.label} is ready. Generation should work now.`);
    } catch (error) {
      notify(
        'Could not save the key',
        error instanceof Error ? error.message : 'Storage rejected the write.',
      );
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async () => {
    const ok = await confirm({
      title: `Remove the ${provider.label} key?`,
      message: 'Narrative generation will stop working until you add another.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    await clearApiKey(providerId);
    await refresh();
  };

  const relayMissingProvider =
    health?.ok && health.providers.length > 0 && !health.providers.includes(providerId);

  // The real lock. The Settings screen already hides the link here for anyone
  // who is not a squad admin, but a link is only ever a suggestion — this is
  // what actually stops someone who navigates here directly (a bookmark, a
  // typed URL, an old link) from switching providers, swapping in their own
  // key, or pointing the app at a different relay. On a preconfigured build,
  // only a signed-in admin gets past this.
  if (bakedSummary && account?.role !== 'admin') {
    return (
      <Screen>
        <Banner tone="info" title="Managed for you">
          {bakedSummary} There is nothing to set up here, and this screen is locked so it cannot be
          changed by mistake.
        </Banner>
        <Muted>
          If something is not working, tell whoever set this up for you rather than trying to fix
          it here.
        </Muted>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Screen>
        {bakedSummary ? (
          <Banner tone="info" title="Already set up">
            {bakedSummary} Everything below overrides that for this phone only — leave it alone
            unless something is broken.
          </Banner>
        ) : null}

        <SectionLabel>How this phone connects</SectionLabel>
        <Card>
          {MODES.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={m.title}
                subtitle={m.subtitle}
                onPress={() => setConnectionMode(m.id)}
                right={
                  connectionMode === m.id ? <Muted style={s.selected}>In use</Muted> : undefined
                }
              />
            </View>
          ))}
        </Card>

        {connectionMode === 'relay' ? (
          <>
            <SectionLabel>Squad account</SectionLabel>
            <Card>
              <Body>
                {relayReady
                  ? 'This phone is connected. There is no API key to get and nothing to pay for.'
                  : 'Paste the address and code you were given, or open the invite link you were sent and this fills itself in.'}
              </Body>
              <Field
                label="Relay address"
                hint="Looks like https://pcr-relay.something.workers.dev"
                value={urlDraft}
                onChangeText={setUrlDraft}
                placeholder="https://pcr-relay.workers.dev"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Field
                label={hasCode ? 'Replace squad code' : 'Squad code'}
                hint={
                  Platform.OS === 'web'
                    ? 'Stored in this browser only. Sent to your relay, never to the AI provider.'
                    : 'Stored in the device keychain, never in app storage or reports.'
                }
                value={codeDraft}
                onChangeText={setCodeDraft}
                placeholder={hasCode ? '••••••••' : 'the code you were given'}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <Button label="Connect" onPress={saveRelay} loading={checking} />
              <Button label="Test connection" variant="secondary" onPress={testRelay} />
              {relayReady ? (
                <Button label="Copy invite link" variant="secondary" onPress={copyInvite} />
              ) : null}
              {relayReady || hasCode ? (
                <Button label="Disconnect" variant="danger" onPress={forgetRelay} />
              ) : null}
            </Card>

            {health ? (
              <Banner
                tone={health.ok ? 'info' : 'danger'}
                title={health.ok ? 'Relay reachable' : 'Relay not reachable'}>
                {health.ok
                  ? health.providers.length
                    ? `It has keys for: ${health.providers.join(', ')}.`
                    : 'It answered, but no provider key is configured on it yet.'
                  : (health.error ?? 'No answer.')}
              </Banner>
            ) : null}

            {relayMissingProvider ? (
              <Banner tone="warning" title={`No ${provider.label} key on that relay`}>
                The relay is running but has no key for {provider.label}, so generation will fail
                until whoever runs it adds one — or you pick a provider it does have below.
              </Banner>
            ) : null}

            <Banner tone="warning" title="Still practice data only">
              A relay fixes who holds the key, which is a prerequisite for handling real patient
              information — not permission to. That still needs a signed BAA and a HIPAA-eligible
              provider configuration. Until then, fake patients.
            </Banner>
          </>
        ) : null}

        <SectionLabel>Provider</SectionLabel>
        <Card>
          {PROVIDERS.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={`${p.label}${p.free ? '  ·  FREE' : ''}`}
                subtitle={p.blurb}
                onPress={() => setProviderId(p.id as ProviderId)}
                right={
                  <Muted style={providerId === p.id ? s.selected : s.unselected}>
                    {providerId === p.id
                      ? 'In use'
                      : connectionMode === 'own_key' && storedKeys[p.id]
                        ? 'key set'
                        : ''}
                  </Muted>
                }
              />
            </View>
          ))}
        </Card>

        <Banner tone={provider.free ? 'warning' : 'info'} title="How this provider treats your data">
          {provider.privacyNote}
        </Banner>

        {connectionMode === 'own_key' ? (
          <>
            <SectionLabel>API key</SectionLabel>
            <Card>
              <Body>
                {hasStoredKey
                  ? `A ${provider.label} key is stored on this device.`
                  : `No ${provider.label} key stored yet.`}
              </Body>
              <Field
                label={hasStoredKey ? 'Replace key' : 'Paste your key'}
                hint={
                  Platform.OS === 'web'
                    ? 'Stored in this browser only. Never sent anywhere except to the provider.'
                    : 'Stored in the device keychain. Never written to app storage, logs, or reports.'
                }
                value={key}
                onChangeText={setKey}
                placeholder={provider.keyPrefixes.map((p) => `${p}...`).join('  or  ')}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <Button
                label={hasStoredKey ? 'Replace key' : 'Save key'}
                onPress={saveKey}
                loading={saving}
                disabled={key.trim().length === 0}
              />
              <Button
                label={`Get a key — ${provider.keyUrlLabel}`}
                variant="secondary"
                onPress={() => void Linking.openURL(provider.keyUrl)}
              />
              {hasStoredKey ? (
                <Button label="Remove stored key" variant="danger" onPress={removeKey} />
              ) : null}
            </Card>
            {Platform.OS === 'web' ? (
              <Banner tone="info" title="Enter it where you use it">
                iOS keeps separate storage for Safari and for an app added to your home screen. A
                key saved in one does not appear in the other — so if you use the home-screen icon,
                save the key from the home-screen icon.
              </Banner>
            ) : null}

            <Muted>
              A key on a phone cannot be rotated, scoped to one person, or revoked when the phone is
              lost. That is fine while you are the only user and is the reason the squad account
              exists once you are not.
            </Muted>
          </>
        ) : null}

        <SectionLabel>Model</SectionLabel>
        <Card>
          {provider.models.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={m.label}
                subtitle={m.note ?? m.id}
                onPress={() => setModel(providerId, m.id)}
                right={
                  selectedModel === m.id ? <Muted style={s.selected}>Selected</Muted> : undefined
                }
              />
            </View>
          ))}
        </Card>
        <Card>
          <Field
            label="Or type a model name"
            hint="Providers rename and retire models. If the list is out of date, put the exact id here."
            value={selectedModel}
            onChangeText={(value) => setModel(providerId, value)}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  selected: { color: colors.accent, marginLeft: space.sm },
  unselected: { color: colors.textFaint, marginLeft: space.sm },
});
