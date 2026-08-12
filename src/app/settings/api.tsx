import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from 'react-native';

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
import { clearApiKey, getApiKey, setApiKey } from '@/storage/secure';
import { colors, space } from '@/theme';
import { confirm, notify } from '@/util/dialog';

export default function ApiScreen() {
  const { providerId, modelByProvider, setProviderId, setModel } = useSettings();
  const [key, setKey] = useState('');
  const [storedKeys, setStoredKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const provider = getProvider(providerId);
  const selectedModel = modelByProvider[providerId] || provider.defaultModel;
  const hasStoredKey = storedKeys[providerId] ?? false;

  const refreshKeys = async () => {
    const entries = await Promise.all(
      PROVIDERS.map(async (p) => [p.id, !!(await getApiKey(p.id))] as const),
    );
    setStoredKeys(Object.fromEntries(entries));
  };

  useEffect(() => {
    void refreshKeys();
  }, []);

  useEffect(() => {
    setKey('');
  }, [providerId]);

  const persist = async (value: string) => {
    setSaving(true);
    try {
      await setApiKey(providerId, value);
      setKey('');
      await refreshKeys();
      notify('Saved', `${provider.label} is ready. Generation should work now.`);
    } catch {
      notify('Could not save', 'Storage rejected the write.');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    if (provider.keyPrefix && !trimmed.startsWith(provider.keyPrefix)) {
      const ok = await confirm({
        title: `That does not look like a ${provider.label} key`,
        message: `${provider.label} keys normally start with "${provider.keyPrefix}". Save it anyway?`,
        confirmLabel: 'Save anyway',
      });
      if (!ok) return;
    }
    await persist(trimmed);
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Remove the ${provider.label} key?`,
      message: 'Narrative generation will stop working until you add another.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    await clearApiKey(providerId);
    await refreshKeys();
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Screen>
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
                    {providerId === p.id ? 'In use' : storedKeys[p.id] ? 'key set' : ''}
                  </Muted>
                }
              />
            </View>
          ))}
        </Card>

        <Banner tone={provider.free ? 'warning' : 'info'} title="How this provider treats your data">
          {provider.privacyNote}
        </Banner>

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
            placeholder={`${provider.keyPrefix}...`}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Button
            label={hasStoredKey ? 'Replace key' : 'Save key'}
            onPress={save}
            loading={saving}
            disabled={key.trim().length === 0}
          />
          <Button
            label={`Get a key — ${provider.keyUrlLabel}`}
            variant="secondary"
            onPress={() => void Linking.openURL(provider.keyUrl)}
          />
          {hasStoredKey ? (
            <Button label="Remove stored key" variant="danger" onPress={remove} />
          ) : null}
        </Card>

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
