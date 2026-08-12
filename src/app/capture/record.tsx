import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { describeError } from '@/ai/client';
import { createLiveSpeech, liveSpeechSupported } from '@/audio/liveSpeech';
import { getTranscriptionProvider } from '@/audio/transcription';
import { Banner, Button, Card, Field, Muted, Row, Screen, Toggle } from '@/components/ui';
import type { Report } from '@/domain/types';
import { generateForReport } from '@/features/generate';
import { checkScope } from '@/safety/scopeGuard';
import { useReports } from '@/state/reportStore';
import { useSettings } from '@/state/settingsStore';
import { recordingsDir } from '@/storage/vault';
import { colors, space, type } from '@/theme';
import { confirm, notify } from '@/util/dialog';
import { formatDuration } from '@/util/time';

export default function RecordScreen() {
  // Two different mechanisms behind one screen: the browser transcribes speech
  // live, the installed app records audio to a file. Chosen before any hook so
  // the wrong one is never constructed.
  if (Platform.OS === 'web') {
    return liveSpeechSupported ? <LiveDictation /> : <SpeechUnavailable />;
  }
  return <Recorder />;
}

/* ------------------------------------------------------------------ *
 * Shared: turn captured text into a narrative
 * ------------------------------------------------------------------ */

function useGenerate() {
  const org = useSettings((s) => s.org);
  const profile = useSettings((s) => s.profile);
  const modelId = useSettings((s) => s.modelId);
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

    const outcome = await generateForReport({ report: saved, org, profile, modelId });
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
        <Banner tone="warning" title="Live dictation">
          Speech is transcribed by your browser as you talk. On iOS that may be processed by Apple
          rather than on the phone, so treat it like any other dictation — practice data only.
          Confirm your agency permits recording before using this on a real call.
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

/* ------------------------------------------------------------------ *
 * Native: record audio to a file
 * ------------------------------------------------------------------ */

function Recorder() {
  useKeepAwake();

  const org = useSettings((s) => s.org);
  const practiceModeDefault = useSettings((s) => s.practiceModeDefault);
  const { current, startReport, update, remove } = useReports();
  const generate = useGenerate();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [savedUri, setSavedUri] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [practiceMode, setPracticeMode] = useState(practiceModeDefault);
  const [busy, setBusy] = useState(false);
  const reportRef = useRef<Report | null>(null);

  const provider = useMemo(() => getTranscriptionProvider(), []);
  const player = useAudioPlayer(savedUri ? { uri: savedUri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useDiscardIfEmpty(reportRef);

  useEffect(() => {
    void (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(status.granted);
      if (status.granted) {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      }
      const report = await startReport({
        org,
        captureMode: 'live',
        practiceMode: practiceModeDefault,
      });
      reportRef.current = report;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const startRecording = async () => {
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setElapsed(0);
      setRecording(true);
    } catch (error) {
      notify('Could not start recording', describeError(error));
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      setRecording(false);

      const tempUri = recorder.uri;
      if (!tempUri || !reportRef.current) return;

      // Move it out of the OS temp location into the app's own directory,
      // named by report id so it is cleaned up with the report.
      const source = new File(tempUri);
      const destination = new File(recordingsDir(), `${reportRef.current.id}.m4a`);
      if (destination.exists) destination.delete();
      source.moveSync(destination);

      setSavedUri(destination.uri);
      await update({ audioUri: destination.uri }, `Recording saved (${formatDuration(elapsed)})`);
    } catch (error) {
      setRecording(false);
      notify('Could not save recording', describeError(error));
    }
  };

  const discard = async () => {
    const ok = await confirm({
      title: 'Discard this recording?',
      message: 'The audio and notes will be deleted from this device.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep',
      destructive: true,
    });
    if (!ok) return;
    if (recording) await recorder.stop().catch(() => undefined);
    if (current) await remove(current.id);
    router.back();
  };

  const handleGenerate = async () => {
    setBusy(true);
    try {
      await generate(text, practiceMode);
    } catch (error) {
      notify('Could not generate', describeError(error));
    } finally {
      setBusy(false);
    }
  };

  if (permissionGranted === false) {
    return (
      <Screen>
        <Banner tone="danger" title="Microphone access is off">
          Live recording needs microphone permission. Turn it on for this app in iOS Settings, then
          come back.
        </Banner>
        <Button label="Go back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

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
              disabled={text.trim().length === 0}
            />
            <Row>
              <Button
                label="Save draft"
                variant="secondary"
                style={s.flex}
                onPress={async () => {
                  await update({ rawInput: text, practiceMode });
                  router.back();
                }}
              />
              <Button label="Discard" variant="danger" style={s.flex} onPress={discard} />
            </Row>
          </>
        }>
        <Banner tone="warning" title="Recording on scene">
          Audio is written to this device only and is never uploaded. Confirm your agency permits
          recording patient encounters before using this on a real call.
        </Banner>

        <Card>
          <View style={s.timerBlock}>
            <Text style={[type.title, recording && s.timerActive]}>{formatDuration(elapsed)}</Text>
            <Muted>{recording ? 'Recording' : savedUri ? 'Recording saved' : 'Ready'}</Muted>
          </View>

          {recording ? (
            <Button label="Stop recording" variant="danger" onPress={stopRecording} />
          ) : (
            <Button
              label={savedUri ? 'Record again' : 'Start recording'}
              onPress={startRecording}
              disabled={permissionGranted === null}
            />
          )}

          {savedUri ? (
            <Button
              label={playerStatus.playing ? 'Pause playback' : 'Play back recording'}
              variant="secondary"
              onPress={() => {
                if (playerStatus.playing) player.pause();
                else {
                  if (playerStatus.didJustFinish) player.seekTo(0);
                  player.play();
                }
              }}
            />
          ) : null}
        </Card>

        <Card>
          <Field
            label="Summary of the call"
            hint={provider.description}
            value={text}
            onChangeText={setText}
            multiline
            autoCapitalize="sentences"
            placeholder="Play the recording back and type or dictate what happened — dispatch, findings, vitals with times, interventions, response, transport."
            style={s.input}
          />
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

const s = StyleSheet.create({
  flex: { flex: 1 },
  input: { minHeight: 180 },
  timerBlock: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  timerActive: { color: colors.danger },
  bold: { fontWeight: '700' },
});
