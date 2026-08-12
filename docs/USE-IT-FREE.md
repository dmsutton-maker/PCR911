# Using it free, with nothing installed

The browser version of the app, added to your iPhone home screen. It gets an icon, opens full-screen with no Safari address bar, and works like an app.

**Cost: nothing. Installed: nothing. Running in the background: nothing.**

---

## What you do — two steps, about three minutes

### Step 1 — turn on hosting (once, ~30 seconds)

1. Go to **github.com/dmsutton-maker/PCR911/settings/pages**
2. Under **Source**, choose **GitHub Actions**
3. That's it — no other fields

Within about three minutes the site builds itself and goes live at:

**https://dmsutton-maker.github.io/PCR911/**

You can watch it build under the repo's **Actions** tab. Green check = ready.

### Step 2 — put it on your home screen (once, ~30 seconds)

On your **iPhone, in Safari** (this does not work in Chrome):

1. Open **https://dmsutton-maker.github.io/PCR911/**
2. Tap the **Share** button — the square with an arrow, at the bottom
3. Scroll down, tap **Add to Home Screen**
4. Tap **Add**

An icon appears on your home screen. Tap it and the app opens full-screen.

---

## Then set it up, in the app

1. **Settings → Claude API** → paste your key
2. **Settings → Organization** → squad name (SOAP is already the default format)
3. **Settings → Provider profile** → certification level and state

### Getting the Claude key

1. **console.anthropic.com** → sign in with a personal account
2. **Billing** → buy credits. $5–10 lasts months at this usage.
3. **Settings → Limits** → set a monthly cap
4. **API keys → Create Key** → copy it immediately, it is shown only once

Easiest way onto the phone: email it to yourself and paste from Mail.

---

## Try it

Tap **Type or dictate bullet notes** and enter this fake call. It deliberately leaves out a few required specifics so you can see the follow-up questions work:

```
58 yo M, chest pain onset 0730 shoveling snow
8/10 crushing substernal, radiates left arm, diaphoretic
hx HTN and MI 2019, meds lisinopril and ASA, NKDA
324 ASA given 0742, 12-lead no STEMI
BP 148/92 P 96 R 20 SpO2 96% RA at 0740
transported to Mercy, semi-Fowler's
```

Tap **Generate narrative**. Fifteen to forty seconds.

You should get a SOAP narrative, then questions about what that scenario genuinely omits — repeat vitals, response to the aspirin, consent, transfer of care. Answer a couple, skip the rest, tap **Update narrative**, and watch it fold your answers in while stating plainly that the skipped items were not documented.

**Dictation works here too.** On any text box, tap the **🎤 on the iPhone keyboard** and talk. That transcription happens on the phone itself. Turn it on at Settings → General → Keyboard → Enable Dictation.

---

## Updates

When I push a code change, the site rebuilds itself within a few minutes. Close and reopen the app and it is current. Nothing for you to do.

---

## What the free web version cannot do

**Recording during a call.** Browsers on iOS cannot do the background audio capture this needs. The other two capture modes — typed bullet notes and post-call dictation — work fully, and those are the ones you would use most anyway.

**Real security.** This is the important one:

| | Installed app | This web version |
|---|---|---|
| API key storage | iOS Keychain, hardware-backed | Browser storage |
| Reports at rest | Encrypted, key in Keychain | Obfuscated, key in the same browser storage |
| Face ID lock | Yes | No |
| Wipe on demand | Destroys the key — data unrecoverable | Clears browser storage |

The web version is fine for practice data, which is all you should be entering anyway until the BAA question is settled. It is **not** a PHI-capable build, and the app says so on its home screen.

If it earns a place in your workflow, `docs/INSTALL-ON-PHONE.md` covers the real installed app — that costs $99/year for Apple's developer program, and it is worth deciding that *after* you know whether you like the thing.

---

## If something goes wrong

- **Page won't load / 404** — the first build may still be running. Check the Actions tab for a green check.
- **Blank white screen** — pull down to refresh. If it persists, screenshot and send it to me.
- **"No API key set"** — Settings → Claude API.
- **A red error** — screenshot it and send it. The web build has been tested in a browser here, but not on an actual iPhone.
