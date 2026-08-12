import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

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
import { getTranscriptionProvider } from '@/audio/transcription';
import type { Report } from '@/domain/types';
import { generateForReport } from '@/features/generate';
import { checkScope } from '@/safety/scopeGuard';
import { useReports } from '@/state/reportStore';
import { useSettings } from '@/state/settingsStore';
import { recordingsDir } from '@/storage/vault';
import { colors, space, type } from '@/theme';
import { formatDuration } from '@/util/time';

export default function RecordScreen() {
  useKeepAwake();

  const org = useSettings((s) => s.org);
  const profile = useSettings((s) => s.profile);
  const modelId = useSettings((s) => s.modelId);
  const practiceModeDefault = useSettings((s) => s.practiceModeDefault);
  const { current, startReport, update, remove } = useReports();

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

  useEffect(() => {
    void (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(status.granted);
      if (status.granted) {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      }
      const report = await startReport({ org, captureMode: 'live', practiceMode: practiceModeDefault });
      reportRef.current = report;
    })();
    // Mount-only setup; see notes.tsx for the same reasoning about org snapshots.
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
      Alert.alert('Could not start recording', describeError(error));
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      setRecording(false);

      const tempUri = recorder.uri;
      if (!tempUri || !reportRef.current) return;

      // Move the recording out of the OS temp location into the app's own
      // recordings directory, named by report id so it can be cleaned up with
      // the report.
      const source = new File(tempUri);
      const destination = new File(recordingsDir(), `${reportRef.current.id}.m4a`);
      if (destination.exists) destination.delete();
      source.moveSync(destination);

      setSavedUri(destination.uri);
      await update({ audioUri: destination.uri }, `Recording saved (${formatDuration(elapsed)})`);
    } catch (error) {
      setRecording(false);
      Alert.alert('Could not save recording', describeError(error));
    }
  };

  const discard = () => {
    Alert.alert('Discard this recording?', 'The audio and notes will be deleted from this device.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          if (recording) await recorder.stop().catch(() => undefined);
          if (current) await remove(current.id);
          router.back();
        },
      },
    ]);
  };

  const generate = async () => {
    const scope = checkScope(text);
    if (scope.verdict === 'empty') {
      Alert.alert(
        'Nothing to work from',
        'Automatic transcription is not enabled in this build, so type or dictate a summary of the call while you listen back.',
      );
      return;
    }

    setBusy(true);
    try {
      const saved = await update({ rawInput: text, practiceMode }, 'Summary captured');
      if (!saved) return;

      const outcome = await generateForReport({ report: saved, org, profile, modelId });
      if (!outcome.onTopic) {
        Alert.alert(
          'That does not look like a patient encounter',
          outcome.offTopicReason || 'Nothing was generated.',
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
              onPress={generate}
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
});
