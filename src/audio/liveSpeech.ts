/**
 * Live speech-to-text.
 *
 * Native build: not implemented. The installed app records audio with
 * expo-audio and the provider types a summary while listening back. Wiring real
 * on-device recognition here means adding `expo-speech-recognition`, which is a
 * native module and therefore needs a development build — see
 * docs/OPEN-QUESTIONS.md.
 *
 * The web build has a working implementation in liveSpeech.web.ts, using the
 * browser's own speech recognition.
 */

export interface LiveSpeechHandle {
  start: () => void;
  stop: () => void;
}

export interface LiveSpeechOptions {
  /** Called with everything recognised so far, plus the in-progress phrase. */
  onTranscript: (finalText: string, interim: string) => void;
  onError: (message: string) => void;
  /** Called once recognition has fully stopped. */
  onEnd: () => void;
}

export const liveSpeechSupported = false;

export function createLiveSpeech(_options: LiveSpeechOptions): LiveSpeechHandle {
  return { start: () => {}, stop: () => {} };
}
