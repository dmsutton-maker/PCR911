/**
 * JSON Schemas passed to the API as `output_config.format`, so responses are
 * validated server-side and always parse. Keep these in sync with the response
 * types in narrative.ts / reference.ts.
 */

export const NARRATIVE_SCHEMA = {
  type: 'object',
  properties: {
    on_topic: {
      type: 'boolean',
      description:
        'False when the input is not documentation of a patient encounter. When false, narrative must be an empty string.',
    },
    off_topic_reason: {
      type: 'string',
      description:
        'When on_topic is false, one short sentence stating what the input looked like instead. Empty otherwise.',
    },
    narrative: {
      type: 'string',
      description: 'The formatted PCR narrative, or an empty string when on_topic is false.',
    },
    coverage: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          specific_id: { type: 'string' },
          status: { type: 'string', enum: ['present', 'unclear', 'missing'] },
          evidence: {
            type: 'string',
            description:
              'What in the provider notes satisfies this item, or a short statement of what is absent.',
          },
          question: {
            type: 'string',
            description:
              'A specific follow-up question for this call. Empty string when status is present.',
          },
        },
        required: ['specific_id', 'status', 'evidence', 'question'],
        additionalProperties: false,
      },
    },
  },
  required: ['on_topic', 'off_topic_reason', 'narrative', 'coverage'],
  additionalProperties: false,
} as const;

export const REFERENCE_SCHEMA = {
  type: 'object',
  properties: {
    medications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          commonly_used_for: {
            type: 'string',
            description: 'What this medication is commonly prescribed for, in plain language.',
          },
          note: {
            type: 'string',
            description:
              'Optional additional background, such as the drug class. Explanatory only, never directive. Empty string if nothing to add.',
          },
        },
        required: ['name', 'commonly_used_for', 'note'],
        additionalProperties: false,
      },
    },
    conditions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          what_it_involves: {
            type: 'string',
            description: 'What this condition generally involves, in plain language.',
          },
          note: {
            type: 'string',
            description: 'Optional additional background. Explanatory only. Empty string if none.',
          },
        },
        required: ['name', 'what_it_involves', 'note'],
        additionalProperties: false,
      },
    },
    possible_relevance: {
      type: 'string',
      description:
        'General background on how the listed medications and history commonly relate to this kind of presentation. Explanatory, not an assessment of this patient. Empty string if nothing to note.',
    },
    not_identified: {
      type: 'array',
      items: { type: 'string' },
      description: 'Terms that appeared to be a medication or condition but could not be identified.',
    },
  },
  required: ['medications', 'conditions', 'possible_relevance', 'not_identified'],
  additionalProperties: false,
} as const;
