import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { getFormat } from '@/domain/formats';
import type { CaptureMode } from '@/domain/types';
import { useReports } from '@/state/reportStore';
import { useSettings } from '@/state/settingsStore';
import { getApiKey } from '@/storage/secure';
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
  const { summaries, refresh } = useReports();
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    void getApiKey(providerId).then((k) => setHasApiKey(!!k));
  }, [providerId, summaries.length]);

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

      {hasApiKey === false ? (
        <Banner tone="danger" title="No API key set">
          Narrative generation needs an API key. Add a free Google Gemini key in Settings → AI
          provider. You can still capture and save notes without it.
        </Banner>
      ) : null}

      <Card>
        <Body>Start a report by capturing what happened on the call.</Body>
        <Button label="Type or dictate bullet notes" onPress={() => start('bullets')} />
        <Button
          label="Post-call dictation"
          variant="secondary"
          onPress={() => start('dictation')}
        />
        <Button label="Record during the call" variant="secondary" onPress={() => start('live')} />
        <Muted>
          {Platform.OS === 'web'
            ? 'Recording transcribes your speech live as you talk. Nothing is sent to the AI provider until you generate a narrative.'
            : 'Dictation uses the keyboard microphone, which transcribes on-device. Nothing is sent anywhere until you generate a narrative.'}
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
