import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

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
import { AVAILABLE_MODELS } from '@/domain/defaults';
import { useSettings } from '@/state/settingsStore';
import { clearApiKey, getApiKey, setApiKey } from '@/storage/secure';
import { colors, space } from '@/theme';
import { confirm, notify } from '@/util/dialog';

export default function ApiScreen() {
  const { modelId, setModelId } = useSettings();
  const [key, setKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getApiKey().then((k) => setHasStoredKey(!!k));
  }, []);

  const save = async () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('sk-ant-')) {
      const ok = await confirm({
        title: 'That does not look like an Anthropic key',
        message: 'Anthropic API keys start with "sk-ant-". Save it anyway?',
        confirmLabel: 'Save anyway',
      });
      if (!ok) return;
    }
    await persist(trimmed);
  };

  const persist = async (value: string) => {
    setSaving(true);
    try {
      await setApiKey(value);
      setKey('');
      setHasStoredKey(true);
      notify('Saved', Platform.OS === 'web'
        ? 'The key is stored in this browser. Generation should work now.'
        : 'The key is stored in the device keychain, not in app storage.');
    } catch {
      notify('Could not save', 'Storage rejected the write.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Remove the stored key?',
      message: 'Narrative generation will stop working until you add another.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    await clearApiKey();
    setHasStoredKey(false);
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Screen>
        <Banner tone="warning" title="Direct-to-API is a test-build arrangement">
          The app calls the Claude API straight from this phone using the key below. That is fine
          for practice data. Before any real patient information is entered, requests need to go
          through a backend you control under a signed BAA — see docs/SECURITY-PHI.md.
        </Banner>

        <Card>
          <SectionLabel>API key</SectionLabel>
          <Body>
            {hasStoredKey === null
              ? 'Checking…'
              : hasStoredKey
                ? 'A key is stored in the device keychain.'
                : 'No key stored yet.'}
          </Body>
          <Field
            label={hasStoredKey ? 'Replace key' : 'Paste your key'}
            hint="Stored in the iOS keychain with device-only accessibility. Never written to app storage, logs, or reports."
            value={key}
            onChangeText={setKey}
            placeholder="sk-ant-..."
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
          {hasStoredKey ? (
            <Button label="Remove stored key" variant="danger" onPress={remove} />
          ) : null}
          <Muted>
            Create a key at console.anthropic.com. Use a key scoped to a workspace with a spend
            limit — it is sitting on a phone.
          </Muted>
        </Card>

        <SectionLabel>Model</SectionLabel>
        <Card>
          {AVAILABLE_MODELS.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={m.label}
                subtitle={m.blurb}
                onPress={() => setModelId(m.id)}
                right={modelId === m.id ? <Muted style={s.selected}>Selected</Muted> : undefined}
              />
            </View>
          ))}
        </Card>
        <Muted>
          Narrative generation runs at medium reasoning effort; the clinical reference lookup runs
          at low. See docs/MODEL-RECOMMENDATIONS.md for the reasoning.
        </Muted>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  selected: { color: colors.accent, marginLeft: space.sm },
});
