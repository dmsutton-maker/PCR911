import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  Banner,
  Body,
  Button,
  Card,
  Divider,
  Heading,
  ListRow,
  Muted,
  Row,
  Screen,
  SectionLabel,
  Title,
} from '@/components/ui';
import { isConfigured } from '@/ai/connection';
import { getFormat } from '@/domain/formats';
import type { CaptureMode } from '@/domain/types';
import { useReports } from '@/state/reportStore';
import { useSettings } from '@/state/settingsStore';
import { colors, space } from '@/theme';
import { formatShort } from '@/util/time';

const MODE_LABEL: Record<CaptureMode, string> = {
  bullets: 'Bullet notes',
  dictation: 'Dictation',
  live: 'Live recording',
};

export default function HomeScreen() {
  const org = useSettings((s) => s.org);
  const profile = useSettings((s) => s.profile);
  const practiceModeDefault = useSettings((s) => s.practiceModeDefault);
  const providerId = useSettings((s) => s.providerId);
  const connectionMode = useSettings((s) => s.connectionMode);
  const relayUrl = useSettings((s) => s.relayUrl);
  const { summaries, refresh } = useReports();
  const [ready, setReady] = useState<boolean | null>(null);

  // Both of these have to run on *focus*, not just on mount. Coming back from
  // Settings after adding a key changes nothing this screen renders from — the
  // credential lives in the keystore, not in the settings store — so a plain
  // effect leaves the "no API key" banner up over a key that is already saved.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void isConfigured(providerId).then(setReady);
    }, [refresh, providerId, connectionMode, relayUrl]),
  );

  const start = (mode: CaptureMode) => {
    if (mode === 'live') router.push('/capture/record');
    else router.push(`/capture/notes?mode=${mode}`);
  };

  return (
    <Screen>
      <Title>New report</Title>

      <Banner tone="warning" title="Practice data only">
        {Platform.OS === 'web'
          ? 'This is the web version. Notes are stored unencrypted in this browser and are not protected the way the installed app protects them. Use fake patients only.'
          : 'This build has no HIPAA-eligible path in place. Use fake patients only. See the README before entering anything real.'}
      </Banner>

      {ready === false ? (
        <Banner
          tone="danger"
          title={connectionMode === 'relay' ? 'Not connected yet' : 'No API key set'}>
          {connectionMode === 'relay'
            ? 'Open the invite link you were sent, or enter the address and squad code at Settings → AI provider. You can still capture and save notes without it.'
            : 'Narrative generation needs an API key. Add a free Google Gemini key in Settings → AI provider, or switch to a squad account. You can still capture and save notes without it.'}
        </Banner>
      ) : null}

      {/* Two ways in, not three. "Bullet notes" and "post-call dictation" led to
          the same screen and differed only in placeholder text, which is a
          distinction for whoever wrote the app rather than for whoever is
          standing in a bay at end of shift. */}
      <Card>
        <Body>What happened on the call?</Body>
        <Button label="Write or dictate notes" onPress={() => start('bullets')} />
        <Button label="Record during the call" variant="secondary" onPress={() => start('live')} />
        <Muted>
          {Platform.OS === 'web'
            ? 'Type, or tap the microphone on your keyboard and talk. Recording transcribes you live as you speak. Nothing is sent anywhere until you generate a narrative.'
            : 'Type, or tap the microphone on your keyboard and talk — that transcribes on this phone. Recording does the same, live, while the call is happening. Nothing is sent anywhere until you generate a narrative.'}
        </Muted>
      </Card>

      <Card>
        <Row>
          <View style={s.flex}>
            <Heading>{org.name}</Heading>
            <Muted>
              {getFormat(org.formatId).label} format ·{' '}
              {org.requiredSpecifics.filter((r) => r.enabled).length} required specifics ·{' '}
              {profile.certLevel}
              {profile.state ? ` · ${profile.state}` : ''}
            </Muted>
          </View>
          <Button label="Settings" variant="ghost" onPress={() => router.push('/settings')} />
        </Row>
        {practiceModeDefault ? (
          <Muted style={s.practice}>New reports are marked as practice data.</Muted>
        ) : null}
      </Card>

      <SectionLabel>Recent</SectionLabel>
      {summaries.length === 0 ? (
        <Card>
          <Muted>
            No reports yet.{' '}
            {Platform.OS === 'web'
              ? 'Everything you capture stays in this browser.'
              : 'Everything you capture stays encrypted on this device.'}
          </Muted>
        </Card>
      ) : (
        <Card>
          {summaries.slice(0, 25).map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={r.preview || 'Untitled capture'}
                subtitle={`${formatShort(r.updatedAt)} · ${MODE_LABEL[r.captureMode]}${
                  r.practiceMode ? ' · practice' : ''
                }${
                  r.status === 'awaiting_answers'
                    ? ` · ${r.openQuestionCount} question${r.openQuestionCount === 1 ? '' : 's'} open`
                    : r.status === 'capturing'
                      ? ' · draft'
                      : ''
                }`}
                onPress={() => {
                  if (r.status === 'capturing') router.push(`/capture/notes?id=${r.id}`);
                  else router.push(`/report/${r.id}`);
                }}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, gap: space.xs },
  practice: { color: colors.practice },
});
