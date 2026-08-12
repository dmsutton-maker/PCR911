import { enabledSpecifics } from '@/state/settingsStore';
import type {
  CoverageItem,
  FollowUp,
  OrgConfig,
  ProviderProfile,
  RequiredSpecific,
} from '@/domain/types';
import { requestJson } from './client';
import { buildNarrativeSystemPrompt, buildNarrativeUserContent } from './prompts';
import { NARRATIVE_SCHEMA } from './schemas';

interface RawNarrativeResponse {
  on_topic: boolean;
  off_topic_reason: string;
  narrative: string;
  coverage: {
    specific_id: string;
    status: 'present' | 'unclear' | 'missing';
    evidence: string;
    question: string;
  }[];
}

export interface NarrativeResult {
  onTopic: boolean;
  offTopicReason: string;
  narrative: string;
  coverage: CoverageItem[];
  /** Coverage turned into askable questions, in the org's configured order. */
  followUps: FollowUp[];
}

/**
 * Generate (or regenerate) the narrative and check it against the org's
 * required specifics in a single request.
 *
 * Passing `answers` folds the provider's follow-up responses into the narrative
 * and re-runs coverage, so the same function serves both the first draft and
 * every refinement.
 */
export async function composeNarrative(args: {
  modelId: string;
  org: OrgConfig;
  profile: ProviderProfile;
  rawInput: string;
  answers?: FollowUp[];
  previousNarrative?: string;
  signal?: AbortSignal;
}): Promise<NarrativeResult> {
  const specifics = enabledSpecifics(args.org);

  const answered = (args.answers ?? [])
    .filter((f) => f.state === 'answered' && f.answer.trim().length > 0)
    .map((f) => ({ question: f.question, answer: f.answer.trim() }));

  const raw = await requestJson<RawNarrativeResponse>({
    model: args.modelId,
    system: buildNarrativeSystemPrompt(args.org, args.profile),
    userContent: buildNarrativeUserContent({
      rawInput: args.rawInput,
      answers: answered,
      previousNarrative: args.previousNarrative,
    }),
    schema: NARRATIVE_SCHEMA as unknown as Record<string, unknown>,
    // Narrative work benefits from real reasoning; this is the one call in the
    // app where quality clearly beats latency.
    effort: 'medium',
    signal: args.signal,
  });

  const coverage: CoverageItem[] = raw.coverage.map((c) => ({
    specificId: c.specific_id,
    status: c.status,
    evidence: c.evidence,
    question: c.question,
  }));

  return {
    onTopic: raw.on_topic,
    offTopicReason: raw.off_topic_reason,
    narrative: raw.narrative,
    coverage,
    followUps: buildFollowUps(coverage, specifics, args.answers ?? []),
  };
}

/**
 * Turn a coverage report into the follow-up list shown to the user.
 *
 * Anything the provider already answered or explicitly skipped stays settled —
 * a regeneration must never re-ask a question the user has dealt with.
 */
export function buildFollowUps(
  coverage: CoverageItem[],
  specifics: RequiredSpecific[],
  existing: FollowUp[],
): FollowUp[] {
  const byId = new Map(specifics.map((s) => [s.id, s]));
  const settled = new Map(
    existing.filter((f) => f.state !== 'open').map((f) => [f.specificId, f]),
  );

  const outstanding: FollowUp[] = [];

  for (const specific of specifics) {
    const item = coverage.find((c) => c.specificId === specific.id);
    if (!item || item.status === 'present') continue;

    const prior = settled.get(specific.id);
    if (prior) {
      outstanding.push(prior);
      continue;
    }

    outstanding.push({
      specificId: specific.id,
      label: specific.label,
      question: item.question.trim() || specific.question,
      answer: '',
      state: 'open',
    });
  }

  // Preserve settled answers for specifics the model now considers covered, so
  // the audit trail of what the provider was asked survives regeneration.
  for (const prior of settled.values()) {
    if (!outstanding.some((f) => f.specificId === prior.specificId)) {
      const specific = byId.get(prior.specificId);
      if (specific) outstanding.push(prior);
    }
  }

  return outstanding;
}

/** The banner stamped on practice-mode output so it can never be mistaken for a record. */
export const PRACTICE_BANNER =
  '*** PRACTICE / TRAINING DATA — NOT A PATIENT RECORD — DO NOT FILE ***';

/** Narrative as the user would paste it into their ePCR. */
export function exportNarrative(narrative: string, practiceMode: boolean): string {
  if (!practiceMode) return narrative;
  return `${PRACTICE_BANNER}\n\n${narrative}\n\n${PRACTICE_BANNER}`;
}
