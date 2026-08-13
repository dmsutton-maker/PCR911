import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { describeError } from '@/ai/client';
import { exportNarrative, PRACTICE_BANNER } from '@/ai/narrative';
import {
  Banner,
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
import { generateForReport } from '@/features/generate';
import { useReports } from '@/state/reportStore';
import { currentAiConfig, useSettings } from '@/state/settingsStore';
import { colors, space, type } from '@/theme';
import { confirm, notify } from '@/util/dialog';
import { formatShort } from '@/util/time';

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const org = useSettings((s) => s.org);
  const profile = useSettings((s) => s.profile);
  const { current, open, update, remove } = useReports();

  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      if (current?.id !== id) await open(id);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!loaded) return <Screen><Loading label="Opening report…" /></Screen>;
  if (!current) {
    return (
      <Screen>
        <Banner tone="danger">That report could not be opened.</Banner>
      </Screen>
    );
  }

  const report = current;
  const openQuestions = report.followUps.filter((f) => f.state === 'open');
  const skipped = report.followUps.filter((f) => f.state === 'skipped');

  const copy = async () => {
    if (!report.narrative) return;
    await Clipboard.setStringAsync(exportNarrative(report.narrative, report.practiceMode));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const outcome = await generateForReport({
        report,
        org,
        profile,
        config: currentAiConfig(),
      });
      if (!outcome.onTopic) {
        notify('Could not regenerate', outcome.offTopicReason || 'Nothing was generated.');
        return;
      }
      await update(outcome.patch, 'Narrative regenerated');
    } catch (error) {
      notify('Could not regenerate', describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    const ok = await confirm({
      title: 'Delete this report?',
      message: 'The narrative, notes, and any recording are erased.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await remove(report.id);
    router.dismissTo('/');
  };

  return (
    <Screen
      footer={
        <>
          <Button
            label={copied ? 'Copied' : 'Copy narrative'}
            onPress={copy}
            disabled={!report.narrative}
          />
          <Row>
            <Button
              label="Clinical reference"
              variant="secondary"
              style={s.flex}
              onPress={() => router.push(`/report/${report.id}/reference`)}
            />
            <Button
              label="Regenerate"
              variant="secondary"
              style={s.flex}
              onPress={regenerate}
              loading={busy}
            />
          </Row>
        </>
      }>
      {report.practiceMode ? (
        <Banner tone="practice" title="Practice data">
          This narrative carries a training banner when copied and must not be filed as a record.
        </Banner>
      ) : null}

      {openQuestions.length > 0 ? (
        <Card>
          <Heading>
            {openQuestions.length} required specific{openQuestions.length === 1 ? '' : 's'} missing
          </Heading>
          <Muted>
            {report.org.name} requires{' '}
            {openQuestions.map((f) => f.label.toLowerCase()).join(', ')}.
          </Muted>
          <Button
            label="Answer follow-up questions"
            onPress={() => router.push(`/report/${report.id}/questions`)}
          />
        </Card>
      ) : (
        <Banner tone="success" title="Required specifics covered">
          Every specific {report.org.name} requires is addressed in this narrative.
        </Banner>
      )}

      {skipped.length > 0 ? (
        <Banner tone="warning" title={`${skipped.length} skipped`}>
          {skipped.map((f) => f.label).join(', ')} — documented as not recorded rather than filled
          in.
        </Banner>
      ) : null}

      <Card>
        <Row>
          <View style={s.flex}>
            <SectionLabel>{report.org.formatLabel} narrative</SectionLabel>
            <Muted>Generated {formatShort(report.updatedAt)}</Muted>
          </View>
        </Row>
        <Divider />
        {report.narrative ? (
          <>
            {report.practiceMode ? (
              <Text style={s.practiceBanner}>{PRACTICE_BANNER}</Text>
            ) : null}
            <Text selectable style={type.mono}>
              {report.narrative}
            </Text>
          </>
        ) : (
          <Muted>No narrative has been generated for this report yet.</Muted>
        )}
      </Card>

      <Card>
        <Row>
          <View style={s.flex}>
            <SectionLabel>Your original notes</SectionLabel>
            <Muted>Never rewritten — the source of everything above.</Muted>
          </View>
          <Button
            label={showNotes ? 'Hide' : 'Show'}
            variant="ghost"
            onPress={() => setShowNotes((v) => !v)}
          />
        </Row>
        {showNotes ? (
          <>
            <Divider />
            <Text selectable style={type.small}>
              {report.rawInput}
            </Text>
          </>
        ) : null}
      </Card>

      <Card>
        <SectionLabel>Activity</SectionLabel>
        {report.history.map((h, i) => (
          <Muted key={`${h.at}-${i}`}>
            {formatShort(h.at)} — {h.event}
          </Muted>
        ))}
      </Card>

      <Button label="Delete report" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, gap: space.xs },
  practiceBanner: { color: colors.practice, fontSize: 12, fontWeight: '700', marginBottom: space.sm },
});
