import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { describeError } from '@/ai/client';
import {
  Banner,
  Button,
  Card,
  Field,
  Muted,
  Row,
  Screen,
  Toggle,
} from '@/components/ui';
import type { CaptureMode, Report } from '@/domain/types';
import { generateForReport } from '@/features/generate';
import { checkScope } from '@/safety/scopeGuard';
import { useReports } from '@/state/reportStore';
import { useSettings } from '@/state/settingsStore';
import { space } from '@/theme';

const PLACEHOLDER: Record<CaptureMode, string> = {
  bullets: `- 58 yo M, chest pain onset 0730 while shoveling
- 8/10 crushing, radiates L arm, diaphoretic
- hx HTN, MI 2019. meds lisinopril, ASA. NKDA
- 324 ASA given 0742, 12-lead no STEMI
- BP 148/92 P 96 R 20 SpO2 96% RA @0740
- transported priority 2 to Mercy, semi-Fowler's`,
  dictation: `Tap the microphone on your keyboard and talk through the call the way you'd hand it off: dispatch, what you found, what the patient told you, your assessment, vitals with times, what you did, how they responded, and where you took them.`,
  live: '',
};

const HINT: Record<CaptureMode, string> = {
  bullets: 'Short fragments are fine. Times, doses, and numbers are what matter most.',
  dictation: 'Use the keyboard microphone to dictate. Transcription happens on-device.',
  live: '',
};

export default function NotesScreen() {
  const params = useLocalSearchParams<{ mode?: string; id?: string }>();
  const navigation = useNavigation();

  const org = useSettings((s) => s.org);
  const profile = useSettings((s) => s.profile);
  const modelId = useSettings((s) => s.modelId);
  const practiceModeDefault = useSettings((s) => s.practiceModeDefault);

  const { current, startReport, open, update, remove } = useReports();

  const [text, setText] = useState('');
  const [practiceMode, setPracticeMode] = useState(practiceModeDefault);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const createdId = useRef<string | null>(null);

  const mode: CaptureMode =
    params.mode === 'dictation' ? 'dictation' : params.mode === 'live' ? 'live' : 'bullets';

  useEffect(() => {
    navigation.setOptions({
      title: mode === 'dictation' ? 'Post-call dictation' : 'Bullet notes',
    });
  }, [navigation, mode]);

  // Either resume an existing draft or start a new one.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let report: Report | null;
      if (params.id) {
        report = await open(params.id);
      } else {
        report = await startReport({ org, captureMode: mode, practiceMode: practiceModeDefault });
        createdId.current = report.id;
      }
      if (cancelled || !report) return;
      setText(report.rawInput);
      setPracticeMode(report.practiceMode);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per screen mount; org/mode are read at start time on purpose so
    // changing settings mid-capture does not retroactively rewrite the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backing out of a capture that was never typed into should not leave an
  // empty "Untitled capture" row on the home screen.
  useEffect(
    () => () => {
      const id = createdId.current;
      if (!id) return;
      const state = useReports.getState();
      const latest = state.current?.id === id ? state.current : null;
      if (latest && latest.rawInput.trim().length === 0 && !latest.narrative) {
        void state.remove(id);
      }
    },
    [],
  );

  const scope = useMemo(() => checkScope(text), [text]);

  const saveDraft = async () => {
    if (!current) return;
    await update({ rawInput: text, practiceMode });
  };

  const handleDiscard = () => {
    Alert.alert('Discard this capture?', 'The notes will be deleted from this device.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          if (current) await remove(current.id);
          router.back();
        },
      },
    ]);
  };

  const runGeneration = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const saved = await update({ rawInput: text, practiceMode }, 'Notes captured');
      if (!saved) return;

      const outcome = await generateForReport({ report: saved, org, profile, modelId });

      if (!outcome.onTopic) {
        Alert.alert(
          'That does not look like a patient encounter',
          outcome.offTopicReason ||
            'The notes were not recognised as documentation of a patient call. Nothing was generated.',
        );
        return;
      }

      await update(outcome.patch, 'Narrative generated');

      if (outcome.openQuestionCount > 0) router.replace(`/report/${saved.id}/questions`);
      else router.replace(`/report/${saved.id}`);
    } catch (error) {
      Alert.alert('Could not generate', describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = () => {
    if (scope.verdict === 'empty') {
      Alert.alert('Nothing captured', 'Add some notes about the call first.');
      return;
    }
    if (scope.needsConfirmation) {
      Alert.alert('Check this before generating', scope.message, [
        { text: 'Go back', style: 'cancel' },
        { text: 'Generate anyway', onPress: () => void runGeneration() },
      ]);
      return;
    }
    void runGeneration();
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
              label="Generate narrative"
              onPress={handleGenerate}
              loading={busy}
              disabled={!ready || text.trim().length === 0}
            />
            <Row>
              <Button
                label="Save draft"
                variant="secondary"
                style={s.flex}
                onPress={async () => {
                  await saveDraft();
                  router.back();
                }}
              />
              <Button label="Discard" variant="danger" style={s.flex} onPress={handleDiscard} />
            </Row>
          </>
        }>
        {scope.verdict !== 'ok' && scope.verdict !== 'empty' ? (
          <Banner tone={scope.verdict === 'off_topic' ? 'warning' : 'info'}>{scope.message}</Banner>
        ) : null}

        <Card>
          <Field
            label={mode === 'dictation' ? 'What happened on the call' : 'Call notes'}
            hint={HINT[mode]}
            value={text}
            onChangeText={setText}
            multiline
            autoCapitalize="sentences"
            autoCorrect
            placeholder={PLACEHOLDER[mode]}
            style={s.input}
          />
          <Muted>
            Notes are saved encrypted on this device as you go. They are only sent to the Claude API
            when you tap Generate.
          </Muted>
        </Card>

        <Card>
          <Toggle
            label="Practice data"
            description="Stamps the generated narrative as training data so it cannot be mistaken for a record."
            value={practiceMode}
            onValueChange={setPracticeMode}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  input: { minHeight: 260 },
});
