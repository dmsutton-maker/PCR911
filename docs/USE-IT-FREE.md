# Using it free, with nothing installed

The browser version of the app, added to your iPhone home screen. It gets an icon, opens full-screen with no Safari address bar, and works like an app.

**Cost: nothing. Installed: nothing. Running in the background: nothing.**

---

## If someone sent you an invite link

Everything below this section is for the person setting the app up. If you were sent a link, you have two steps and no accounts to create:

1. Open the link **on your iPhone, in Safari**. The app says "You're set up" — it is already connected to your squad's shared account. There is no API key for you to get.
2. Tap **Share** (the square with an arrow at the bottom) → **Add to Home Screen** → **Add**.

That is all. Skip to [Try it](#try-it).

The link contains your squad's access code, so treat it like a password — don't post it anywhere public.

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

1. **Settings → AI provider** → paste a free Gemini key (below), or connect a squad account
2. **Settings → Organization** → squad name (SOAP is already the default format)
3. **Settings → Provider profile** → certification level and state

### Sharing it with other people

If anyone else is going to use this, set up a **squad account** instead of having each person make their own key. It is a small free server that holds one key so nobody else needs one — then you send them a link and they are done.

Ten minutes, once, no cost: **[../server/README.md](../server/README.md)**.

Without it, every person has to create a Google account, generate an API key, and paste it in. It works, but it is a lot to ask of someone at shift change.

### Getting a free Gemini key

1. **aistudio.google.com/apikey** → sign in with your Google account
2. **Create API key**
3. Copy it — it starts with `AIza`

No credit card, no billing setup. The free tier allows a few hundred requests a day, which is far more than a shift's worth of narratives.

**One thing to understand about the free tier:** Google's terms say content you send on the unpaid tier is used to improve their products and may be reviewed by humans, and explicitly tell you not to submit personal information. That is fine for the fake patients you should be using anyway, and it is a hard stop for real ones.

### Why not ChatGPT

There is no free ChatGPT API. The free ChatGPT app and OpenAI's API are separate products with separate billing — a free ChatGPT account gives you zero API credits. OpenAI's only genuinely free option requires opting in to sharing your API traffic for model training, which is the wrong direction for an app headed toward patient data.

Claude is in the app as the paid option, and it is the strongest on terse, fragmentary field notes. It has no free tier either — expect roughly $0.05–0.08 per narrative. Worth switching to once you know the app earns its place.

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

## Recording during a call

This works in the web version, but differently from the installed app. Instead of recording an audio file and transcribing it afterwards, the browser transcribes your speech **live** as you talk, straight into an editable transcript. No audio file is ever created.

Tap **Record during the call** → **Start dictation** → talk. Stop when you're done, fix any mangled names or numbers in the transcript, then generate.

One privacy caveat worth knowing: on iOS, browser speech recognition may send audio to Apple for processing rather than doing it on the phone. Another reason this build is practice-data-only.

If the button says dictation is not available, open the site in Safari directly rather than from the home-screen icon — some iOS versions restrict speech recognition inside home-screen apps.

## What the free web version cannot do

**Real security.** This is the important one:

| | Installed app | This web version |
|---|---|---|
| Credential storage | iOS Keychain, hardware-backed | Browser storage |
| Reports at rest | Encrypted, key in Keychain | Obfuscated, key in the same browser storage |
| Face ID lock | Yes | No |
| Wipe on demand | Destroys the key — data unrecoverable | Clears browser storage |

The web version is fine for practice data, which is all you should be entering anyway until the BAA question is settled. It is **not** a PHI-capable build, and the app says so on its home screen.

If it earns a place in your workflow, `docs/INSTALL-ON-PHONE.md` covers the real installed app — that costs $99/year for Apple's developer program, and it is worth deciding that *after* you know whether you like the thing.

---

## If something goes wrong

- **Page won't load / 404** — the first build may still be running. Check the Actions tab for a green check.
- **Blank white screen** — pull down to refresh. If it persists, screenshot and send it to me.
- **"No API key set" / "Not connected yet"** — Settings → AI provider.
- **"That squad code was not accepted"** — ask whoever sent you the link for a current one; codes can be changed.
- **A red error** — screenshot it and send it. The web build has been tested in a browser here, but not on an actual iPhone.
