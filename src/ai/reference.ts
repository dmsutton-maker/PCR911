import type { ClinicalReference } from '@/domain/types';
import { nowIso } from '@/util/time';
import { requestJson } from './client';
import type { AiConfig } from './providers';
import { buildReferenceUserContent, REFERENCE_SYSTEM_PROMPT } from './prompts';
import { REFERENCE_SCHEMA } from './schemas';

interface RawReference {
  medications: { name: string; commonly_used_for: string; note: string }[];
  conditions: { name: string; what_it_involves: string; note: string }[];
  possible_relevance: string;
  not_identified: string[];
}

/**
 * Clinical reference lookup — a separate, opt-in call.
 *
 * This never touches the narrative. The result is stored alongside the report
 * and displayed on its own screen, clearly labelled as background context.
 */
export async function lookupClinicalReference(args: {
  config: AiConfig;
  rawInput: string;
  narrative?: string;
  signal?: AbortSignal;
}): Promise<ClinicalReference> {
  const raw = await requestJson<RawReference>({
    config: args.config,
    system: REFERENCE_SYSTEM_PROMPT,
    userContent: buildReferenceUserContent(args.rawInput, args.narrative),
    schema: REFERENCE_SCHEMA as unknown as Record<string, unknown>,
    // Recall of common drug/condition facts, not reasoning — low effort keeps
    // this fast enough to run while the provider is still at the hospital.
    effort: 'low',
    signal: args.signal,
  });

  return {
    generatedAt: nowIso(),
    medications: raw.medications.map((m) => ({
      name: m.name,
      commonlyUsedFor: m.commonly_used_for,
      note: m.note,
    })),
    conditions: raw.conditions.map((c) => ({
      name: c.name,
      whatItInvolves: c.what_it_involves,
      note: c.note,
    })),
    possibleRelevance: raw.possible_relevance,
    notIdentified: raw.not_identified,
  };
}
