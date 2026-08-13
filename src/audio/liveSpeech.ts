import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorCode,
} from 'expo-speech-recognition';

/**
 * Live speech-to-text on the device.
 *
 * This is what makes "record during the call" work: speech is transcribed as
 * you talk, into an editable transcript, and the narrative is generated from
 * that text.
 *
 * **Recognition runs on the phone.** `requiresOnDeviceRecognition` is set, so
 * iOS uses its local speech model and audio is never sent to Apple. That is the
 * whole reason this feature is built with a native module rather than a cloud
 * transcription service: a second processor of patient audio would mean a
 * second BAA, and audio is the most sensitive thing this app touches. No audio
 * file is written either — only text reaches storage.
 *
 * The interface is deliberately identical to the browser implementation in
 * liveSpeech.web.ts, so the recording screen does not care which one it got.
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

export const liveSpeechSupported = true;

function describeError(code: ExpoSpeechRecognitionErrorCode | string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Speech recognition permission was denied. Enable Microphone and Speech Recognition for this app in iOS Settings.';
    case 'audio-capture':
      return 'The microphone was not available. Another app may be using it.';
    case 'interrupted':
      return 'Recognition was interrupted — a call, Siri, or an alarm took the microphone. Start it again when you are ready.';
    case 'language-not-supported':
      return 'On-device speech recognition is not installed for this language. iOS Settings → General → Keyboard → Dictation Languages.';
    case 'network':
      return 'Recognition needed the network and could not reach it.';
    case 'busy':
      return 'Speech recognition is already running.';
    default:
      return `Speech recognition stopped (${code}).`;
  }
}

export function createLiveSpeech(options: LiveSpeechOptions): LiveSpeechHandle {
  let wantActive = false;
  let finalText = '';
  /** Guards against a stop/start race restarting a session we are tearing down. */
  let restarting = false;

  const subscriptions: { remove: () => void }[] = [];

  const detach = () => {
    while (subscriptions.length) subscriptions.pop()?.remove();
  };

  const begin = () => {
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      // Keeps audio on the phone. See the note at the top of this file.
      requiresOnDeviceRecognition: true,
      // Names, drug names, and units are where field dictation goes wrong, so
      // give the recogniser the vocabulary it is least likely to guess.
      contextualStrings: CONTEXTUAL_STRINGS,
      // No `recordingOptions.persist` — an audio file of a patient encounter is
      // exactly what this app should not be creating.
    });
  };

  const attach = () => {
    subscriptions.push(
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const transcript = event.results?.[0]?.transcript ?? '';
        if (!transcript) return;

        if (event.isFinal) {
          finalText += `${transcript.trim()} `;
          options.onTranscript(finalText, '');
        } else {
          options.onTranscript(finalText, transcript);
        }
      }),
    );

    subscriptions.push(
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        const code = event.error;
        // Routine during pauses in a long call; `end` restarts us.
        if (code === 'no-speech' || code === 'aborted') return;
        wantActive = false;
        options.onError(describeError(code));
      }),
    );

    subscriptions.push(
      ExpoSpeechRecognitionModule.addListener('end', () => {
        if (!wantActive) {
          detach();
          options.onEnd();
          return;
        }
        // iOS ends a recognition task on its own after a stretch of silence and
        // caps how long one task may run. A call has long quiet periods, so
        // without restarting here dictation dies partway through and looks
        // broken. `finalText` accumulates across sessions, so nothing is lost.
        if (restarting) return;
        restarting = true;
        setTimeout(() => {
          restarting = false;
          if (!wantActive) return;
          try {
            begin();
          } catch {
            // The next `end` will try again.
          }
        }, 150);
      }),
    );
  };

  return {
    start: () => {
      if (wantActive) return;
      wantActive = true;

      void (async () => {
        try {
          if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
            wantActive = false;
            options.onError('Speech recognition is not available on this device.');
            return;
          }

          if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
            // Refuse rather than quietly falling back to Apple's servers. The
            // user chose a feature that records a patient encounter; sending
            // that audio off the device is not a detail to decide for them.
            wantActive = false;
            options.onError(
              'This device cannot transcribe speech locally, and this app will not send patient audio off the phone. Use the keyboard microphone or type your notes instead.',
            );
            return;
          }

          const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
          if (!permission.granted) {
            wantActive = false;
            options.onError(
              'Speech recognition needs permission for the microphone and for speech recognition. Both are in iOS Settings under this app.',
            );
            return;
          }

          if (!wantActive) return; // Stopped while we were asking.
          attach();
          begin();
        } catch (error) {
          wantActive = false;
          detach();
          options.onError(
            error instanceof Error ? error.message : 'Could not start speech recognition.',
          );
        }
      })();
    },

    stop: () => {
      wantActive = false;
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // Nothing running; the `end` listener still fires if there was.
      }
    },
  };
}

/**
 * Vocabulary hints for the recogniser.
 *
 * A general-purpose speech model has never heard most of this and will produce
 * confident nonsense — "PEA" as "pea", "Narcan" as "nark can". These are the
 * terms whose mistranscription would most change what a narrative says.
 */
const CONTEXTUAL_STRINGS = [
  // Assessment vocabulary
  'OPQRST',
  'SAMPLE history',
  'Glasgow Coma Scale',
  'AVPU',
  'capillary refill',
  'auscultation',
  'diaphoretic',
  'cyanotic',
  'guarding',
  'crepitus',
  'JVD',
  'rales',
  'rhonchi',
  'stridor',
  // Rhythms and findings
  'sinus tachycardia',
  'sinus bradycardia',
  'atrial fibrillation',
  'ventricular tachycardia',
  'ventricular fibrillation',
  'asystole',
  'PEA',
  'STEMI',
  'twelve lead',
  // Medications
  'albuterol',
  'ipratropium',
  'epinephrine',
  'nitroglycerin',
  'aspirin',
  'naloxone',
  'Narcan',
  'midazolam',
  'fentanyl',
  'ondansetron',
  'Zofran',
  'diphenhydramine',
  'Benadryl',
  'amiodarone',
  'atropine',
  'dextrose',
  'glucagon',
  'lisinopril',
  'metoprolol',
  'furosemide',
  'levalbuterol',
  // Interventions
  'nasal cannula',
  'non-rebreather',
  'bag valve mask',
  'CPAP',
  'supraglottic airway',
  'intraosseous',
  'saline lock',
  'cervical collar',
  'Fowler position',
  'semi-Fowler',
  'Trendelenburg',
  'return of spontaneous circulation',
  'ROSC',
  // Documentation
  'transfer of care',
  'refusal of care',
  'implied consent',
  'medical control',
];
