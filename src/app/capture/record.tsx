import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { describeError } from '@/ai/client';
import { createLiveSpeech, liveSpeechSupported } from '@/audio/liveSpeech';
import { Banner, Button, Card, Field, Muted, Row, Screen, Toggle } from '@/components/ui';
import type { Report } from '@/domain/types';
import { generateForReport } from '@/features/generate';
import { checkScope } from '@/safety/scopeGuard';
import { useReports } from '@/state/reportStore';
import { currentAiConfig, useSettings } from '@/state/settingsStore';
import { colors, space, type } from '@/theme';
import { confirm, notify } from '@/util/dialog';
import { formatDuration } from '@/util/time';

export default function RecordScreen() {
  // One mechanism now on both platforms: speech is transcribed live into an
  // editable transcript and no audio file is ever written. The implementations
  // differ — iOS uses its on-device recogniser, the browser uses the Web Speech
  // API — but `createLiveSpeech` hides that, so this screen does not branch.
  return liveSpeechSupported ? <LiveDictation /> : <SpeechUnavailable />;
}

/* ------------------------------------------------------------------ *
 * Shared: turn captured text into a narrative
 * ------------------------------------------------------------------ */

function useGenerate() {
  const org = useSettings((s) => s.org);
  const profile = useSettings((s) => s.profile);
  const { update } = useReports();

  return async (text: string, practiceMode: boolean): Promise<boolean> => {
    const scope = checkScope(text);
    if (scope.verdict === 'empty') {
      notify('Nothing to work from', 'Capture something about the call first.');
      return false;
    }
    if (scope.needsConfirmation) {
      const ok = await confirm({
        title: 'Check this before generating',
        message: scope.message,
        confirmLabel: 'Generate anyway',
        cancelLabel: 'Go back',
      });
      if (!ok) return false;
    }

    const saved = await update({ rawInput: text, practiceMode }, 'Capture completed');
    if (!saved) return false;

    const outcome = await generateForReport({
      report: saved,
      org,
      profile,
      config: currentAiConfig(),
    });
    if (!outcome.onTopic) {
      notify(
        'That does not look like a patient encounter',
        outcome.offTopicReason || 'Nothing was generated.',
      );
      return false;
    }

    await update(outcome.patch, 'Narrative generated');
    if (outcome.openQuestionCount > 0) router.replace(`/report/${saved.id}/questions`);
    else router.replace(`/report/${saved.id}`);
    return true;
  };
}

/** Delete the report this screen created if nothing was ever captured into it. */
function useDiscardIfEmpty(reportRef: React.RefObject<Report | null>) {
  useEffect(
    () => () => {
      const id = reportRef.current?.id;
      if (!id) return;
      const state = useReports.getState();
      const latest = state.current?.id === id ? state.current : null;
      if (latest && latest.rawInput.trim().length === 0 && !latest.narrative && !latest.audioUri) {
        void state.remove(id);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

/* ------------------------------------------------------------------ *
 * Web: live speech-to-text during the call
 * ------------------------------------------------------------------ */

function LiveDictation() {
  // A call runs longer than any sensible auto-lock, and the screen going dark
  // mid-transcription is indistinguishable from the app having crashed.
  useKeepAwake();

  const org = useSettings((s) => s.org);
  const practiceModeDefault = useSettings((s) => s.practiceModeDefault);
  const { current, startReport, update, remove } = useReports();
  const generate = useGenerate();

  const [listening, setListening] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [practiceMode, setPracticeMode] = useState(practiceModeDefault);
  const [busy, setBusy] = useState(false);
  const reportRef = useRef<Report | null>(null);

  // Keep the newest text in a ref so the recognition callbacks, which are
  // created once, never write a stale value back into state.
  const textRef = useRef('');
  textRef.current = text;

  useDiscardIfEmpty(reportRef);

  useEffect(() => {
    void (async () => {
      const report = await startReport({
        org,
        captureMode: 'live',
        practiceMode: practiceModeDefault,
      });
      reportRef.current = report;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speech = useMemo(
    () =>
      createLiveSpeech({
        onTranscript: (finalText, partial) => {
          setText(finalText);
          setInterim(partial);
        },
        onError: (message) => {
          setListening(false);
          setInterim('');
          notify('Dictation stopped', message);
        },
        onEnd: () => {
          setListening(false);
          setInterim('');
        },
      }),
    [],
  );

  useEffect(() => {
    if (!listening) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [listening]);

  // Never leave the microphone open if the screen goes away.
  useEffect(() => () => speech.stop(), [speech]);

  const toggle = () => {
    if (listening) {
      speech.stop();
      setListening(false);
      return;
    }
    setElapsed(0);
    speech.start();
    setListening(true);
  };

  const discard = async () => {
    const ok = await confirm({
      title: 'Discard this capture?',
      message: 'The transcript will be deleted.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep',
      destructive: true,
    });
    if (!ok) return;
    speech.stop();
    if (current) await remove(current.id);
    router.back();
  };

  const handleGenerate = async () => {
    speech.stop();
    setListening(false);
    setBusy(true);
    try {
      await generate(text, practiceMode);
    } catch (error) {
      notify('Could not generate', describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex}>
      <Screen
        footer={
          <>
            <Button
              label="Generate narrative"
              onPress={handleGenerate}
              loading={busy}
              disabled={text.trim().length === 0}
            />
            <Row>
              <Button
                label="Save draft"
                variant="secondary"
                style={s.flex}
                onPress={async () => {
                  speech.stop();
                  await update({ rawInput: text, practiceMode });
                  router.back();
                }}
              />
              <Button label="Discard" variant="danger" style={s.flex} onPress={discard} />
            </Row>
          </>
        }>
        <Banner tone={Platform.OS === 'web' ? 'warning' : 'info'} title="Live dictation">
          {Platform.OS === 'web'
            ? 'Speech is transcribed by your browser as you talk. On iOS that may be processed by Apple rather than on the phone, so treat it like any other dictation — practice data only. Confirm your agency permits recording before using this on a real call.'
            : 'Speech is transcribed on this phone as you talk. No audio is sent anywhere and no recording is saved — only the text below. Confirm your agency permits this before using it on a real call.'}
        </Banner>

        <Card>
          <View style={s.timerBlock}>
            <Text style={[type.title, listening && s.timerActive]}>{formatDuration(elapsed)}</Text>
            <Muted>{listening ? 'Listening…' : text ? 'Paused' : 'Ready'}</Muted>
          </View>
          <Button
            label={listening ? 'Stop dictation' : text ? 'Resume dictation' : 'Start dictation'}
            variant={listening ? 'danger' : 'primary'}
            onPress={toggle}
          />
          <Muted>
            Talk through the call as you would a handoff. You can edit the transcript below
            afterwards — fix names and numbers before generating.
          </Muted>
        </Card>

        <Card>
          <Field
            label="Transcript"
            value={interim ? `${text}${interim}` : text}
            onChangeText={(value) => {
              setInterim('');
              setText(value);
            }}
            multiline
            autoCapitalize="sentences"
            placeholder="Your words will appear here as you speak."
            style={s.input}
          />
          {interim ? <Muted>Still hearing you…</Muted> : null}
        </Card>

        <Card>
          <Toggle
            label="Practice data"
            description="Stamps the generated narrative as training data."
            value={practiceMode}
            onValueChange={setPracticeMode}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function SpeechUnavailable() {
  return (
    <Screen>
      <Banner tone="info" title="Live dictation is not available here">
        This browser does not support speech recognition. In Safari on iPhone it usually does — if
        you opened this from the home-screen icon and it is missing, try the same address in Safari
        itself.
      </Banner>
      <Card>
        <Muted>
          You can still use <Text style={s.bold}>Post-call dictation</Text>: tap the microphone on
          your keyboard and talk. That runs on the phone itself.
        </Muted>
      </Card>
      <Button label="Go back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  input: { minHeight: 180 },
  timerBlock: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  timerActive: { color: colors.danger },
  bold: { fontWeight: '700' },
});
