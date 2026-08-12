import { composeNarrative } from '@/ai/narrative';
import type { OrgConfig, ProviderProfile, Report } from '@/domain/types';

export interface GenerationOutcome {
  onTopic: boolean;
  offTopicReason: string;
  patch: Partial<Report>;
  openQuestionCount: number;
}

/**
 * Run one generation pass for a report and return the patch to persist.
 *
 * Used for both the first draft and every refinement after the provider answers
 * follow-up questions — the model gets the notes, any answers so far, and the
 * previous draft, and returns a fresh narrative plus a fresh coverage report.
 */
export async function generateForReport(args: {
  report: Report;
  org: OrgConfig;
  profile: ProviderProfile;
  modelId: string;
  signal?: AbortSignal;
}): Promise<GenerationOutcome> {
  const { report, org, profile, modelId, signal } = args;

  const result = await composeNarrative({
    modelId,
    org,
    profile,
    rawInput: report.rawInput,
    answers: report.followUps,
    previousNarrative: report.narrative,
    signal,
  });

  if (!result.onTopic) {
    return {
      onTopic: false,
      offTopicReason: result.offTopicReason,
      patch: {},
      openQuestionCount: 0,
    };
  }

  const openCount = result.followUps.filter((f) => f.state === 'open').length;

  return {
    onTopic: true,
    offTopicReason: '',
    openQuestionCount: openCount,
    patch: {
      narrative: result.narrative,
      followUps: result.followUps,
      status: openCount > 0 ? 'awaiting_answers' : 'complete',
    },
  };
}

/** What to tell the user after a pass finishes. */
export function summarizeOutcome(outcome: GenerationOutcome): string {
  if (!outcome.onTopic) return outcome.offTopicReason;
  if (outcome.openQuestionCount === 0) {
    return 'Narrative generated. Every required specific is covered.';
  }
  return `Narrative generated. ${outcome.openQuestionCount} required specific${
    outcome.openQuestionCount === 1 ? ' is' : 's are'
  } still missing.`;
}
