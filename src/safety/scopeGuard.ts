/**
 * Local, offline pre-check on captured input.
 *
 * This runs before anything is sent to the API. It is a cheap heuristic, not a
 * classifier: its job is to catch the obvious cases — an empty capture, a
 * dictation that wandered off the encounter, or text that is trying to give the
 * model instructions — and put them in front of the user before they spend a
 * request. The model-side scope fence in ai/prompts.ts is the real enforcement;
 * this is the fast, free first pass.
 *
 * It warns rather than blocks (except on empty input). Field notes are terse and
 * idiosyncratic, and a documentation tool that refuses to document a real call
 * because it did not recognise the vocabulary is worse than one that asks.
 */

export type ScopeVerdict = 'ok' | 'thin' | 'off_topic' | 'empty';

export interface ScopeCheck {
  verdict: ScopeVerdict;
  /** One sentence to show the user. Empty when verdict is 'ok'. */
  message: string;
  /** True when the user should be asked to confirm before a request is sent. */
  needsConfirmation: boolean;
}

const CLINICAL_TERMS = [
  'patient', 'pt', 'dispatch', 'scene', 'chief complaint', 'complain', 'onset',
  'pain', 'bp', 'blood pressure', 'pulse', 'hr', 'resp', 'spo2', 'o2', 'sat',
  'gcs', 'glucose', 'bgl', 'vitals', 'vital signs', 'assessment', 'airway',
  'breathing', 'circulation', 'lung', 'chest', 'abdomen', 'abd', 'neuro',
  'pupils', 'skin', 'trauma', 'injury', 'fall', 'mvc', 'mva', 'collision',
  'seizure', 'syncope', 'cardiac', 'arrest', 'cpr', 'aed', 'ecg', 'ekg',
  'stroke', 'cva', 'dyspnea', 'sob', 'shortness of breath', 'nausea', 'vomit',
  'allergy', 'allergies', 'medication', 'meds', 'rx', 'dose', 'iv', 'io',
  'im', 'intranasal', 'nebulizer', 'oxygen', 'nrb', 'cannula', 'splint',
  'c-collar', 'backboard', 'transport', 'transported', 'hospital', 'ed',
  'emergency department', 'triage', 'transfer of care', 'refusal', 'refused',
  'ams', 'altered', 'unresponsive', 'ambulatory', 'stretcher', 'gurney',
  'history', 'hx', 'pmh', 'sample', 'opqrst', 'ems', 'medic', 'emt', 'crew',
  'ambulance', 'unit', 'enroute', 'en route', 'on arrival', 'bystander',
];

/** Phrases that read as an instruction to a model rather than a clinical note. */
const INSTRUCTION_PATTERNS: RegExp[] = [
  /\bignore (all |any |the )?(previous|prior|above|earlier)\b/i,
  /\bdisregard (all |any |the )?(previous|prior|above|instructions)\b/i,
  /\byou are (now )?(a|an)\b.{0,40}\b(assistant|bot|ai|model)\b/i,
  /\b(system|developer) prompt\b/i,
  /\bwrite (me )?(a|an) (poem|song|story|essay|email|joke)\b/i,
  /\bwhat('| i)s the (capital|weather|time|score)\b/i,
  /\btranslate (this|the following)\b/i,
  /\bact as\b/i,
];

const MIN_MEANINGFUL_CHARS = 25;

function countClinicalSignals(text: string): number {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')} `;
  let hits = 0;
  for (const term of CLINICAL_TERMS) {
    if (haystack.includes(` ${term} `)) hits += 1;
  }
  return hits;
}

export function checkScope(input: string): ScopeCheck {
  const text = input.trim();

  if (text.length === 0) {
    return {
      verdict: 'empty',
      message: 'There is nothing captured yet.',
      needsConfirmation: false,
    };
  }

  const instruction = INSTRUCTION_PATTERNS.find((p) => p.test(text));
  if (instruction) {
    return {
      verdict: 'off_topic',
      message:
        'Part of this text reads as an instruction rather than notes about a patient. It will be documented as content or ignored, not acted on. Review it before generating.',
      needsConfirmation: true,
    };
  }

  const signals = countClinicalSignals(text);

  if (text.length < MIN_MEANINGFUL_CHARS && signals < 2) {
    return {
      verdict: 'thin',
      message:
        'That is very little to work from. The narrative will mostly be follow-up questions.',
      needsConfirmation: true,
    };
  }

  if (signals === 0) {
    return {
      verdict: 'off_topic',
      message:
        "This does not read like notes about a patient encounter. Generating anyway is fine if it's a real call — check it first.",
      needsConfirmation: true,
    };
  }

  if (signals < 3 && text.length < 120) {
    return {
      verdict: 'thin',
      message:
        'Only a little clinical detail was recognised here. Expect several follow-up questions.',
      needsConfirmation: false,
    };
  }

  return { verdict: 'ok', message: '', needsConfirmation: false };
}
