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

## Shared boards for OpsBoard

The same relay lets OpsBoard, the scene command and supervisor board (`prototypes/scene-command`, served at **https://dmsutton-maker.github.io/PCR911/scene-command/**) share one live incident and one supervisor board between tablets. It uses the squad accounts above, so there is nothing new to set up beyond a deploy that succeeds.

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

**The owner console.** `https://<your site>/PCR911/scene-command/owner.html`, signed in with the owner's **email and password**. Set that up once from the admin tablet of the owner's own squad (Menu → Squad sharing → Set up the owner login; allowed only before any owner login exists, and only for an admin of the relay's first squad or of a squad on a plan with no end date), or at any time with the `BOOTSTRAP_CODE`, which is also how a forgotten password is reset. Passwords are kept as salted PBKDF2-SHA256 hashes (`OWNER_HASH_ITERATIONS`, default 30,000, to stay inside the free plan's CPU time); sign-ins last 30 days, Sign out ends one on the relay, and ten wrong tries an hour per address or network are refused. **A first password instead**: set the secret `OWNER_SETUP` to `{"email":"…","temp":"<12 or more characters>","until":"<ISO date>"}`; until that date, and only while no owner login exists for that address, signing in with it creates the login and asks for a new password straight away (a sign-in that must change its password lasts a day and can do nothing else). The console can also add an agency and hand back an admin invite link for it, so the setup code is no longer needed day to day. **Open the agency's console** opens that agency's own console (`agency.html`) signed in as "OpsBoard owner" for 12 hours, for setting a squad up for them; it is written in that agency's audit log. It lists every agency on the relay with its kind (EMS, fire, police), plan and days left, members, admins and active guests, the devices that use its board and when last, whether an MCI, an event or today's board is running (type, place and counts only), and its setup in counts (units, roster, cameras, feeds, logo). Filters for active today, running now, on trial, paying, ending soon and lapsed; a CSV download; and one agency in full: plan controls, people, guests and when they run out, devices, and its recent audit log. Behind it: `POST /v1/owner/squads` (now with each squad's stats) and `POST /v1/owner/squad` with `{ orgId }`. Nothing a patient, call or member typed leaves a squad's board this way.

**The agency console.** A squad member can add an email and password to their own membership from a device signed in as them (`POST /v1/account/setup`; doing it again resets it). `POST /v1/account/login` gives a 30-day web sign-in that works like the device's own (same member, same role), and `/v1/account/logout` ends it. An admin then reads and saves the squad's settings (`/v1/agency/config`, `/v1/agency/save`, which writes the board's `squad/config` and pushes it to every connected tablet, with a time later than any tablet's), sees an overview (`/v1/agency/overview`), changes roles (`/v1/members/role`), lists and stops invite links (`/v1/invites/list`, `/v1/invites/revoke`), and uses the existing member, invite, guest and audit routes. A new member invite now replaces only the earlier member invite, and an admin invite only the earlier admin invite. The daily request cap now counts AI narratives only.

**Two-step sign-in.** After the password, a login with two-step on needs a code from an authenticator app (RFC 6238 TOTP: HMAC-SHA1, 30-second steps, 6 digits, one step either side allowed, never the same step twice) or one of ten recovery codes (stored as SHA-256 hashes, each used once). A login without the code answers `401` with `error.code: 'need_code'` once the password is right. Owner: `POST /v1/owner/2fa/start` (a secret and its `otpauth://` address, waiting 15 minutes), `/confirm` with `{ code }` (returns the recovery codes once and a new session; every earlier owner session ends), `/recovery` with `{ code }` (ten new codes), `/off` with `{ password, code }`. Agency web logins: the same under `/v1/account/2fa/…`, from a device or web sign-in of that member. Admins: `POST /v1/members/2fa-reset` with `{ memberId }` for a lost phone, and `POST /v1/agency/security` with `{ require2fa }`; while it's required, a web login without two-step gets a one-day sign-in that can only set it up (`/v1/me` says `enroll: true`), web sign-ins without it are ended when the rule is turned on, and an admin can't turn it on before their own. A reset with the setup code turns the owner's two-step off: it is the way back in after losing the phone, so keep `BOOTSTRAP_CODE` as safe as the owner password, or remove it once the owner login is set up. Changing a password or turning two-step on ends every other web or owner sign-in made before it (the member's `webAfter`, the owner record's `changedAt`). Sign-in limits now count only wrong passwords and wrong codes: ten an hour per address, fifty per network, so a station signing in at shift change is never locked out. `OWNER_SETUP`'s one-time password also stops working at its `until` date if it was never changed.

**A new admin link for an agency.** `POST /v1/owner/invite` with `{ orgId }` (owner session or setup code) makes a fresh admin invite and stops the agency's earlier ones. Joining now says the agency's kind (`org.kind`), so its first iPad takes the agency's name and kind instead of the tablet's defaults.

**Big screens.** An admin's `POST /v1/invites` with `{ role: 'display' }` makes a Big screen invite. A device that joins with it is a `display` member: its board connection reads every document and is refused any write, it can't set up a web login or use narratives, and a new display invite leaves member and admin invites alone.

**Guests.** An admin's `POST /v1/guest-invites` with `{ agency: 'fire' | 'police', hours: 12 | 24 | 72 | 168, dept }` makes a guest invite. Joining with it gives a `guest` member, tied to that agency, until the invite's time. A guest's board connection may only read and write `now/incident`, `now/event`, `mci/…` and `evts/…`; a guest gets no squad settings in `/v1/me`, cannot use admin routes or narratives, and is refused once its time is up or it is revoked. Rotating the squad's own invite leaves guest invites working.

**Running it for other squads.** On the board: Menu → Squad sharing → **Relay owner: squads and plans**. Enter the `BOOTSTRAP_CODE` (it isn't saved on the tablet) to see every squad and its plan, and to mark one paid through a date, give it no end date, restart its trial, or turn sharing off. The same two endpoints, for scripts: `POST /v1/owner/squads` and `POST /v1/owner/plan` with `{ orgId, tier, paidThrough }`, both with the header `x-bootstrap-code`. The setup code is yours alone as the relay owner: create a squad for a customer and send them an admin invite, rather than giving them the code.

**ED status.** `GET /v1/divert` passes on New Jersey's public Emergency Department Status board (njdivert.juvare.com): each hospital's status, reason, comment and color. Browsers can't read that site from another page, so the relay fetches it and keeps it for 90 seconds. No sign-in needed; it's public data.

**If the deploy fails creating storage** with `Authentication error [code: 10000]`, the API token cannot manage Workers KV on this account: recreate it from the **Edit Cloudflare Workers** template (step 3 above), check that `CLOUDFLARE_ACCOUNT_ID` is the same account, and save the new token over `CLOUDFLARE_API_TOKEN`.
