# Getting this onto your phone as a real app

The goal: the app sits on your home screen and opens when you tap it. No dev server, no QR code, no computer running in the background. Ever.

That is what this document sets up. It is browser-only — you never open a terminal.

---

## The one unavoidable cost

**Apple Developer Program, $99/year.**

Apple does not allow a custom app onto an iPhone without a signed provisioning profile, and getting one requires a paid developer account. There is no free path that survives more than 7 days, and the 7-day path needs a Mac with Xcode.

That is the entire reason the QR-code / Expo Go dance exists — it is the workaround for not having a developer account. It is a development tool, not a way to use an app.

Everything else here is free.

---

## How it works once set up

```
I push a code change to GitHub
        ↓
GitHub Actions bundles it automatically
        ↓
Published to Expo's update service
        ↓
You open the app — it has the change
```

You do nothing. No rebuild, no reinstall, no notification to act on. The app checks for an update when it launches and applies it.

A full rebuild is only needed when something *native* changes — adding a module like on-device speech recognition, or changing permissions. That is rare, and it is a button click on a website, not a terminal command.

---

## Setup

### 1. Apple Developer account (~15 min, mostly waiting)

1. **developer.apple.com/programs** → Enroll
2. Enrol as an **Individual** — no business paperwork
3. $99/year, pay with the Apple ID you use on your iPhone
4. Approval usually takes a few hours, occasionally 48

Do this first, since the wait is the long pole.

### 2. Expo account (~2 min, free)

1. **expo.dev** → Sign up
2. **Account settings → Access tokens → Create token**
3. Copy it

### 3. Give GitHub the token (~1 min)

1. **github.com/dmsutton-maker/PCR911 → Settings → Secrets and variables → Actions**
2. **New repository secret**
3. Name: `EXPO_TOKEN`, value: the token from step 2

This is what lets code changes reach your phone automatically.

### 4. Create the Expo project (~2 min)

1. On **expo.dev**, create a new project named `pcr-narrative-assistant`
2. Copy the **Project ID** it shows you (a long `xxxxxxxx-xxxx-...` string)
3. **Send me that ID** — it goes in `app.json` and I will push it

### 5. Connect the repo to EAS Build (~3 min)

1. On expo.dev, open the project → **GitHub** → **Connect**
2. Authorise Expo for `dmsutton-maker/PCR911`
3. Set the base directory to `/` and the branch to the repo's default

### 6. Add your Apple credentials (~5 min)

1. Project → **Credentials** → **iOS**
2. Sign in with the Apple ID from step 1

Let Expo manage the certificates and provisioning profile. It generates and stores them; you do not handle `.p12` files or keychains.

### 7. Build (~15 min, unattended)

1. Project → **Builds** → **Create build**
2. Platform **iOS**, profile **preview**
3. Start it and close the tab — it runs on Expo's servers

When it finishes you get a page with a QR code and an install link.

### 8. Install (~1 min)

**Open the install link on the iPhone** (not on a computer). Safari asks to install the app. Accept.

Then: **Settings → General → VPN & Device Management → Developer App** → trust the profile. iOS requires this once for any non-App-Store app.

The app is now on your home screen. It behaves like any other app.

---

## After that

Open it and do the first-run setup: **Settings → Claude API** (paste your key), **Organization** (squad name and format), **Provider profile** (cert level and state).

The provisioning profile is valid for a year. Before it expires, one more build from the dashboard renews it.

---

## What still needs a rebuild

Only these:

- Adding or removing a native module (for example, wiring up on-device transcription)
- Changing permissions, the app name, the icon, or the bundle identifier
- Upgrading the Expo SDK

All of it is a button on expo.dev, not a terminal. Everything else — screens, prompts, formats, required specifics, bug fixes — ships over the air.

---

## If you decide against the $99

The alternatives, honestly:

- **Expo Go with a dev server** — free, but needs a computer running while you use the app. Fine for a one-off demo, not for real shifts.
- **Wait until it is worth it** — use Expo Go for a few weeks of practice calls to decide whether the app earns a place in your workflow, then pay for the account once you know.

The second is a reasonable order of operations. Nothing about the code changes either way; this is purely about how it gets onto the phone.
