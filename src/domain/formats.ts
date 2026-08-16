import type { NarrativeFormat, NarrativeFormatId } from './types';

/**
 * Narrative format registry.
 *
 * The generation prompt is built from whichever entry the org selected, so
 * supporting a new documentation style means adding one object here — no
 * changes to the AI layer or the UI.
 */

const SOAP: NarrativeFormat = {
  id: 'soap',
  label: 'SOAP',
  description: 'Subjective, Objective, Assessment, Plan. The most widely taught EMS format.',
  sections: [
    {
      key: 'subjective',
      heading: 'SUBJECTIVE',
      guidance:
        'Dispatch information, chief complaint in the patient\'s own words where available, history of present illness (OPQRST), pertinent past medical history, medications, and allergies. Include what the patient, family, or bystanders reported.',
    },
    {
      key: 'objective',
      heading: 'OBJECTIVE',
      guidance:
        'Scene findings, general impression, physical assessment findings by system, and vital signs with the time each set was taken. Report only what was observed or measured — no interpretation.',
    },
    {
      key: 'assessment',
      heading: 'ASSESSMENT',
      guidance:
        'The provider\'s working field impression, supported by the subjective and objective findings already stated. Do not introduce findings the provider did not supply.',
    },
    {
      key: 'plan',
      heading: 'PLAN',
      guidance:
        'Interventions performed with times, the patient\'s response to each, transport decision and destination, position of transport, changes en route, and transfer of care including who care was transferred to.',
    },
  ],
};

const CHART: NarrativeFormat = {
  id: 'chart',
  label: 'CHART',
  description: 'Chief complaint, History, Assessment, Rx (treatment), Transport.',
  sections: [
    {
      key: 'chief_complaint',
      heading: 'CHIEF COMPLAINT',
      guidance:
        'Dispatch information and the reason EMS was called, stated in the patient\'s own words where available.',
    },
    {
      key: 'history',
      heading: 'HISTORY',
      guidance:
        'History of present illness (OPQRST), pertinent past medical history, medications, allergies, and relevant events leading up to the call.',
    },
    {
      key: 'assessment',
      heading: 'ASSESSMENT',
      guidance:
        'Scene findings, general impression, physical assessment findings by system, vital signs with times, and the provider\'s working field impression.',
    },
    {
      key: 'rx',
      heading: 'RX / TREATMENT',
      guidance:
        'Every intervention performed, with the time it was performed and the patient\'s response to it. Include interventions attempted unsuccessfully.',
    },
    {
      key: 'transport',
      heading: 'TRANSPORT',
      guidance:
        'Transport decision and rationale, destination, position of transport, condition and any changes en route, and transfer of care.',
    },
  ],
};

const SOAPIER: NarrativeFormat = {
  id: 'soapier',
  label: 'SOAPIER',
  description: 'SOAP with Intervention, Evaluation, and Revision broken out separately.',
  sections: [
    { key: 'subjective', heading: 'SUBJECTIVE', guidance: SOAP.sections[0].guidance },
    { key: 'objective', heading: 'OBJECTIVE', guidance: SOAP.sections[1].guidance },
    { key: 'assessment', heading: 'ASSESSMENT', guidance: SOAP.sections[2].guidance },
    {
      key: 'plan',
      heading: 'PLAN',
      guidance: 'The care plan formed at the time, including transport decision and destination.',
    },
    {
      key: 'intervention',
      heading: 'INTERVENTION',
      guidance: 'Each intervention actually performed, with the time it was performed.',
    },
    {
      key: 'evaluation',
      heading: 'EVALUATION',
      guidance:
        'The patient\'s response to each intervention, including reassessment vital signs with times.',
    },
    {
      key: 'revision',
      heading: 'REVISION',
      guidance:
        'Any change made to the plan based on the evaluation. State "No revision to the plan was required." if nothing changed.',
    },
  ],
};

const CHRONOLOGICAL: NarrativeFormat = {
  id: 'chronological',
  label: 'Chronological narrative',
  description: 'A single time-ordered narrative with no section headings.',
  sections: [
    {
      key: 'narrative',
      heading: '',
      guidance:
        'One continuous, strictly time-ordered account of the call from dispatch through transfer of care. Cover dispatch, arrival and scene findings, patient presentation, history, assessment findings and vital signs with times, every intervention and the response to it, transport, and transfer of care. Do not use section headings.',
    },
  ],
  notes: 'Write as flowing prose in chronological order. Do not emit any headings.',
};

export const NARRATIVE_FORMATS: NarrativeFormat[] = [SOAP, CHART, SOAPIER, CHRONOLOGICAL];

export const DEFAULT_FORMAT_ID: NarrativeFormatId = 'soap';

export function getFormat(id: NarrativeFormatId): NarrativeFormat {
  return NARRATIVE_FORMATS.find((f) => f.id === id) ?? SOAP;
}
