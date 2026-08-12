import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { describeError } from '@/ai/client';
import {
  Banner,
  Button,
  Card,
  Divider,
  Field,
  Loading,
  Muted,
  Row,
  Screen,
} from '@/components/ui';
import type { FollowUp } from '@/domain/types';
import { generateForReport } from '@/features/generate';
import { useReports } from '@/state/reportStore';
import { useSettings } from '@/state/settingsStore';
import { colors, space } from '@/theme';

/**
 * The follow-up step.
 *
 * These questions come from the org's required-specifics list, and only for the
 * items the model judged missing or unclear in what the provider actually
 * supplied — anything already covered is never asked about.
 */
export default function QuestionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const org = useSettings((s) => s.org);
  const profile = useSettings((s) => s.profile);
  const modelId = useSettings((s) => s.modelId);
  const { current, open, update } = useReports();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const report = current?.id === id ? current : await open(id);
      if (report) {
        setAnswers(
          Object.fromEntries(report.followUps.map((f) => [f.specificId, f.answer])),
        );
      }
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

  const openQuestions = current.followUps.filter((f) => f.state === 'open');
  const settled = current.followUps.filter((f) => f.state !== 'open');
  const answeredCount = openQuestions.filter((f) => (answers[f.specificId] ?? '').trim()).length;

  const applyStates = (skipUnanswered: boolean): FollowUp[] =>
    current.followUps.map((f) => {
      if (f.state !== 'open') return f;
      const answer = (answers[f.specificId] ?? '').trim();
      if (answer) return { ...f, answer, state: 'answered' as const };
      return skipUnanswered ? { ...f, state: 'skipped' as const } : f;
    });

  const regenerate = async (skipUnanswered: boolean) => {
    setBusy(true);
    try {
      const withAnswers = await update(
        { followUps: applyStates(skipUnanswered) },
        skipUnanswered
          ? 'Follow-up answers saved; remaining questions skipped'
          : 'Follow-up answers saved',
      );
      if (!withAnswers) return;

      const outcome = await generateForReport({
        report: withAnswers,
        org,
        profile,
        modelId,
      });
      if (!outcome.onTopic) {
        Alert.alert('Could not update', outcome.offTopicReason || 'Nothing was generated.');
        return;
      }

      await update(outcome.patch, 'Narrative updated with follow-up answers');
      router.replace(`/report/${current.id}`);
    } catch (error) {
      Alert.alert('Could not update the narrative', describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleDone = () => {
    const remaining = openQuestions.length - answeredCount;
    if (remaining === 0) {
      void regenerate(false);
      return;
    }
    Alert.alert(
      `${remaining} question${remaining === 1 ? '' : 's'} unanswered`,
      'Unanswered items will be marked as skipped. The narrative will state that they were not documented rather than inventing them.',
      [
        { text: 'Keep answering', style: 'cancel' },
        { text: 'Skip and update', onPress: () => void regenerate(true) },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Screen
        footer={
          <>
            <Button
              label={
                answeredCount === openQuestions.length
                  ? 'Update narrative'
                  : `Update narrative (${answeredCount}/${openQuestions.length} answered)`
              }
              onPress={handleDone}
              loading={busy}
            />
            <Button
              label="Skip for now"
              variant="ghost"
              onPress={() => router.replace(`/report/${current.id}`)}
            />
          </>
        }>
        {openQuestions.length === 0 ? (
          <Banner tone="success" title="Nothing outstanding">
            Every required specific for {current.org.name} is covered.
          </Banner>
        ) : (
          <Banner tone="info" title={`${openQuestions.length} required specifics missing`}>
            These come from {current.org.name}&apos;s required-specifics list. Answering is
            optional — anything you skip will be documented as not recorded, never guessed.
          </Banner>
        )}

        {openQuestions.map((f) => (
          <Card key={f.specificId}>
            <Muted style={s.label}>{f.label.toUpperCase()}</Muted>
            <Field
              label={f.question}
              value={answers[f.specificId] ?? ''}
              onChangeText={(v) => setAnswers((a) => ({ ...a, [f.specificId]: v }))}
              multiline
              autoCapitalize="sentences"
              placeholder="Type or dictate your answer"
              style={s.input}
            />
          </Card>
        ))}

        {settled.length > 0 ? (
          <Card>
            <Muted style={s.label}>ALREADY HANDLED</Muted>
            {settled.map((f, i) => (
              <View key={f.specificId}>
                {i > 0 ? <Divider /> : null}
                <Row style={s.settledRow}>
                  <View style={s.flex}>
                    <Muted>{f.label}</Muted>
                    <Muted style={f.state === 'skipped' ? s.skipped : s.answered}>
                      {f.state === 'skipped' ? 'Skipped — documented as not recorded' : f.answer}
                    </Muted>
                  </View>
                </Row>
              </View>
            ))}
          </Card>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  label: { letterSpacing: 0.8, fontSize: 11 },
  input: { minHeight: 90 },
  settledRow: { paddingVertical: space.sm },
  skipped: { color: colors.warning },
  answered: { color: colors.text },
});
