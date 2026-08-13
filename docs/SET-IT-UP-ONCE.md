# Setting it up once, for everybody

The goal of this page: **nobody who uses the app ever sees an API key, a settings screen about one, or anything to configure.** They install it and start working.

You do this once. It applies to every phone, every tester, and the web version, and it survives every future code change.

---

## How it works

You put the connection details into GitHub as repository secrets. Every build — the web version and the real iPhone app — reads them at build time and ships already connected.

```
GitHub secrets  ──►  build  ──►  app that just works
   (you, once)                    (everyone else, never)
```

Nothing secret is ever committed to the repo. If you change a secret, the next build picks it up; the change reaches installed phones through the OTA update workflow without anyone reinstalling anything.

---

## Two ways to supply the connection

### The good one — a squad relay

`PCR_RELAY_URL` and `PCR_SQUAD_CODE`.

The provider key stays on a server you control. Nobody's phone or browser ever contains it. If a phone is lost or someone leaves, you change one code and redeploy — no new app version, nothing to uninstall.

Setup is in [../server/README.md](../server/README.md). It is free, and it is the version to use if more than one person will ever run this.

### The quick one — a key straight in the build

`PCR_GEMINI_API_KEY` (or `PCR_ANTHROPIC_API_KEY`).

Simpler: no relay, no Cloudflare, no second thing to set up. And meaningfully worse, so it is worth being blunt about why:

- **A key inside a web bundle is readable by anyone who opens the page.** Not "difficult to extract" — visible. Never do this for the web build unless you accept the key is public.
- **A key inside an iPhone app can be pulled out of the binary** by anyone willing to spend an afternoon.
- **It cannot be revoked for one person.** Changing it means rebuilding and everyone updating.

For a free Gemini key used with fake patients, the realistic worst case is someone burning your daily quota. That is survivable. It stops being survivable the moment anything real is involved.

Use it to get moving. Move to the relay before you hand the app to a crew.

---

## Adding the secrets

**github.com/dmsutton-maker/PCR911/settings/secrets/actions** → **New repository secret**, once per row you need:

| Name | What it is |
|---|---|
| `PCR_RELAY_URL` | your relay's address, e.g. `https://pcr-relay.you.workers.dev` |
| `PCR_SQUAD_CODE` | one of the codes you set on the relay |
| `PCR_GEMINI_API_KEY` | *instead of* the two above, a key from aistudio.google.com/apikey |
| `PCR_ANTHROPIC_API_KEY` | optional, only if you are paying for Claude |

Then trigger a build:

- **Web version** — happens by itself on the next push. Or Actions → **Deploy web app** → Run workflow.
- **iPhone app** — Actions → **Build iOS app** → Run workflow.

---

## Checking it worked

Open the app, go to **Settings**. On a correctly configured build:

- There is **no "AI provider" section** in the middle of the screen.
- At the very bottom there is an **Advanced** section saying the connection is already set up and there is nothing for you to enter.

If you instead see "AI provider" sitting in the middle asking for a key, the build did not receive the secrets. Check the workflow log — the iOS build prints a warning when it is about to ship unconfigured.

---

## What each person still sets

Only things that are actually theirs:

- **Settings → Provider profile** — their certification level and state
- **Settings → Organization** — squad name and narrative format, if they are not using yours

Neither involves a key, and neither blocks them from generating a narrative.

---

## Changing the connection later

**Rotating the squad code** — change `ACCESS_CODES` on the relay and `PCR_SQUAD_CODE` here, redeploy both. Installed apps pick it up on the next OTA update.

**Switching from a baked key to a relay** — add the two relay secrets, delete the key secret, rebuild. Nobody has to do anything.

**One phone needs something different** — Settings → Advanced → AI connection overrides the build's setting for that phone only. It exists so an exception does not require a new version of the app, not because anyone is expected to use it.

---

## Local builds

If you build locally and the connection does not appear to take effect, Metro has cached the old config. Add `--clear`:

```bash
PCR_RELAY_URL=... PCR_SQUAD_CODE=... npx expo export --platform web --output-dir dist --clear
```

CI runners start clean, so this only bites locally.
