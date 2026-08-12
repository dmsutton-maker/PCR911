# Architecture

## Shape

```
src/
  app/            expo-router screens (file = route)
  domain/         types, narrative-format registry, required-specifics catalog
  ai/             prompts, JSON schemas, provider registry, the one network client
  features/       flows that combine ai + storage
  state/          zustand stores (settings, reports)
  storage/        keychain, AES-GCM, encrypted file vault
  safety/         offline scope heuristic
  audio/          transcription adapter (no provider wired in phase 1)
  protocols/      placeholder for the protocol-reference feature
  components/     UI primitives + app lock
  theme/          palette, spacing, type

server/           the optional squad relay (Cloudflare Worker)
```

The rule that keeps this honest: **`src/ai/client.ts` is the only file that touches the network.** Everything else is local — bar one deliberate exception, `checkRelay()` in `src/ai/connection.ts`, which pings a relay's health endpoint when you tap Connect in Settings and never carries patient data. If a future change adds another outbound call, it should be obvious in review.

---

## Two routes to the provider

`src/ai/connection.ts` decides which one, and it is the only thing that differs between them:

```
own_key   phone ──(x-goog-api-key)──────────────────►  provider
relay     phone ──(x-squad-code)──►  your worker ────►  provider
                                     (holds the key)
```

The request body is identical either way. `src/ai/providers.ts` splits each provider into three parts — `url`, `authHeaders(key)`, and `buildBody(args)` — so the phone can build a body without a key and hand it to the relay, which supplies the other two from its own copy of the same small table. Nothing about prompts, schemas, or response parsing is duplicated, and adding a provider means adding it in both places or the relay simply reports that it has no key for it.

The relay mirrors the providers' `{ error: { message } }` error shape, so one extractor in the client reads relay errors and upstream errors identically. `describeError()` branches on `via` where the same status means different things — a 401 is a bad API key on one route and a bad squad code on the other.

**Invite links** (`src/util/joinLink.ts`) carry the relay address and squad code in the URL *fragment*, which browsers never send to a server. `useJoinLink()` applies one on first launch and then clears it — via `router.replace()` rather than `history.replaceState`, because expo-router keeps its own copy of the initial URL and writes it back on every sync, undoing an external strip within a frame.

---

## The generation flow

```
capture screen
      ↓  raw notes
checkScope()                      offline heuristic, no request
      ↓
generateForReport()
      ↓
composeNarrative()                ONE API call
      ↓
  { narrative, coverage[] }       structured output, schema-validated
      ↓
buildFollowUps()                  coverage → askable questions
      ↓
  open questions?  ── yes ──→ questions screen ──┐
      │                                          │ answers
      no                                         │
      ↓                                          ↓
  report screen  ←────────── composeNarrative() again
```

### Why narrative and coverage come back in one call

The obvious design is two calls: generate, then check the result against the org's list. One call is better here for a reason beyond latency — **the coverage judgment has to be made against what the provider said, not against what the narrative says.** A separate checking call sees only the polished narrative, which reads as more complete than the input was, and will happily mark a specific as covered because the narrative mentions it. Doing both in one pass lets the model judge coverage against the original notes while it still has them, and the prompt says so explicitly.

The same function serves the first draft and every refinement — refinement just adds the provider's answers and the previous draft to the input. So there is one code path to reason about, not two.

### Follow-up questions never regress

`buildFollowUps()` carries settled answers forward across regenerations. A question you already answered or explicitly skipped is never asked again, even though each pass produces a fresh coverage report. Skipped items stay recorded rather than vanishing, so the report keeps an honest trace of what you were asked.

---

## Extension points

**Add a narrative format** — one object in `src/domain/formats.ts`. Sections and their guidance become the prompt; nothing else changes.

**Add a required specific** — at runtime in `Settings → Required specifics`, or as a shipped default in `src/domain/requiredSpecifics.ts`. The generation prompt is assembled from whatever is enabled at generation time, so there is no code path that knows about any specific item.

**Wire up transcription** — implement `TranscriptionProvider` in `src/audio/transcription.ts` and return it from `getTranscriptionProvider()`. The recording screen already handles the "not available" case, so it needs no changes.

**Move to a backend** — change `ENDPOINT` and the auth header in `src/ai/client.ts`. Prompts, schemas, stores, and screens are untouched.

**Add a model** — one entry in `AVAILABLE_MODELS` in `src/domain/defaults.ts`.

---

## Storage

| What | Where | Why |
|---|---|---|
| API key, data key | iOS keychain, device-only | Never in app storage or backups |
| Report bodies | `documents/reports/<id>.enc`, AES-256-GCM | Potential PHI |
| Report index | `documents/reports/index.enc` | So the list doesn't decrypt every body |
| Recordings | `documents/recordings/<id>.m4a` | Local only, never uploaded |
| Org config, profile, prefs | AsyncStorage, plaintext | Contains no patient data |

The index exists so the home screen can render 25 rows without decrypting 25 report bodies. A corrupt or undecryptable index returns an empty list rather than crashing — losing the list is recoverable, a bricked app is not.

---

## State

Two zustand stores, split by lifetime and sensitivity:

- **`settingsStore`** — persisted to AsyncStorage, no patient data. Exposes a `hydrated` flag so the app lock does not decide anything before persisted preferences load.
- **`reportStore`** — not persisted. Holds the report list and the one report currently open. Every mutation writes through to the encrypted vault immediately, so a crash mid-capture loses at most the last keystrokes.

Each report snapshots the org name and format it was generated under, so changing your org settings tomorrow does not retroactively misrepresent a report written today.

---

## The scope fence

Three independent layers, because any one of them can be wrong:

1. **Offline heuristic** (`src/safety/scopeGuard.ts`) — catches empty input, obviously off-topic text, and instruction-shaped phrasing before a request is spent. Warns rather than blocks, because field notes are terse and idiosyncratic and a documentation tool that refuses to document a real call is worse than one that asks.
2. **System prompt** (`src/ai/prompts.ts`) — constrains the model to PCR narratives, tells it the input is data to document rather than instructions to follow, and forbids inventing clinical content.
3. **Structured output** — the response schema carries an explicit `on_topic` boolean, so an off-topic input produces a clean refusal the UI can act on instead of a narrative about nothing.

There is deliberately no free-text chat surface anywhere in the app. The only inputs are call notes and answers to the app's own questions.
