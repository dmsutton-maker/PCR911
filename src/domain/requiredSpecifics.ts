import type { RequiredSpecific } from './types';

/**
 * Starting catalog of required specifics.
 *
 * This is a *default*, not a policy. Every entry can be disabled or reworded in
 * Settings → Organization, and orgs can add their own. The generation prompt is
 * built from whatever the org has enabled at the time the report is generated.
 *
 * `criterion` is what the model checks the user's input against.
 * `question` is the fallback wording used when the model has nothing better.
 */
export const DEFAULT_REQUIRED_SPECIFICS: RequiredSpecific[] = [
  {
    id: 'dispatch',
    label: 'Dispatch information',
    criterion: 'The nature of the dispatch and, where known, the time units were dispatched.',
    question: 'What was the unit dispatched for, and at what time?',
    enabled: true,
    appliesTo: 'always',
    custom: false,
  },
  {
    id: 'scene',
    label: 'Scene findings and safety',
    criterion:
      'What the crew found on arrival, including scene safety, mechanism of injury or nature of illness, and how the patient was found.',
    question: 'What did you find on arrival — scene conditions and how was the patient found?',
    enabled: true,
    appliesTo: 'always',
    custom: false,
  },
  {
    id: 'chief_complaint',
    label: 'Chief complaint',
    criterion:
      "The patient's chief complaint, ideally in the patient's own words, plus patient age and sex.",
    question: "What was the patient's chief complaint, and their age and sex?",
    enabled: true,
    appliesTo: 'always',
    custom: false,
  },
  {
    id: 'hpi_opqrst',
    label: 'History of present illness (OPQRST)',
    criterion:
      'Onset, provocation/palliation, quality, radiation, severity, and time course of the complaint.',
    question:
      'Can you describe the complaint using OPQRST — onset, what makes it better or worse, quality, radiation, severity, and how it has changed over time?',
    enabled: true,
    appliesTo: 'always',
    custom: false,
  },
  {
    id: 'sample',
    label: 'Medications, allergies, and past history',
    criterion:
      'Current medications, known allergies, and pertinent past medical history (or an explicit statement that they were unobtainable).',
    question:
      "What are the patient's current medications, allergies, and pertinent past medical history? If they could not be obtained, say so.",
    enabled: true,
    appliesTo: 'always',
    custom: false,
  },
  {
    id: 'assessment_findings',
    label: 'Physical assessment findings',
    criterion:
      'Physical exam findings by body system, including pertinent negatives, not just an overall impression.',
    question:
      'What were your physical assessment findings by system, including any pertinent negatives?',
    enabled: true,
    appliesTo: 'always',
    custom: false,
  },
  {
    id: 'vitals_initial',
    label: 'Initial vital signs with time',
    criterion:
      'A complete initial set of vital signs with the time it was taken (BP, pulse, respirations, SpO2, and where applicable GCS, blood glucose, temperature, pain score).',
    question: 'What was the initial set of vital signs, and what time was it taken?',
    enabled: true,
    appliesTo: 'always',
    custom: false,
  },
  {
    id: 'vitals_repeat',
    label: 'Repeat vital signs',
    criterion:
      'At least one further set of vital signs with its time, so a trend is documented (or a stated reason none was obtained).',
    question:
      'What were the repeat vital signs and at what time? If no repeat set was obtained, what was the reason?',
    enabled: true,
    appliesTo: 'always',
    custom: false,
  },
  {
    id: 'interventions',
    label: 'Interventions with times',
    criterion:
      'Every intervention performed, each with the time performed, dose/route where applicable, and who performed it.',
    question:
      'What interventions did you perform, at what times, and at what dose and route where applicable?',
    enabled: true,
    appliesTo: 'always',
    custom: false,
  },
  {
    id: 'response_to_treatment',
    label: 'Response to treatment',
    criterion:
      "The patient's response to each intervention, including reassessment findings after treatment.",
    question: 'How did the patient respond to each intervention you performed?',
    enabled: true,
    appliesTo: 'always',
    custom: false,
  },
  {
    id: 'transport',
    label: 'Transport decision, destination, and position',
    criterion:
      'The transport decision and its rationale, the receiving facility, the position the patient was transported in, and whether transport was emergent.',
    question:
      'Where did you transport, in what position, was it emergent, and what drove that decision?',
    enabled: true,
    appliesTo: 'transport',
    custom: false,
  },
  {
    id: 'enroute_changes',
    label: 'Condition en route',
    criterion:
      "Whether the patient's condition changed en route, and what was done about it (or an explicit statement that the condition was unchanged).",
    question:
      "Did the patient's condition change en route? If it was unchanged, that should be stated explicitly.",
    enabled: true,
    appliesTo: 'transport',
    custom: false,
  },
  {
    id: 'transfer_of_care',
    label: 'Transfer of care',
    criterion:
      'To whom care was transferred, by name or role, at what time, and that a verbal report was given.',
    question:
      'Who did you transfer care to, at what time, and was a verbal report given?',
    enabled: true,
    appliesTo: 'transport',
    custom: false,
  },
  {
    id: 'consent',
    label: 'Consent',
    criterion:
      'How consent for treatment and transport was obtained (expressed, implied, or by a guardian/decision-maker).',
    question: 'How was consent for treatment and transport obtained?',
    enabled: true,
    appliesTo: 'always',
    custom: false,
  },
  {
    id: 'refusal_capacity',
    label: 'Refusal: capacity assessment',
    criterion:
      'For a refusal: documentation that the patient was alert, oriented, and had decision-making capacity, with the findings that support that.',
    question:
      'For this refusal, what supports that the patient had decision-making capacity — orientation, mentation, absence of intoxication or head injury?',
    enabled: true,
    appliesTo: 'refusal',
    custom: false,
  },
  {
    id: 'refusal_risks',
    label: 'Refusal: risks explained and signature',
    criterion:
      'For a refusal: that the risks of refusing (up to and including death) were explained in terms the patient understood, that the patient was advised to call back or seek care, and that a refusal was signed and witnessed.',
    question:
      'For this refusal, what risks were explained, was the patient advised to call back, and was the refusal signed and witnessed?',
    enabled: true,
    appliesTo: 'refusal',
    custom: false,
  },
];

/** Return a fresh, mutable copy so stores never share the module-level array. */
export function cloneDefaultSpecifics(): RequiredSpecific[] {
  return DEFAULT_REQUIRED_SPECIFICS.map((s) => ({ ...s }));
}

export const APPLIES_TO_LABELS: Record<RequiredSpecific['appliesTo'], string> = {
  always: 'Every call',
  transport: 'Calls with transport',
  refusal: 'Refusals',
  cardiac_arrest: 'Cardiac arrest',
  trauma: 'Trauma',
  pediatric: 'Pediatric',
};
