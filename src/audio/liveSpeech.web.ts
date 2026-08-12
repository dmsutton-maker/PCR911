import type { LiveSpeechHandle, LiveSpeechOptions } from './liveSpeech';

/**
 * Live speech-to-text in the browser, via the Web Speech API.
 *
 * This is what makes "record during the call" work in the web build: speech is
 * transcribed as you talk, straight into the notes field, and the narrative is
 * generated from that text. No audio file is ever produced or stored.
 *
 * ⚠️ Recognition is performed by the browser, which on iOS may send audio to
 * Apple for processing rather than doing it on-device. That is a different
 * privacy posture from typing, and another reason this build is for practice
 * data only. The UI says so on the recording screen.
 *
 * iOS quirk worth knowing: Safari ends recognition after each utterance even
 * with `continuous` set, so `onend` restarts it for as long as the user still
 * has recording switched on. Without that, dictation stops after the first
 * pause and looks broken.
 */

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function getConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const liveSpeechSupported = getConstructor() !== null;

function describeError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was denied. Allow it for this site in Safari, then try again.';
    case 'audio-capture':
      return 'No microphone was available.';
    case 'network':
      return 'Speech recognition needs a network connection and could not reach it.';
    case 'language-not-supported':
      return 'This language is not supported for speech recognition on this device.';
    default:
      return `Speech recognition stopped (${code}).`;
  }
}

export function createLiveSpeech(options: LiveSpeechOptions): LiveSpeechHandle {
  const Constructor = getConstructor();
  if (!Constructor) {
    return {
      start: () => options.onError('Speech recognition is not available in this browser.'),
      stop: () => {},
    };
  }

  let recognition: SpeechRecognitionLike | null = null;
  let wantActive = false;
  let finalText = '';

  const build = (): SpeechRecognitionLike => {
    const r = new Constructor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    r.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += `${text.trim()} `;
        else interim += text;
      }
      options.onTranscript(finalText, interim);
    };

    r.onerror = (event: any) => {
      const code = event?.error ?? 'unknown';
      // Both are routine during normal pauses; onend restarts us.
      if (code === 'no-speech' || code === 'aborted') return;
      wantActive = false;
      options.onError(describeError(code));
    };

    r.onend = () => {
      if (!wantActive) {
        options.onEnd();
        return;
      }
      // Safari ends the session after each utterance. Start a fresh one.
      try {
        r.start();
      } catch {
        // Already restarting — the next onend will try again.
      }
    };

    return r;
  };

  return {
    start: () => {
      if (wantActive) return;
      wantActive = true;
      try {
        recognition = build();
        recognition.start();
      } catch (error) {
        wantActive = false;
        options.onError(
          error instanceof Error ? error.message : 'Could not start speech recognition.',
        );
      }
    },
    stop: () => {
      wantActive = false;
      try {
        recognition?.stop();
      } catch {
        // Nothing running.
      }
    },
  };
}
