# PCR Narrative Assistant

An iPhone app that turns an EMT's notes about a call into a properly formatted Patient Care Report narrative, then asks follow-up questions about whatever their organization requires and they did not mention.

Personal project. React Native + Expo, testable in Expo Go with no Mac.

---

## ⚠️ Do not enter real patient information yet

This build sends your notes to the Claude API **directly from the phone**, using an API key you paste into Settings. That is fine for practice data and is **not** an acceptable arrangement for PHI.

Before any real patient encounter goes into this app, two things have to be true, and neither is a code change:

1. **A signed BAA with Anthropic**, on a HIPAA-eligible API configuration. This is a business and compliance step on your end.
2. **Requests routed through a backend you control**, rather than phone-to-API. An API key living on a phone cannot be rotated, scoped per user, audited, or revoked when the phone is lost.

Until both are in place, use fake patients. New reports are marked as practice data by default, and practice narratives carry a `*** PRACTICE / TRAINING DATA — NOT A PATIENT RECORD ***` banner when copied. Details and the full threat model are in [docs/SECURITY-PHI.md](docs/SECURITY-PHI.md).

---

## Environment separation

The brief asked for confirmation before any other setup work. Stating exactly what is and is not verified:

- **This repository is `dmsutton-maker/PCR911`** — a personal GitHub account, not an employer org. Nothing was read from, written to, or copied out of any other repository; this session had access to this repo only.
- **Nothing from PAG / Alliance / Bracketron is referenced, imported, or reused.** No shared code, no shared config, no shared infrastructure. The dependency list is public npm packages plus the Anthropic API.
- **The project was built in an isolated, ephemeral cloud container**, not on your machine and not on any work drive. Nothing was written outside this repo.
- **Google Drive folder: not created.** Nothing exists yet that belongs outside the code repo — no exports, no recordings, no test data. Say the word and I'll create the "PCR Narrative App" folder when there is something to put in it.

One thing worth deciding: this is a personal *account*, not a personal *organization*. If you want an org (separate billing, cleaner separation, room for collaborators later), that is worth doing before the repo accumulates history.

---

## Getting it on your phone

**Free, nothing installed** — the web build, added to your iPhone home screen. Gets an icon, opens full-screen, no computer or server involved. Two steps, about three minutes: **[docs/USE-IT-FREE.md](docs/USE-IT-FREE.md)**. Typed notes and dictation work fully; live recording and the real security model do not. Start here.

**As a native app** — full security model, Face ID, live recording: [docs/INSTALL-ON-PHONE.md](docs/INSTALL-ON-PHONE.md). Browser-only setup, but $99/year for an Apple Developer account — Apple's price for putting a custom app on an iPhone. Code changes then ship over the air.

**For development** — needs a computer running a dev server the whole time you use the app:

```bash
npm install
npx expo start
```

Scan the QR code with the Camera app. On first launch:

1. **Settings → Claude API** — paste your key. Use one scoped to a workspace with a spend limit; it is sitting on a phone.
2. **Settings → Organization** — set your squad name and narrative format (SOAP is the default).
3. **Settings → Provider profile** — certification level and state.

Then start a report from the home screen.

---

## What it does

### Three capture modes

| Mode | How it works |
|---|---|
| **Bullet notes** | Type fragments. Times, doses, and numbers matter most; grammar does not. |
| **Post-call dictation** | Talk through the call using the keyboard microphone. iOS transcribes **on-device** — no audio leaves the phone, and it needs no native module, so it works in Expo Go. |
| **Live recording** | Records to the device during the call and stores the audio locally. Automatic transcription is **not wired up** — see [Known gaps](#known-gaps). |

### Narrative generation

The generated narrative uses whichever format the org selected. Four ship — SOAP, CHART, SOAPIER, and a plain chronological narrative — and adding a fifth is one object in `src/domain/formats.ts`; nothing in the AI layer or the UI has to change.

The model is instructed, repeatedly and specifically, **never to invent clinical content**. A narrative that says a detail was not documented is correct. A narrative that quietly supplies a plausible blood pressure is the failure mode this whole design is built to avoid.

### Org-defined required specifics → follow-up questions

Every org has its own documentation requirements, so they are configuration, not code. `Settings → Required specifics` ships 16 defaults (dispatch, OPQRST, two sets of vitals, interventions with times, response to treatment, transport and position, transfer of care, consent, refusal capacity and risks…), each of which can be edited, disabled, or scoped to a call type — plus any number of your own.

After generating, the narrative is checked against everything enabled, **judged against what you actually said rather than what the model wrote**. Anything missing or ambiguous becomes a specific follow-up question about that call — "What was the blood pressure at 14:12?", not "Please provide vitals." Anything you already covered is never asked about. Answer, skip, or ignore: skipped items are documented as not recorded, never filled in.

### Clinical reference

A separate screen, never merged into the narrative. It identifies medications and conditions mentioned in your notes and explains in plain language what each is commonly used for, plus general background on how they tend to relate to that kind of presentation.

It runs on its own prompt that forbids directive phrasing outright — "this medication is commonly prescribed for…", never "you should…" or "watch for…". It is background context, not clinical guidance, and the UI says so on the screen.

### Scope

This is not a chatbot and cannot be turned into one. There is no free-text chat surface: the only inputs are call notes and answers to the app's own follow-up questions. The system prompt constrains the model to PCR narratives and instructs it to treat the input as **data to document, never as instructions** — so a stray "hey Claude, write me a poem" in a transcription gets ignored rather than obeyed. A local offline heuristic (`src/safety/scopeGuard.ts`) flags obviously off-topic or instruction-shaped input before a request is spent, and the model returns an explicit `on_topic: false` if something slips through.

---

## Security posture in this build

- **API key** in the iOS keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) — never in app storage, logs, or reports.
- **Report bodies** encrypted with AES-256-GCM. The key is generated on-device and lives in the keychain alongside the API key.
- **Nothing syncs.** No backend, no cloud storage, no analytics, no crash reporting. The only outbound request in the entire app is the Claude call in `src/ai/client.ts`.
- **Face ID app lock**, on by default. Backgrounding the app also drops the decryption key from memory.
- **Erase all data** destroys every report, every recording, and the encryption key — so anything already on disk becomes permanently unreadable, not just unlinked.

Full reasoning, plus what this does and does not protect against, in [docs/SECURITY-PHI.md](docs/SECURITY-PHI.md).

---

## Known gaps

**Live-recording transcription is not implemented.** This is the one real functional gap, and it is worth understanding why rather than treating it as a TODO:

- The Claude API does not accept audio, so transcription cannot share the narrative pipeline.
- iOS on-device recognition is the right answer for PHI — audio never leaves the phone — but it is a native module and **cannot run in Expo Go**, which is the whole point of the current test setup.
- A cloud STT vendor works in Expo Go today but adds a second processor of patient audio, and therefore a second BAA.

So phase 1 records and stores the audio, and you play it back while typing or dictating your summary. `src/audio/transcription.ts` is the adapter to implement once you move to a development build. This is a decision to make, not just code to write — see [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md).

**Live Protocol Reference is deliberately not built.** The brief called it the highest-risk feature and said to build it last; it is stubbed at `Settings → Protocol reference` with the blocking sourcing question stated in the app itself. It also needs medical-director review before it ships even in testing.

---

## Docs

| | |
|---|---|
| [USE-IT-FREE.md](docs/USE-IT-FREE.md) | Free web version on your home screen — start here |
| [INSTALL-ON-PHONE.md](docs/INSTALL-ON-PHONE.md) | The native app, full security model ($99/yr Apple) |
| [MODEL-RECOMMENDATIONS.md](docs/MODEL-RECOMMENDATIONS.md) | Which Claude model for the build vs. for the app, and why |
| [SECURITY-PHI.md](docs/SECURITY-PHI.md) | Threat model, what's protected, the road to real PHI |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit and where to add things |
| [OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md) | Decisions that need you, not code |

## Verification status

`npx tsc --noEmit` clean, `npx expo-doctor` 20/20, and the app bundles for iOS via `npx expo export`. It has **not** been run on a physical device — that needs your phone and your API key.
