# PCR Narrative Assistant

An iPhone app that turns an EMT's notes about a call into a properly formatted Patient Care Report narrative, then asks follow-up questions about whatever their organization requires and they did not mention.

Personal project. React Native + Expo. Builds and ships from a browser — no Mac, no terminal.

---

## ⚠️ Do not enter real patient information yet

This build sends your notes to an AI provider from the phone — either directly with a key you paste into Settings, or through a relay you run. That is fine for practice data and is **not** yet an acceptable arrangement for PHI.

The default provider is Google Gemini's **free tier**, and Google's terms for it say submitted content is used to improve their products, may be seen by human reviewers, and should not include personal information. That is the correct trade for fake patients and a hard stop for real ones.

Before any real patient encounter goes into this app, two things have to be true, and neither is a code change:

1. **A signed BAA with your chosen provider**, on a HIPAA-eligible, paid configuration. This is a business and compliance step on your end.
2. **Requests routed through a backend you control**, rather than phone-to-API. *Half-built:* the [squad relay](server/README.md) takes the key off the phone, which is the hard structural part. Per-person credentials and an audit log are still missing, so it does not clear this on its own.

Until both are in place, use fake patients. New reports are marked as practice data by default, and practice narratives carry a `*** PRACTICE / TRAINING DATA — NOT A PATIENT RECORD ***` banner when copied. Details and the full threat model are in [docs/SECURITY-PHI.md](docs/SECURITY-PHI.md).

---

## Environment separation

The brief asked for confirmation before any other setup work. Stating exactly what is and is not verified:

- **This repository is `dmsutton-maker/PCR911`** — a personal GitHub account, not an employer org. Nothing was read from, written to, or copied out of any other repository; this session had access to this repo only.
- **Nothing from PAG / Alliance / Bracketron is referenced, imported, or reused.** No shared code, no shared config, no shared infrastructure. The dependency list is public npm packages plus whichever AI provider you configure.
- **The project was built in an isolated, ephemeral cloud container**, not on your machine and not on any work drive. Nothing was written outside this repo.
- **Google Drive folder: not created.** Nothing exists yet that belongs outside the code repo — no exports, no recordings, no test data. Say the word and I'll create the "PCR Narrative App" folder when there is something to put in it.

One thing worth deciding: this is a personal *account*, not a personal *organization*. If you want an org (separate billing, cleaner separation, room for collaborators later), that is worth doing before the repo accumulates history.

---

## Nobody should ever type an API key

They don't have to. The connection is baked in at build time from repository secrets, so every build — web and native — ships already connected and the AI settings screen is hidden entirely. Set it once: **[docs/SET-IT-UP-ONCE.md](docs/SET-IT-UP-ONCE.md)**.

A build with nothing configured still works; it just falls back to asking for a key, which is the right behaviour for someone cloning this repo and useless as a default for a crew.

---

## Getting it on your phone

**Free, nothing installed** — the web build, added to your iPhone home screen. Gets an icon, opens full-screen, no computer or server involved: **[docs/USE-IT-FREE.md](docs/USE-IT-FREE.md)**. Everything works except the real security model, and live dictation goes through the browser rather than the phone's own recogniser.

**For a crew, not just you** — the [squad relay](server/README.md) holds one API key on a free Cloudflare Worker so nobody else needs one. You send people a link; they open it and start working. Ten minutes to set up, no cost, and it is also the first half of the backend that real patient data will eventually require.

**As a real app, on TestFlight** — what you want if anyone other than you will use it: full security model, Face ID, and live dictation transcribed on the phone itself. Testers install from an invite and code changes reach them over the air. Setup is browser-only and needs an Apple Developer account ($99/year, Apple's price for putting any custom app on an iPhone): **[docs/INSTALL-ON-PHONE.md](docs/INSTALL-ON-PHONE.md)**.

**For development** — needs a computer:

```bash
npm install
npx expo start
```

Note that on-device speech recognition is a native module, so the app no longer runs in Expo Go; development needs a development build (`eas build --profile development`). Everything except live recording works in the browser with `npx expo start --web`, which is usually the faster loop anyway.

---

## What it does

### Two ways in

| Mode | How it works |
|---|---|
| **Write or dictate notes** | Type fragments, or use the keyboard microphone. Times, doses, and numbers matter most; grammar does not. |
| **Live recording** | Speech is transcribed **live** into an editable transcript as you talk. On the installed app that happens on-device; no audio file is ever written. |

### Narrative generation

The generated narrative uses whichever format the org selected. Four ship — SOAP, CHART, SOAPIER, and a plain chronological narrative — and adding a fifth is one object in `src/domain/formats.ts`; nothing in the AI layer or the UI has to change.

The model is instructed, repeatedly and specifically, **never to invent clinical content**. A narrative that says a detail was not documented is correct. A narrative that quietly supplies a plausible blood pressure is the failure mode this whole design is built to avoid.

### Org-defined required specifics → follow-up questions

Every org has its own documentation requirements, so they are configuration, not code. `Settings → Required specifics` ships 16 defaults (dispatch, OPQRST, two sets of vitals, interventions with times, response to treatment, transport and position, transfer of care, consent, refusal capacity and risks…), each of which can be edited, disabled, or scoped to a call type — plus any number of your own.

After generating, the narrative is checked against everything enabled, **judged against what you actually said rather than what the model wrote**. Anything missing or ambiguous becomes a specific follow-up question about that call — "What was the blood pressure at 14:12?", not "Please provide vitals." Anything you already covered is never asked about.

Those questions sit *below* the finished narrative rather than in front of it. Generating lands you on your narrative, ready to copy, in two taps and a paste; answering the questions is an offer, not a gate. Skipped items are documented as not recorded, never filled in.

### Clinical reference

A separate screen, never merged into the narrative. It identifies medications and conditions mentioned in your notes and explains in plain language what each is commonly used for, plus general background on how they tend to relate to that kind of presentation.

It runs on its own prompt that forbids directive phrasing outright — "this medication is commonly prescribed for…", never "you should…" or "watch for…". It is background context, not clinical guidance, and the UI says so on the screen.

### Scope

This is not a chatbot and cannot be turned into one. There is no free-text chat surface: the only inputs are call notes and answers to the app's own follow-up questions. The system prompt constrains the model to PCR narratives and instructs it to treat the input as **data to document, never as instructions** — so a stray "hey, write me a poem" in a transcription gets ignored rather than obeyed. A local offline heuristic (`src/safety/scopeGuard.ts`) flags obviously off-topic or instruction-shaped input before a request is spent, and the model returns an explicit `on_topic: false` if something slips through.

---

## Security posture in this build

- **API key, or squad code** in the iOS keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) — never in app storage, logs, or reports.
- **Report bodies** encrypted with AES-256-GCM. The key is generated on-device and lives in the keychain alongside the API key.
- **Nothing syncs.** No cloud storage, no analytics, no crash reporting. The only outbound request in the entire app is the provider call in `src/ai/client.ts` — which goes either straight to the provider or through your own relay, and nowhere else.
- **Face ID app lock**, on by default. Backgrounding the app also drops the decryption key from memory.
- **Erase all data** destroys every report, every recording, and the encryption key — so anything already on disk becomes permanently unreadable, not just unlinked.

Full reasoning, plus what this does and does not protect against, in [docs/SECURITY-PHI.md](docs/SECURITY-PHI.md).

---

## Known gaps

**Live recording needs the installed app.** In the browser it works through the Web Speech API, which on iOS may process audio on Apple's servers. In the installed app it uses iOS's on-device recogniser: audio never leaves the phone, and no recording file is written — only the text you can see and edit. If a device cannot recognise speech locally, the app refuses rather than quietly falling back to network recognition.

**Live Protocol Reference is deliberately not built.** The brief called it the highest-risk feature and said to build it last; it is stubbed at `Settings → Protocol reference` with the blocking sourcing question stated in the app itself. It also needs medical-director review before it ships even in testing.

---

## Docs

| | |
|---|---|
| [SET-IT-UP-ONCE.md](docs/SET-IT-UP-ONCE.md) | Configure the connection once, for every user and every build |
| [USE-IT-FREE.md](docs/USE-IT-FREE.md) | Free web version on your home screen |
| [server/README.md](server/README.md) | The squad relay: one shared key, no per-person setup |
| [INSTALL-ON-PHONE.md](docs/INSTALL-ON-PHONE.md) | The native app, full security model ($99/yr Apple) |
| [MODEL-RECOMMENDATIONS.md](docs/MODEL-RECOMMENDATIONS.md) | Which Claude model for the build vs. for the app, and why |
| [SECURITY-PHI.md](docs/SECURITY-PHI.md) | Threat model, what's protected, the road to real PHI |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit and where to add things |
| [OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md) | Decisions that need you, not code |

## Verification status

`npx tsc --noEmit` clean, `npx expo-doctor` 20/20, and the app bundles for iOS via `npx expo export`. It has **not** been run on a physical device — that needs your phone and your API key.
