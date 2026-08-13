# Security and PHI

## The bottom line

**This build must not be used with real patient information.** Not because of a bug, but because a required compliance arrangement does not exist yet. Two things have to be true first, and neither one is code:

1. **A signed BAA with your provider**, on a HIPAA-eligible API configuration.
2. **A backend you control**, so requests do not go phone-to-API with an embedded key.

Item 2 now has an implementation — the squad relay in [`server/`](../server/README.md) — but deploying it does not by itself clear the gate. See [The squad relay](#the-squad-relay) below for what it does and does not settle.

Everything below describes what the app does protect, so the gap is visible rather than implied.

---

## What this build protects

### The API key, or the squad code in its place

Whichever credential this phone holds — a personal provider key, or a squad code for a relay — it is stored in the iOS keychain via `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. That accessibility class means it is unreadable while the device is locked, and it is excluded from iCloud and encrypted-iTunes backups.

It is read per-request inside `src/ai/client.ts` and never placed in app state, never logged, never written to a report. It is never rendered back to the UI after saving — Settings shows "a key is stored", not the key.

### Report bodies at rest

Reports are encrypted with **AES-256-GCM** before they touch the filesystem. The key is 32 bytes from the platform CSPRNG, generated on first use and stored in the keychain next to the API key. Envelope format is `v1.<nonce>.<ciphertext>` with a fresh 96-bit nonce per write; GCM's authentication tag means tampering is detected on read rather than silently decrypting to garbage.

iOS already encrypts app data at rest through Data Protection, so this is a second layer. What it adds on top:

- Report files are unreadable while the device is locked, not merely while iOS is running.
- The files are useless if lifted out of a filesystem dump or a backup.
- **Instant crypto-shred.** `Erase all data` deletes one keychain entry, and every report on disk becomes permanently undecryptable — no need to trust that a file delete actually overwrote flash.

The cipher is pure JavaScript (`@noble/ciphers` — maintained, audited, no native module) so it runs in Expo Go. Report bodies are a few kilobytes, so the cost is not measurable. If you later want the platform crypto implementation, `src/storage/crypto.ts` is the only file that changes.

### Access to the app

Face ID / passcode gate, on by default. It fires on cold start and again whenever the app has been backgrounded for more than 30 seconds. Re-locking also wipes the cached decryption key from memory, so a backgrounded process is not sitting on decryptable reports.

If the device has no passcode or biometrics enrolled, the app opens and tells you the lock is unavailable rather than stranding you.

### Data flow

There is **one** outbound network call in the entire app: the provider request in `src/ai/client.ts`, which goes either straight to the provider or through your relay. No cloud sync, no analytics, no crash reporting, no telemetry. Audio never leaves the device — and on the installed app no audio file is created at all, because speech is recognised on the phone and only the resulting text is kept.

(One exception, and it carries no patient data: the relay health check in `src/ai/connection.ts`, a `GET /v1/health` fired only when you tap Connect or Test connection in Settings.)

Notes are saved locally as you type. Nothing is transmitted until you explicitly tap Generate.

---

## The squad relay

`server/worker.js` is a small Cloudflare Worker that holds one provider key and authenticates callers with a squad code. When the app is in **Squad account** mode, the phone sends its notes and a code; the relay adds the key and forwards the request. Setup is in [server/README.md](../server/README.md).

**What it settles.** The key stops living on phones. That means it can be rotated without shipping a build, a person's access can be withdrawn without touching their device, usage is visible in one place, and a lost phone leaks a revocable squad code rather than a provider credential. This is the structural fix that step 2 of the road below asks for, and it is a genuine improvement over phone-to-API regardless of what happens with the BAA.

**What it does not settle.** Three things, and none of them is small:

- **No BAA, no PHI.** The relay changes who holds the key, not who processes the data. Gemini's free tier is explicitly the wrong side of this: Google's terms say submitted content is used to improve their products and may be seen by human reviewers.
- **A squad code is not an identity.** It says a request came from somebody holding the code. It cannot say who, cannot be tied to a person, and cannot produce the audit trail a real deployment needs. Per-person credentials are still unbuilt.
- **The relay is another processor.** Requests pass through Cloudflare's network in the clear at the edge. That is one more organisation touching the data, and one more BAA to think about.

There is also a distribution property worth stating plainly: an invite link carries the squad code in its URL fragment. The fragment is never sent to a web server, and the app removes it from the address bar and browser history on arrival — but anyone who receives the link has the code. Treat one like a shared password, which is why the relay accepts a list of codes rather than one.

---

## What this build does not protect against

Stated plainly, because a security section that only lists wins is not useful:

- **Anything after the request leaves the phone.** Without a BAA, your notes are processed under standard commercial API terms. This is the blocking issue.
- **A key extracted from a compromised device.** Keychain raises the bar; it does not make extraction impossible on a jailbroken or physically compromised phone. A phone-embedded key also cannot be rotated per user or revoked centrally when a phone is lost — which is the structural argument for the proxy, independent of the BAA.
- **Screenshots and the clipboard.** Copying a narrative puts it on the iOS pasteboard, which other apps can read. That is inherent to the "paste it into your ePCR" workflow.
- **Shoulder surfing.** No blur-on-app-switcher yet; worth adding before real use.
- **Rogue dependencies.** Standard npm supply-chain exposure. The dependency list is deliberately small and every runtime package is either Expo-maintained or `@noble`.

---

## The road to real PHI

In the order it has to happen:

**1. Compliance first (yours, not code).** Get the BAA in place with Anthropic on a HIPAA-eligible configuration. Nothing below matters until this exists.

**2. Move the API call behind a backend.** *Partly done.* The squad relay does the key-custody half: the phone no longer holds a provider key, and one can be rotated or revoked centrally. What is still missing is per-person credentials and an audit log — a shared squad code identifies a group, not a user, so "who generated what and when" is unanswerable today.

Finishing this means replacing the shared code with per-person tokens and having the relay write an access log. The app-side change is small: `src/ai/connection.ts` decides what credential to send and `src/ai/client.ts` is the only file that talks to the network. Every prompt, schema, and screen is unaffected.

**3. Audio.** *Decided.* Live recording uses iOS's on-device recogniser, so patient audio never leaves the phone and no third BAA is needed. No recording file is written either — the audio-file capture path was removed rather than left available, since stored recordings of patient encounters are a liability the text-only path does not carry. If a device cannot recognise speech locally the app refuses and says so; it must never fall back to network recognition, because that is a decision with a BAA attached and not one a fallback should make quietly.

**4. Add retention limits.** Right now reports live until manually deleted. Real use wants automatic purge after N days, since a narrative is copied into the ePCR of record within minutes — this app has no reason to be a long-term store.

**5. Consider what the org-config surface implies.** A configurable required-specifics list is a per-org feature. The moment it needs to be *administered* by someone other than the user, this stops being a local-only app and becomes one with a backend, accounts, and a whole new set of compliance questions. Worth being deliberate about when that line gets crossed.

---

## Practice mode

New reports are marked as practice data by default. Practice narratives carry a `*** PRACTICE / TRAINING DATA — NOT A PATIENT RECORD — DO NOT FILE ***` banner top and bottom whenever they are copied, so a training narrative cannot be quietly pasted into a real chart.

Leave it on until step 1 above is done.
