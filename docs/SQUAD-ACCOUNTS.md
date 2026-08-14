# Squad accounts

Each person gets their own account. You can see who is on your squad, how much they are using it, and remove any one of them without touching anyone else.

Nobody enters an API key. Nobody creates a password. They open a link, type their name, and they are working.

---

## What this fixes

Before accounts, everyone shared one squad code. That code could say *"somebody who has the code"* and nothing more:

| | Shared code | Accounts |
|---|---|---|
| Remove one person | Change it for everyone | Remove them alone |
| Who wrote this narrative? | Unanswerable | In the activity log |
| Someone leaves | Everyone re-onboards | One tap |
| Setup for a new person | Send them the code | Send them a link |

The shared code still works, so a phone already set up does not stop mid-shift. It is just no longer the thing to hand out.

---

## What the server knows

**Names, roles, and counts.** That is the whole list.

**Not reports.** Notes, narratives, and patient details never reach the server — they stay on the phone that made them. Requests pass through in memory to the AI provider and nothing about their content is written down.

**Not narratives in the log either.** The activity log records *that* a narrative was generated and by whom. Never what it said. An audit log holding patient information is a liability, not a control.

---

## Setup

Assumes the relay from [server/README.md](../server/README.md) is already deployed.

### 1. Add storage (2 min)

Accounts need somewhere to live.

1. Cloudflare dashboard → press **Cmd+K** → type **KV**
2. **Create a namespace**, name it `pcr-org-data`
3. Copy the **Namespace ID**
4. In this repo, edit `server/wrangler.toml` — uncomment the last three lines and paste the ID:

```toml
[[kv_namespaces]]
binding = "ORG_DATA"
id = "the-id-you-just-copied"
```

Send me the ID if you would rather I do that edit.

### 2. Add a setup code (1 min)

This is used exactly once, to create your squad.

**github.com/dmsutton-maker/PCR911/settings/secrets/actions** → **New repository secret**

| Name | Value |
|---|---|
| `BOOTSTRAP_CODE` | any long random string |

### 3. Redeploy (2 min)

**Actions** → **Deploy relay** → **Run workflow**.

### 4. Create your squad

One request, which you can make from any browser's address bar replacement — or send me the details and I'll run it. Using the browser console on any page:

```js
await fetch('https://YOUR-RELAY.workers.dev/v1/orgs', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-bootstrap-code': 'YOUR-BOOTSTRAP-CODE' },
  body: JSON.stringify({ orgName: 'Station 12', adminName: 'Your Name' })
}).then(r => r.json())
```

It returns a `token` and an `inviteCode`. Keep the token — it is your admin access.

### 5. Sign your own phone in

Open this on your phone, substituting your relay address and the token from step 4:

```
https://dmsutton-maker.github.io/PCR911/#join=1&u=https%3A%2F%2FYOUR-RELAY.workers.dev&t=YOUR-TOKEN
```

The app signs you in as admin. The token is stripped from the address bar immediately.

---

## Running the squad

Everything is at **Settings → Your squad**.

**Inviting people.** Tap **Create an invite link** — it copies a link to your clipboard. Send it however you like. They open it, type their name, and they are working.

Creating a new invite link **disables the previous one**. People who already joined are unaffected. Rotate it whenever a link has been forwarded somewhere you did not intend.

**The roster.** Everyone's name, certification, how many narratives they have generated, and when they last used it.

**Removing someone.** Tap **Remove**. Their app stops working immediately and tells them their access was withdrawn. Everyone else is untouched, and nothing is asked of them.

Reports already on that person's phone stay there — this app has no way to reach them. Removing access is not the same as retrieving data.

**Activity.** Who generated what, and when. 90 days, then it expires.

---

## Roles

**Admin** — invites, roster, removals, squad settings, activity log.
**Member** — writes narratives. Never sees any of the above.

The person who creates the squad is an admin. Any invite can grant either role, though the app's own invite button always creates member invites; admin invites are an API call.

---

## What this is not

Being straight about the limits, because "we have accounts now" invites the wrong conclusion:

- **A name is what someone typed**, not a verified identity. There is no email confirmation and no password. For a crew whose admin sent each link personally, that is a reasonable trade; it is not identity proofing.
- **The log lives on your relay**, in ordinary storage you control. It is not tamper-evident, and an admin could delete it.
- **An invite link is a credential until it is rotated.** Anyone holding it can join under any name.
- **None of this makes the app PHI-capable.** It is a real prerequisite — you cannot have an audit trail without identities — but the BAA and a HIPAA-eligible provider configuration are still missing. See [SECURITY-PHI.md](SECURITY-PHI.md).

Good enough to run a squad on practice data. Not yet good enough for a compliance audit, and the app says so on the admin screen.
