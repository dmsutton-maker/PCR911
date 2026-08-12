# Open questions

Decisions that need you, not code. Roughly in the order they block things.

---

## 1. HIPAA path — blocks all real use

Getting a BAA with your provider on a HIPAA-eligible API configuration is a business and compliance step, not something solvable in this repo. Until it exists, the app is practice-data-only.

The related engineering work has since been started for a different reason — the [squad relay](../server/README.md) exists because handing an app to a crew meant not making each of them get their own API key, and taking the key off the phone happened to be the same change. So the "backend you control" half of the PHI requirement is now partly real rather than speculative.

**What is still undecided and still needs you:** whether requests should be attributable to a *person*. Today a shared squad code says a request came from someone holding the code. Per-person credentials and an access log are the difference between "we control the key" and "we can answer who generated this narrative and when" — and only the second is something a compliance officer will accept. Building that means deciding whether this app has user accounts, which is a bigger commitment than it sounds.

---

## 2. Transcription for live recording — blocks capture mode 3

This is a real fork in the road, not a TODO.

| Option | Audio leaves phone? | Works in Expo Go? | Extra BAA? |
|---|---|---|---|
| **iOS on-device** (`expo-speech-recognition`) | No | **No** — needs a dev build | No |
| **Cloud STT vendor** | Yes | Yes | Yes |
| **Keyboard dictation** (what ships today) | No | Yes | No |

**My recommendation: on-device, and accept moving off Expo Go.** For an app that will eventually hold PHI, "the audio never leaves the phone" is worth more than the convenience of Expo Go, and Expo Go was always a phase-1 scaffold rather than a destination. A development build is a one-time setup cost (EAS Build, no Mac required) and unlocks other native capabilities you will want anyway.

Worth knowing: keyboard dictation, which the app uses today for the post-call mode, is *also* on-device and needs no native module. That is why post-call dictation works fully right now while live recording does not — the gap is specifically about transcribing a recorded file, not about voice input in general.

**What I need from you:** are you willing to move to a development build? If yes, this gets implemented against `TranscriptionProvider` and live recording becomes fully functional.

---

## 3. Protocol reference sourcing — blocks the highest-risk feature

Flagged in the brief as the feature to build last and review most carefully. Agreed, and it is stubbed rather than half-built.

The blocking question is not technical: **where does authoritative, current protocol text come from, and who owns it when it goes stale?** State EMS protocols are published as PDFs on a per-state (often per-region or per-agency) basis, under varying licences, revised on their own schedules. Bundling a stale copy into an app used on live calls is a patient-safety problem, not a data-freshness annoyance.

Three viable shapes:

1. **Link out only** — the app deep-links to the official PDF and hosts no text. Safest, least useful.
2. **License an aggregator** — a commercial provider that maintains current protocols across states. Costs money, solves freshness, adds a vendor dependency.
3. **Single-agency scope** — support exactly your squad's protocol document, owned and revised by your medical director. Most defensible, least general.

For a personal project used by you on your own squad, **option 3 is the honest answer** — and it makes the medical-director conversation a prerequisite rather than an afterthought, which is where it belongs.

---

## 4. Personal GitHub account vs. organization

The brief asked for a new account *or* organization. This is currently a personal account. An org gives you separate billing, cleaner separation, and room for collaborators or a squad later.

Cheap to do now, annoying once the repo has history and links pointing at it. Worth deciding before much more accumulates.

---

## 5. Retention policy

Reports currently live until manually deleted. In real use the narrative is copied into the ePCR of record within minutes, so this app has no reason to be a long-term store.

Suggested default: auto-purge after 7 days, configurable. Needs your call on the number — and possibly your agency's, since retention of anything PHI-adjacent may be governed by policy.

---

## 6. Whose "org" is this, really?

The org-config surface (format, required specifics, house style) is per-device today. That is right for one person testing on their own phone.

The moment a squad wants a *shared* required-specifics list administered by a training officer, this stops being a local-only app: it needs accounts, a backend, sync, and an entirely new compliance surface. That is a much bigger project than what exists here.

Worth being deliberate about when that line gets crossed, rather than drifting across it one feature at a time.

---

## 7. Smaller things worth a decision eventually

- **Blur on app switcher.** The iOS multitasking snapshot currently shows report content. Easy fix, worth doing before real use.
- **Export beyond clipboard.** Copy-paste is right for now. Share-sheet or direct ePCR integration is a bigger question about which systems your agency uses.
- **Narrative editing.** You can copy and edit outside the app, but not edit in place. Deliberate — an editable narrative raises the question of whether the model's version or yours is authoritative. Worth revisiting once you've used it.
