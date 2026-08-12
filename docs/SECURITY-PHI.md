# Security and PHI

## The bottom line

**This build must not be used with real patient information.** Not because of a bug, but because a required compliance arrangement does not exist yet. Two things have to be true first, and neither one is code:

1. **A signed BAA with Anthropic**, on a HIPAA-eligible API configuration.
2. **A backend you control**, so requests do not go phone-to-API with an embedded key.

Everything below describes what the app does protect, so the gap is visible rather than implied.

---

## What this build protects

### The API key

Stored in the iOS keychain via `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. That accessibility class means it is unreadable while the device is locked, and it is excluded from iCloud and encrypted-iTunes backups.

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

There is **one** outbound network call in the entire app: the Claude request in `src/ai/client.ts`. No backend, no cloud sync, no analytics, no crash reporting, no telemetry. Audio recordings never leave the device — not even to the API.

Notes are saved locally as you type. Nothing is transmitted until you explicitly tap Generate.

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

**2. Move the API call behind a backend.** The phone stops holding an Anthropic key and instead authenticates to a service you run, which holds the key and calls the API. This gets you per-user credentials, revocation when a phone is lost, an audit log of who generated what and when, rate limiting, and the ability to rotate a compromised key without shipping a new build.

The change is contained: `src/ai/client.ts` is the only file that talks to the network. Point `ENDPOINT` at your service and swap the `x-api-key` header for a session token. Every prompt, schema, and screen is unaffected.

**3. Decide about audio.** Live-recording transcription is unimplemented today precisely so this decision does not get made by accident — see [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md). On-device iOS recognition means patient audio never leaves the phone and no third BAA is needed. A cloud STT vendor is easier to build and adds another processor of patient audio.

**4. Add retention limits.** Right now reports live until manually deleted. Real use wants automatic purge after N days, since a narrative is copied into the ePCR of record within minutes — this app has no reason to be a long-term store.

**5. Consider what the org-config surface implies.** A configurable required-specifics list is a per-org feature. The moment it needs to be *administered* by someone other than the user, this stops being a local-only app and becomes one with a backend, accounts, and a whole new set of compliance questions. Worth being deliberate about when that line gets crossed.

---

## Practice mode

New reports are marked as practice data by default. Practice narratives carry a `*** PRACTICE / TRAINING DATA — NOT A PATIENT RECORD — DO NOT FILE ***` banner top and bottom whenever they are copied, so a training narrative cannot be quietly pasted into a real chart.

Leave it on until step 1 above is done.
