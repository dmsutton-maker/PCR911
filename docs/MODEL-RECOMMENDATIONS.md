# Which Claude model to use

Two separate questions, two different answers.

---

## 1. For the coding/build work (this Claude Code session)

**Claude Opus 5 at `xhigh` effort**, and it is not close for this particular project.

The reasoning is about the shape of the work rather than raw capability. This build is long-horizon and cross-cutting: the domain model, the prompt design, the storage encryption, the router structure, and the follow-up-question flow all constrain each other, and a change to the required-specifics data model ripples into the prompt, the schema, the store, and three screens. That is exactly the workload where the frontier model earns its cost — it holds the whole design in context and gets the interfaces right the first time, rather than producing five locally-plausible files that do not compose.

Cost matters less than it looks like it should: a cheaper model that needs three correction rounds on a schema change is not cheaper. Where it genuinely does not matter — renaming things, writing boilerplate screens, adding a fifth narrative format — Sonnet 5 is fine, and you can switch per task.

**Practical note:** give it the whole task up front in one well-specified prompt rather than revealing requirements across ten turns. Your brief was a good example of this: format requirements, org configurability, the scope restriction, and the PHI constraints all arrived together, so the design could account for all of them from the start instead of being retrofitted.

---

## 2. For in-app narrative generation

**Default: Claude Opus 5.** Switchable in `Settings → Claude API`; Sonnet 5 and Haiku 4.5 are also offered.

I set the default to Opus and made it your call rather than silently optimizing for cost, because the tradeoff depends on facts I don't have — your call volume and how terse your notes are.

### The actual tradeoff

| | Opus 5 | Sonnet 5 | Haiku 4.5 |
|---|---|---|---|
| Input / output per 1M tokens | $5 / $25 | $3 / $15 | $1 / $5 |
| Rough cost per narrative¹ | ~$0.08 | ~$0.05 | ~$0.02 |
| Where it shows | Sparse, fragmentary notes | Most calls | Clean, complete notes |

¹ Very rough: ~3K input (system prompt + your notes + 16 required specifics) and ~1.2K output, on a typical call. A refinement pass after follow-up questions roughly doubles it. Even at Opus rates, a busy volunteer shift is single-digit dollars.

**The task is harder than it looks**, which is what argues for the bigger model. It is not "write prose from an outline." It is: infer clinical structure from fragments, place each fragment in the correct section of the chosen format, preserve every time and dose exactly, *and* — the part that actually matters — judge accurately which of 16 required specifics your notes covered, distinguishing what you said from what the narrative now says. That last judgment is the whole value of the follow-up feature. A model that is loose about it either nags you for things you already documented or, much worse, marks something as covered when it is not.

**Where the smaller models are genuinely fine:** if you write disciplined bullet notes that already hit most required specifics, Haiku will produce a good narrative for a quarter of the cost. The gap widens as your input gets sparser — which, realistically, is what post-call dictation at 3am looks like.

**Suggestion:** run Opus 5 for the first few weeks of real use. Then switch to Sonnet 5 for a week and see whether you notice. If you don't, stay there — that is a real ~40% saving, and it is a decision better made from your own narratives than from a table.

### Effort settings

`effort` controls how much the model reasons before answering, independent of which model you pick. The app sets it per call type:

- **Narrative generation: `medium`.** The quality-per-second sweet spot here. `high` produced marginally better section placement in exchange for latency you'd feel standing at a hospital wall.
- **Clinical reference: `low`.** Recall of common drug and condition facts, not reasoning. Low effort keeps it fast enough to run while you're still at the ED.

Both are one-line changes in `src/ai/narrative.ts` and `src/ai/reference.ts` if you want to tune them.

### Why there is no cheap "classifier" model in the mix

An obvious optimization is to run the off-topic check on Haiku before spending a real request. I did it locally instead — `src/safety/scopeGuard.ts` is an offline heuristic that costs nothing, adds no latency, and works with no signal. The model-side `on_topic` flag then catches whatever the heuristic misses, on the request you were making anyway. Adding a third model call to save part of a second one is not worth the moving parts.

---

## A note on model IDs

Model identifiers are pinned in `src/domain/defaults.ts`. When a new generation ships, that is the one file to update — the prompts and schemas are model-independent.
