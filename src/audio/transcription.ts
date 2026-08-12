/**
 * Speech-to-text adapter.
 *
 * Why this is an interface with no working provider in phase 1:
 *
 * - The Claude API does not accept audio input, so transcription cannot go
 *   through the same key and endpoint as narrative generation.
 * - iOS on-device recognition (SFSpeechRecognizer, via `expo-speech-recognition`)
 *   is the right long-term answer for PHI: audio never leaves the phone. It is a
 *   native module, so it needs a development build — it cannot run in Expo Go,
 *   which is the phase 1 target.
 * - A cloud STT vendor would work in Expo Go today but adds a second processor
 *   of patient audio, and therefore a second BAA to negotiate.
 *
 * So phase 1 ships the recorder and stores the audio locally, and the provider
 * types their summary while listening back. Wiring a real provider is a matter
 * of implementing this interface and setting `getTranscriptionProvider`.
 * See docs/OPEN-QUESTIONS.md.
 */

export interface TranscriptionProvider {
  id: string;
  label: string;
  /** False when the provider cannot run in the current build. */
  available: boolean;
  /** One or two sentences shown in the UI explaining the current state. */
  description: string;
  transcribe(audioUri: string, signal?: AbortSignal): Promise<string>;
}

export class TranscriptionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionUnavailableError';
  }
}

const notConfigured: TranscriptionProvider = {
  id: 'none',
  label: 'Not configured',
  available: false,
  description:
    'Automatic transcription is not enabled in this build. The recording is saved on this device — play it back and type or dictate your summary below.',
  async transcribe() {
    throw new TranscriptionUnavailableError(
      'No transcription provider is configured in this build.',
    );
  },
};

export function getTranscriptionProvider(): TranscriptionProvider {
  return notConfigured;
}
