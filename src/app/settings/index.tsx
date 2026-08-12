import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Divider,
  ListRow,
  Muted,
  Screen,
  SectionLabel,
  Toggle,
} from '@/components/ui';
import { describeConnection, isConfigured } from '@/ai/connection';
import { getProvider } from '@/ai/providers';
import { getFormat } from '@/domain/formats';
import { useReports } from '@/state/reportStore';
import { useSettings } from '@/state/settingsStore';
import { confirm, notify } from '@/util/dialog';

export default function SettingsScreen() {
  const {
    org,
    profile,
    providerId,
    modelByProvider,
    connectionMode,
    relayUrl,
    appLockEnabled,
    practiceModeDefault,
    setAppLockEnabled,
    setPracticeModeDefault,
  } = useSettings();
  const { eraseAll } = useReports();
  const [ready, setReady] = useState<boolean | null>(null);

  const provider = getProvider(providerId);
  const model = modelByProvider[providerId] || provider.defaultModel;

  useEffect(() => {
    void isConfigured(providerId).then(setReady);
  }, [providerId, connectionMode, relayUrl]);

  const confirmErase = async () => {
    const ok = await confirm({
      title: 'Erase all data?',
      message:
        'Every report, recording, and the encryption key itself are destroyed. Anything already written to disk becomes permanently unreadable. This cannot be undone.',
      confirmLabel: 'Erase everything',
      destructive: true,
    });
    if (!ok) return;
    await eraseAll();
    notify('Erased', 'All reports and the encryption key have been destroyed.');
    router.dismissTo('/');
  };

  return (
    <Screen>
      <SectionLabel>Organization</SectionLabel>
      <Card>
        <ListRow
          title={org.name}
          subtitle={`${getFormat(org.formatId).label} format · house style ${
            org.houseStyle.trim() ? 'set' : 'not set'
          }`}
          onPress={() => router.push('/settings/organization')}
        />
        <Divider />
        <ListRow
          title="Required specifics"
          subtitle={`${org.requiredSpecifics.filter((r) => r.enabled).length} of ${
            org.requiredSpecifics.length
          } enabled`}
          onPress={() => router.push('/settings/specifics')}
        />
      </Card>

      <SectionLabel>Provider</SectionLabel>
      <Card>
        <ListRow
          title="Provider profile"
          subtitle={`${profile.certLevel}${profile.state ? ` · ${profile.state}` : ' · no state set'}${
            profile.unitId ? ` · ${profile.unitId}` : ''
          }`}
          onPress={() => router.push('/settings/profile')}
        />
        <Divider />
        <ListRow
          title="Protocol reference"
          subtitle="Not built yet — highest-risk feature, deliberately last"
          onPress={() => router.push('/settings/protocols')}
        />
      </Card>

      <SectionLabel>AI provider</SectionLabel>
      <Card>
        <ListRow
          title={`${provider.label}${provider.free ? '  ·  FREE' : ''}`}
          subtitle={`${describeConnection(connectionMode, ready)} · ${model}`}
          onPress={() => router.push('/settings/api')}
        />
      </Card>

      <SectionLabel>Security</SectionLabel>
      <Card>
        <Toggle
          label="Require Face ID to open"
          description="Also clears the decryption key from memory whenever the app is backgrounded."
          value={appLockEnabled}
          onValueChange={setAppLockEnabled}
        />
        <Divider />
        <Toggle
          label="Mark new reports as practice data"
          description="Stamps generated narratives with a training banner. Leave on until a HIPAA-eligible path is confirmed."
          value={practiceModeDefault}
          onValueChange={setPracticeModeDefault}
        />
      </Card>

      <Banner tone="warning" title="Before entering real patient information">
        Narrative generation sends your notes to {provider.label}.
        {provider.free
          ? ' Free tiers generally allow the provider to train on what you send, so this one is for fake patients only.'
          : ''}{' '}
        Real PHI must not be entered until a BAA and a HIPAA-eligible configuration are in place.
        See docs/SECURITY-PHI.md.
      </Banner>

      <View>
        <Button label="Erase all data on this device" variant="danger" onPress={confirmErase} />
        <Muted>
          Destroys every report, every recording, and the encryption key. Settings are kept.
        </Muted>
      </View>
    </Screen>
  );
}
