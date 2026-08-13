# Getting this onto your phone as a real app

The goal: a real app on your home screen, installed from a link, that other people can beta test the same way. No dev server, no QR-code dance, no computer running in the background, and no terminal at any point.

You already have the Apple Developer account, so this is setup, not spending.

---

## What you end up with

**TestFlight.** Apple's beta distribution. You add someone's email, they get an invite, they install the app from TestFlight and use it like anything else. Up to 100 internal testers, no App Store review to get started.

Then day to day:

```
I push a code change
        ↓
GitHub bundles it automatically (about a minute)
        ↓
Everyone's app has it the next time they open it
```

No rebuild, no new TestFlight version, nothing for testers to do. A full rebuild is only needed when something *native* changes — a new native module, a permission string, the icon, the app version. That's rare, and it's a button on a web page.

---

## Setup

Six things, all in a browser. Budget about half an hour, most of it waiting.

### 1. Expo account (~2 min, free)

1. **expo.dev** → sign up
2. **Account settings → Access tokens → Create token**
3. Copy it — this becomes the `EXPO_TOKEN` secret below

### 2. Create the Expo project (~2 min)

1. On expo.dev, create a project named `pcr-narrative-assistant`
2. Copy the **Project ID** (a long `xxxxxxxx-xxxx-…` string)
3. **Send it to me** — it goes in the app config and I'll push it

### 3. Apple Team ID (~1 min)

**developer.apple.com/account** → **Membership details**. The **Team ID** is a ten-character code like `A1B2C3D4E5`. Copy it.

### 4. App Store Connect API key (~5 min)

This is what lets the build sign itself without stopping to ask questions.

1. **appstoreconnect.apple.com** → **Users and Access** → **Integrations** tab
2. **App Store Connect API** → the **+** button
3. Name it anything (`EAS Build`), access role **App Manager**
4. **Generate**
5. **Download** the `.p8` file — Apple lets you download it once, ever
6. From that same page, note two values:
   - the **Key ID** next to your new key
   - the **Issuer ID** above the list

Open the `.p8` in any text editor. It's a short block starting `-----BEGIN PRIVATE KEY-----`. You'll paste the whole thing, including both `-----` lines, in the next step.

### 5. Register the app on App Store Connect (~2 min)

1. **appstoreconnect.apple.com** → **Apps** → **+** → **New App**
2. Platform **iOS**, name **PCR Narrative**
3. Bundle ID: `com.personal.pcrnarrative` — pick it from the list. If it isn't there, create it first at **developer.apple.com/account/resources/identifiers** → **+** → App IDs → App, description "PCR Narrative", explicit bundle ID `com.personal.pcrnarrative`.
4. SKU: anything, e.g. `pcr-narrative`

### 6. Put it all into GitHub (~3 min)

**github.com/dmsutton-maker/PCR911/settings/secrets/actions** → **New repository secret**, once each:

| Name | Value |
|---|---|
| `EXPO_TOKEN` | from step 1 |
| `APPLE_TEAM_ID` | from step 3 |
| `APPLE_ASC_KEY_ID` | from step 4 |
| `APPLE_ASC_ISSUER_ID` | from step 4 |
| `APPLE_ASC_KEY_P8` | the entire contents of the `.p8` file |

And the connection, so testers never see a settings screen — see [SET-IT-UP-ONCE.md](SET-IT-UP-ONCE.md):

| Name | Value |
|---|---|
| `PCR_GEMINI_API_KEY` | a free key, *or* — better — the two relay secrets instead |

---

## Building it

**Actions** tab → **Build iOS app** → **Run workflow**. Leave the profile on `preview` and "send to TestFlight" ticked.

It checks your secrets first and fails immediately with a list of what's missing rather than burning twenty minutes to tell you at the end. Then it builds on Expo's servers — 15 to 30 minutes, and you can close the tab.

When it's done, Apple takes another 5–15 minutes to process the build before it appears in TestFlight.

---

## Getting it on phones

1. **appstoreconnect.apple.com** → your app → **TestFlight**
2. **Internal Testing** → add testers by Apple ID email
3. They get an email, install **TestFlight** from the App Store, and install your app from inside it

Your own phone included — add your own Apple ID as a tester.

No trust-the-developer-profile step, no expiring provisioning profile to renew. TestFlight builds do expire after 90 days, at which point you run the build workflow again.

---

## After the first build

Code changes go out automatically as over-the-air updates. Push, wait a minute, reopen the app.

Rebuild only for:

- A new native module (on-device transcription for live recording is the one on the list)
- A permission string, the icon, the app name, or the version
- An Expo SDK upgrade

---

## If a build fails

**"Missing repository secrets: …"** — exactly what it says; the workflow stopped before doing any work.

**Something about provisioning or signing** — usually the bundle ID isn't registered, or the API key's role isn't App Manager. Steps 4 and 5.

**"No connection baked in" warning** — the build succeeded but ships without an AI connection, so testers will be asked for an API key. Add the secrets from [SET-IT-UP-ONCE.md](SET-IT-UP-ONCE.md) and rebuild.

Anything else, send me the failing step's log.

---

## What the real app gets you over the web version

- **Live recording** with on-device transcription, once that native module is wired up — currently the one real functional gap
- **Face ID lock**, and the encryption key in the iOS keychain rather than browser storage
- **Reports encrypted at rest** with AES-256-GCM, and an erase that makes them permanently unreadable rather than merely deleted
- It behaves like an app, because it is one

None of that makes it safe for real patient information — see [SECURITY-PHI.md](SECURITY-PHI.md). Practice data until the BAA question is settled.
