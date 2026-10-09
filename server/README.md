# The squad relay

A small server that holds one AI provider key so nobody on the crew has to have their own.

Without it, every person who uses the app has to create a Google account, generate an API key, and paste it in. With it, you send them a link and they start working.

**Cost: nothing.** Cloudflare's free plan allows 100,000 requests a day and does not ask for a card. A busy shift is maybe thirty.

---

## What you are setting up

```
phone  ──►  your relay  ──►  Google Gemini
            (holds the key)
```

The phone sends notes and a squad code. The relay checks the code, adds the API key, and forwards the request. The phone never has a key and never learns one.

---

## Setup — about ten minutes, once

### 1. Make a Cloudflare account

**dash.cloudflare.com/sign-up** — email and password. No card, no domain, nothing to buy.

### 2. Get your Account ID

Cloudflare moves its sidebar around, so use the search box rather than hunting for a menu item:

1. Log in at **dash.cloudflare.com**
2. Press **Cmd+K** (Ctrl+K on Windows)
3. Type **Copy account ID** and select the result

It is now on your clipboard.

If that fails, read it out of the address bar. Once you are logged in the URL looks like `https://dash.cloudflare.com/8f3d134f74acdef456789abcdef8b558/...` — the long hex string after the slash is the Account ID.

You never need to find the Workers section by hand. The GitHub Actions workflow creates the Worker for you.

### 3. Make an API token

1. Go to **dash.cloudflare.com/profile/api-tokens**
2. **Create Token**
3. Find **Edit Cloudflare Workers** in the template list → **Use template**
4. Leave everything as it is → **Continue to summary** → **Create Token**
5. Copy the token. Cloudflare shows it once and never again.

### 4. Make up a squad code

This is the password your crew will use. Something long and random — a password manager's generator is ideal. Twenty-odd characters, no spaces.

You can have several, separated by commas, so you can hand different codes to different people and revoke one without disturbing the rest:

```
kR7-medic-42-qX9wLm,   nT4-probie-88-zVc2Ha
```

**Do not put it in a file in this repo.** It goes in GitHub's encrypted secrets, in the next step.

### 5. Get a free Gemini key

**aistudio.google.com/apikey** → sign in → **Create API key**. No card. Google issues these starting with either `AIza` or `AQ.` — either is fine.

### 6. Put all four into GitHub

Go to **github.com/dmsutton-maker/PCR911/settings/secrets/actions**, and use **New repository secret** five times:

| Name | Value |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | from step 2 |
| `CLOUDFLARE_API_TOKEN` | from step 3 |
| `ACCESS_CODES` | from step 4 |
| `GEMINI_API_KEY` | from step 5 |
| `ANTHROPIC_API_KEY` | only if you are paying for Claude — skip otherwise |

### 7. Deploy it

**Actions** tab → **Deploy relay** → **Run workflow**.

Give it a minute. When it goes green, open the **Deploy** step and look for a line like:

```
https://pcr-relay.your-name.workers.dev
```

That is your relay address. Copy it.

### 8. Point the app at it

In the app: **Settings → AI provider → Squad account**. Paste the address, paste your squad code, tap **Connect**. It checks the address before saving, so a typo tells you immediately instead of at 3am.

### 9. Invite people

Same screen, **Copy invite link**. Send it to whoever needs the app.

They open it on their iPhone in Safari, tap **Share → Add to Home Screen**, and they are done. No key, no account, nothing to set up.

The link contains the squad code, so send it the way you would send a password — not on a public channel, and not to anyone you would not give the code to.

---

## Running it

**Changing the code** — update the `ACCESS_CODES` secret and run the workflow again. Old links stop working immediately; hand out new ones.

**Removing one person** — that is what multiple codes are for. Take theirs out of the list, leave the rest, redeploy. Everyone else is unaffected.

**Watching usage** — Cloudflare dashboard, **Cmd+K** → type `pcr-relay`. Requests, errors, and CPU time, per day. (The Workers section has lived under "Workers & Pages" and under "Compute" at different times; searching beats navigating.)

**Capping usage** — optional. Create a KV namespace called anything you like, bind it as `RATE_LIMIT` in `wrangler.toml`, and each code is capped at `DAILY_LIMIT` requests a day. Skip it unless you want the guard rail.

---

## What this does and does not fix

**Fixed.** The key is on a server you control. You can rotate it, revoke a code, see how much is being used, and take someone's access away without touching their phone. None of that is possible with a key sitting in someone's browser storage.

**Not fixed.** This is still not a build you may put real patient information into. Two things are still missing, and neither is code:

1. A **signed BAA** with the provider, on a HIPAA-eligible paid configuration. Gemini's free tier is expressly the opposite — Google's terms say submitted content is used to improve their products and may be seen by human reviewers.
2. **Per-person identity and an audit trail.** A shared squad code says a request came from someone who has the code. It does not say who, and it cannot produce the access log a real deployment needs.

Also worth knowing: the relay forwards requests, and Cloudflare can see them in transit. That is one more processor of whatever you send, which is a further reason the answer to "can we use real patients yet" is still no.

Full picture in [../docs/SECURITY-PHI.md](../docs/SECURITY-PHI.md).

---

## If something breaks

| What you see | What it means |
|---|---|
| "That squad code was not accepted" | The code in the app does not match `ACCESS_CODES`. Redeploy after changing the secret — the change is not live until you do. |
| "This relay has no gemini key configured" | `GEMINI_API_KEY` is missing or was added after the last deploy. Add it and re-run the workflow. |
| "Could not reach that address" | Wrong address, or the deploy has not finished. Check the Actions tab. |
| "That address answered, but it is not a PCR relay" | The URL points at something else — probably a leftover Worker with a similar name. |
| Workflow skipped with "No Cloudflare credentials set" | `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` is missing from repository secrets. |

---

## Shared boards for the scene command board

The same relay lets the scene command board (`prototypes/scene-command`, served at **https://dmsutton-maker.github.io/PCR911/scene-command/**) share one live incident and one supervisor board between tablets. It uses the squad accounts above, so there is nothing new to set up beyond a deploy that succeeds.

**How it works.** Each squad gets one Durable Object, a small document store with live subscriptions. Tablets connect to `/v1/board` over a WebSocket, signed in with the member token their invite gave them. Each tablet writes only its own list of changes and replays everyone's, so two people tapping at once never overwrite each other. A tablet that loses signal keeps working and sends what it did when it reconnects. Durable Objects on SQLite storage are on Cloudflare's free plan, and the deploy creates this one.

**Signing tablets in.** On the board: Menu → **Squad sharing**. The first tablet uses **Set up the squad** with the `BOOTSTRAP_CODE`; it becomes the admin and can make invite links. Every other tablet opens an invite link, or types the invite code, and gives itself a name. The board's web build already has this relay's address (`https://pcr-relay.dmsutton.workers.dev`), so nobody types it; set the repository secret `PCR_RELAY_URL` only to point the board at a different relay.

**What it stores.** What the boards show: triage counts, unit numbers, member names and numbers, hospital reports, and for the supervisor board each call's type and address. No patient names. Call types with addresses are still sensitive, so treat the board like the rest of this project: practice data until there is a BAA and a HIPAA review covering the relay (see [docs/SECURITY-PHI.md](../docs/SECURITY-PHI.md)).

**Plans: free on one tablet, a trial for sharing.** Any tablet runs the whole board on its own for free. Sharing between a squad's tablets and phones is the squad plan, and the relay enforces it when a tablet connects to `/v1/board` (it never affects narratives):

| Plan | What it means |
|---|---|
| trial | Free for 60 days from the first time the squad shares a board. Set `BOARD_TRIAL_DAYS` as a Worker variable to change the length. |
| squad | Paid through a date, then 14 days' grace so a late invoice never stops a squad's tablets mid-call. |
| comp | No end date: your own squad, a pilot, a county agency. Pick "No end date · my own squad" when setting up your squad. |
| off | Sharing turned off. |

When a plan ends, the board refuses the connection with code 4402 and each tablet carries on by itself with everything it had; a tablet already connected keeps sharing until it next reconnects. Plans are stored under `plan:<orgId>` in the same KV namespace.

**Running it for other squads.** On the board: Menu → Squad sharing → **Relay owner: squads and plans**. Enter the `BOOTSTRAP_CODE` (it isn't saved on the tablet) to see every squad and its plan, and to mark one paid through a date, give it no end date, restart its trial, or turn sharing off. The same two endpoints, for scripts: `POST /v1/owner/squads` and `POST /v1/owner/plan` with `{ orgId, tier, paidThrough }`, both with the header `x-bootstrap-code`. The setup code is yours alone as the relay owner: create a squad for a customer and send them an admin invite, rather than giving them the code.

**ED status.** `GET /v1/divert` passes on New Jersey's public Emergency Department Status board (njdivert.juvare.com): each hospital's status, reason, comment and color. Browsers can't read that site from another page, so the relay fetches it and keeps it for 90 seconds. No sign-in needed; it's public data.

**If the deploy fails creating storage** with `Authentication error [code: 10000]`, the API token cannot manage Workers KV on this account: recreate it from the **Edit Cloudflare Workers** template (step 3 above), check that `CLOUDFLARE_ACCOUNT_ID` is the same account, and save the new token over `CLOUDFLARE_API_TOKEN`.
