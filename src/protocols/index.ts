/**
 * Live Protocol Reference — placeholder.
 *
 * Nothing here is wired up. This module exists to hold the shape the feature
 * would take and, more importantly, the unresolved question that has to be
 * answered before any of it can be built. See docs/OPEN-QUESTIONS.md.
 *
 * The hard design constraint, recorded here so it survives contact with a
 * future implementation: this feature retrieves and displays the verbatim text
 * of a real, published, dated state protocol document. It never generates,
 * paraphrases, summarises, or infers protocol content. If a lookup misses, the
 * correct behaviour is to show nothing.
 */

export interface ProtocolSection {
  /** Two-letter state code the document belongs to. */
  state: string;
  /** Certification levels this section applies to. */
  certLevels: string[];
  /** Section identifier as printed in the source document, e.g. "2.14". */
  sectionNumber: string;
  title: string;
  /** Verbatim protocol text. Never model-generated. */
  body: string;
  /** Provenance, so what is on screen can always be traced to a real document. */
  source: {
    documentTitle: string;
    publisher: string;
    effectiveDate: string;
    url?: string;
  };
}

export interface ProtocolProvider {
  /** Documents currently loaded for a state, or an empty array if none. */
  availableFor(state: string): ProtocolSection[];
  /** Match a chief complaint or situation to sections. Returns [] when unsure. */
  lookup(state: string, certLevel: string, term: string): ProtocolSection[];
}

/** No protocol content ships with this app, and none is fetched. */
export const PROTOCOL_SOURCING_STATUS = {
  question:
    'Where does authoritative, current protocol text come from, and who is on the hook when it goes stale?',
  detail:
    'State EMS protocols are published as PDFs on a per-state (and often per-region or per-agency) basis, under varying licences, and they are revised on their own schedules. Bundling a stale copy into an app used on live calls is a real patient-safety problem, not a data-freshness annoyance. The options are: link out to the official PDF and never host text; license a commercial protocol aggregator; or scope the feature to a single agency whose medical director owns the document and its revisions. That decision, and medical-director sign-off, come before any code.',
} as const;
