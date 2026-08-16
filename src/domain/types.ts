/**
 * Core domain types for the PCR Narrative Assistant.
 *
 * Everything here is local-first: these objects live on the device, encrypted at
 * rest, and are only sent to the Claude API as part of an explicit narrative
 * generation request initiated by the user.
 */

/** Identifier of a narrative format. Adding a format = adding an entry to the registry. */
export type NarrativeFormatId = string;

/** One section of a narrative format (e.g. the "S" in SOAP). */
export interface NarrativeSection {
  /** Stable key, used in prompts. */
  key: string;
  /** Heading as it should appear in the generated narrative. */
  heading: string;
  /** Instruction to the model about what belongs in this section. */
  guidance: string;
}

export interface NarrativeFormat {
  id: NarrativeFormatId;
  label: string;
  /** One-line description shown in the org settings picker. */
  description: string;
  sections: NarrativeSection[];
  /** Extra format-specific instructions appended to the prompt. */
  notes?: string;
}

/**
 * A detail an organization requires in every narrative.
 *
 * The list is org-configurable, not hardcoded: `DEFAULT_REQUIRED_SPECIFICS` is
 * only a starting point that an admin can enable, disable, edit, or extend.
 */
export interface RequiredSpecific {
  /** Stable id. Used to correlate the model's coverage report back to this item. */
  id: string;
  /** Short label shown in settings and in the follow-up question list. */
  label: string;
  /** What the model should look for in the user's input to consider this covered. */
  criterion: string;
  /** Fallback question to ask the user when this is missing. */
  question: string;
  enabled: boolean;
  /**
   * Only check this item when the encounter looks like the given situation.
   * `always` is the default; the others let an org require refusal- or
   * transport-specific documentation without asking about it on every call.
   */
  appliesTo: 'always' | 'transport' | 'refusal' | 'cardiac_arrest' | 'trauma' | 'pediatric';
  /** True for entries the user added; built-in entries can be disabled but not deleted. */
  custom: boolean;
}

/** Per-organization (squad/agency) configuration. */
export interface OrgConfig {
  id: string;
  name: string;
  /** Which narrative format this org documents in. */
  formatId: NarrativeFormatId;
  requiredSpecifics: RequiredSpecific[];
  /**
   * Free-text house style rules appended to the generation prompt
   * (e.g. "use 24-hour clock", "never abbreviate medication names").
   */
  houseStyle: string;
  updatedAt: string;
}

export type CertLevel = 'EMR' | 'EMT' | 'AEMT' | 'EMT-I' | 'Paramedic' | 'Critical Care';

/** The individual user's setup. Drives protocol scoping and narrative voice. */
export interface ProviderProfile {
  /** Two-letter US state/territory code, or '' if not yet set. */
  state: string;
  certLevel: CertLevel;
  /** Optional: appears in the narrative signature line if set. */
}

export type CaptureMode = 'bullets' | 'dictation' | 'live';

export type CoverageStatus = 'present' | 'unclear' | 'missing';

/** The model's assessment of one required specific against the user's input. */
export interface CoverageItem {
  specificId: string;
  status: CoverageStatus;
  /** Where in the input this was found, or why it is considered missing. */
  evidence: string;
  /** The follow-up question to ask. Empty when status is 'present'. */
  question: string;
}

/** A follow-up question presented to the user, plus their answer. */
export interface FollowUp {
  specificId: string;
  label: string;
  question: string;
  answer: string;
  /** 'skipped' means the user explicitly declined; it is recorded, not silently dropped. */
  state: 'open' | 'answered' | 'skipped';
}

export interface MedicationNote {
  name: string;
  commonlyUsedFor: string;
  note: string;
}

export interface ConditionNote {
  name: string;
  whatItInvolves: string;
  note: string;
}

/**
 * Informational reference material about medications/history mentioned in the
 * encounter. Explicitly NOT part of the PCR narrative and never merged into it.
 */
export interface ClinicalReference {
  generatedAt: string;
  medications: MedicationNote[];
  conditions: ConditionNote[];
  /** Explanatory (not directive) note on how the above may relate to the presentation. */
  possibleRelevance: string;
  /** Terms the model could not confidently identify. */
  notIdentified: string[];
}

export type ReportStatus = 'capturing' | 'awaiting_answers' | 'complete';

export interface Report {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ReportStatus;
  captureMode: CaptureMode;
  /** True when the user has flagged this as practice/training data (default on). */
  practiceMode: boolean;
  /** The user's raw notes or transcript. Never rewritten in place. */
  rawInput: string;
  /** Local file URI of a live recording, when one exists. Never uploaded. */
  /**
   * Legacy. Live capture used to record an audio file and transcribe it later;
   * it now transcribes on the device as you speak and never writes audio. This
   * stays so that `Erase all data` still cleans up a file left by an early
   * build, and nothing sets it any more.
   */
  audioUri?: string;
  /** Generated narrative, if generation has run. */
  narrative?: string;
  /** Snapshot of the org config used, so an old report stays reproducible. */
  org: {
    id: string;
    name: string;
    formatId: NarrativeFormatId;
    formatLabel: string;
  };
  followUps: FollowUp[];
  reference?: ClinicalReference;
  /** Human-readable audit trail of what happened to this report, newest last. */
  history: { at: string; event: string }[];
}

/** Summary row used by the report list, so the list does not decrypt every body. */
export interface ReportSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ReportStatus;
  captureMode: CaptureMode;
  practiceMode: boolean;
  /** First meaningful line of the input, for display only. */
  preview: string;
  openQuestionCount: number;
}
