# OpsBoard (prototype)

One shared board for squads and the agencies they work with: MCIs, everyday calls, and planned events. It was called Scene Command, then RigBoard, while it was EMS only.

Served at https://dmsutton-maker.github.io/PCR911/scene-command/ (the address keeps its first name, so links and Home Screen icons already handed out keep working).

A touch-first EMS command app for iPads in landscape, with a phone view for members, set up for Hatzalah Jersey Shore (county number 78) in Monmouth County, NJ. It has two boards that any number of tablets share live: a **supervisor board** for everyday calls, and a **scene board** for an MCI. It's free on one tablet; sharing between tablets and phones is the squad plan, free for the first 60 days (see server/README.md). Research behind it: [docs/SCENE-COMMAND-RESEARCH.md](../../docs/SCENE-COMMAND-RESEARCH.md).

## Home, workspaces and jobs

A tablet opens on **Home**, which asks what you're working on: **Supervisor** (everyday calls), **MCI** (pick your job: Command, Triage or Transport) or **Event**. Each tile shows what's running there now. Picking MCI or Event with nothing running starts one. Each workspace has its own tabs on the side, only what that job needs: an event has Event, Map (posts, cameras, hospitals), Hospitals, Phone, Radio and Log, with no triage, transport, units or ICS; the supervisor has no MCI tabs either. The Map, Hospitals, Radio and Log tabs follow the workspace, so the event's log is the event's and the supervisor's is today's. The Home button is at the top of the side tabs (at the left of the bottom bar on a phone). A tablet goes back to Home after six hours unused; otherwise it reopens where it was. Phones open on My calls.

**Agency console.** Each squad or department's admins set up their own board from any computer at `agency.html` (https://dmsutton-maker.github.io/PCR911/scene-command/agency.html), signed in with an email and password they set on an admin tablet (Menu → Squad sharing → Web login). It has the agency's name, county number, kind (EMS, fire, police) and logo; board options (PAR checks); its units; the member roster for check-in by number, one at a time or pasted many at once; people and access (everyone signed in, with their role, web login and when last used; make admin, remove a lost phone, restore); invite links for tablets and phones, another admin, and fire or police guests, each of which can be stopped; favorite hospitals; radio feeds; cameras; the squad's own phone numbers; and its activity log. Settings are saved as one copy and reach every open tablet and phone at once, and units added there go on today's Supervisor board.

**Unified command.** Fire and police work the same MCI as EMS from their own tablets: on Home, pick MCI and the job Fire or Police. Each agency has its own color and screen, and the final report has every agency's benchmarks, the police points and who held unified command.

**Fire and police devices look different.** Every device is EMS, Fire or Police. A squad sets what it is under My agency (a fire or police department can run OpsBoard as its own board); one tablet can be set apart under This tablet's job. A fire or police device wears its agency's color and gets its own Home (MCI offers its own screen or Unified command), its own tabs and a shorter menu, with no EMS member view or triage settings, on a tablet or a phone.

**Unified command / OEM.** One screen for whoever runs the whole incident with every agency, such as the county or town OEM coordinator or the unified commanders: on Home, pick MCI and the job Unified command. It shows who holds EMS, Fire and Police command; each agency's benchmarks side by side; resources on scene and requested, by agency; patients by color and transported; hospitals and how many each has been sent and notified; the police points (closures, perimeter, reunification); and the incident log. Requests for any agency go out from there. Any agency's device can open it.

**Big screen.** A view-only board for a TV or monitor in the station, the EOC or the command post: Menu → Squad sharing → Big screen makes a link that only shows the board. The relay refuses every change from it, so it can't alter anything even if someone taps it. By itself it follows what's happening: an MCI's patients, units by agency, hospitals, the map, benchmarks and unified command while one is running; an event's posts during an event; otherwise today's calls, units and crew, numbers and ED status. **Show** at the top picks exactly which panels to show instead (active calls, units and crew, today's numbers, the MCI's triage, units, hospitals, benchmarks or unified command, the event, ED status, the map, latest activity), and makes the text bigger for a screen across the room. Each screen keeps its own choice.

**Setups are kept.** A tablet that set up the squad (name, logo, units, roster) before it was signed in to the squad's relay no longer loses that setup when it joins: the first time it syncs, anything the squad's saved copy is missing is filled in from the tablet, and the merged copy is saved for everyone. Nothing the squad already has is replaced, and nothing deleted comes back. The setup is safest kept in the agency console, which saves it on the relay.

**Guests from another department.** Menu → Squad sharing → Invite another department makes a Fire or Police guest link that works for 12 hours to a week. The department's own phones and tablets open it, join in their agency's colors, and see only the MCI and events. The relay itself refuses a guest the daily board, the squad's settings and roster, member lists and invites, and shuts a guest out when the link's time is up or an admin revokes them.

**Offline.** The website keeps a copy of the app, the map library and the PDF maker on the device (a service worker, `sw.js`), so it opens and keeps working with no internet: everything is saved on the device and goes to the other tablets when the connection is back. The chip at the top says Offline and how many changes are waiting. Needing the internet: live ED status (the last one seen is kept), aerial imagery (the built-in map works), and radio feeds. Save PDF works offline once the device has been online after opening the app.

**Final reports.** At the end of an MCI, an event or the day, the Final report (on the log, in Menu, on Home, on the board once the scene is clear, and opened by itself when an event ends) shows a summary of everything: times, benchmarks, triage counts, transports, hospitals, units, people and their hours, requests, ICS, patients (no names) and the full time-stamped timeline, with signature lines. **Save PDF** makes a Letter-size PDF with the squad's logo (on an iPad it opens the share sheet: Files, Mail, AirDrop, Print); **Print** prints the same report. The PDF maker loads from cdnjs the first time, so the first PDF needs a connection; Print always works.

Each tablet picks a job, and each job has its own home screen. All of them share the same incident and the same supervisor board. The supervisor board is one board per day: it turns over by itself at 6 AM, carrying units, crew still on duty and any open call, so there is no shift to start.

| Job | Home screen |
|---|---|
| **Supervisor** | Supervisor board: our units in or out of service with who is riding, active calls stepped from dispatch to back in service with the members responding on their own (first on scene starts the clock), ALS and other requests, crew on duty, today's numbers. Alerts when no crew is en route after 5 minutes or a unit has been at the hospital over 30. Any call can become an MCI. |
| **EMS Command** | The full scene board below. Its benchmarks also list what fire and police have stamped |
| **Triage** | Big counters, re-triage, the triage report |
| **Transport** | Units ready to load, hospital grid of sent vs. can-take, transport log |
| **Fire** (unified command) | The same incident from fire's side: who holds EMS, Fire and Police command; fire benchmarks (water supply, primary and secondary search, under control, LZ secured, overhaul; extrication is shared with EMS); apparatus grouped by assignment (suppression, extrication, search, ventilation, water supply, RIT, hazmat…) with one-tap PAR for every crew on scene; EMS's patient counts; hazards, staging and the LZ. Tabs: Fire, Map, Units, ICS, Radio, Phone, Log |
| **Police** (unified command) | Traffic control points, road closures, the perimeter, ingress and egress, family reunification and the media area, each placed on the map (every tablet sees them) with the police unit holding it; police benchmarks (scene secured, traffic control, perimeter, routes, reunification, ME notified, roads reopened); police units; EMS's patient counts and how many went to each hospital, for reunification (no names). Tabs: Police, Map, ICS, Phone, Radio, Log |
| **Unified command** (OEM) | Every agency at the MCI on one screen: commanders, benchmarks side by side, resources by agency, patients, hospitals, police points, requests and the log. Tabs: Unified, Map, Units, Hospitals, ICS, Radio, Phone, Log |
| **Big screen** | A view-only display (see above): it follows the MCI, the event or the day, or shows the panels picked under Show. Signed in with a Big screen link, it can't change anything |
| **Member** (phone) | For one member on their own phone: pick yourself once, then every active call with one big button that goes I'm responding → I'm on scene → I'm clear. On scene, request ALS, an ambulance or police. Go on or off duty and pick the unit you're riding. Directions open in Apple Maps, Google Maps or Waze. When an MCI 1st alarm or higher is declared, a red banner sends members to staging instead of the scene. Phones open in this view the first time. |

How sharing works: every change is an event. Each tablet writes only its own events to a shared store and replays every tablet's events over the board's starting state, so two people tapping at once never overwrite each other, counts add up, and undo takes back one change. On the web address the store is the squad's own relay (`server/worker.js`, one Durable Object per squad, reached over a WebSocket and signed in with an invite: Menu → Squad sharing). In the copy hosted in Claude it is that page's store. Without either, the boards run on that tablet alone.

This is a clickable prototype for deciding what the real thing should be. It is not part of the PCR Narrative app yet, and it should only ever hold practice data.

## What is on it

| View | What it does |
|---|---|
| **Board** | Triage counters (START or SALT, plus an optional White · Uninjured count), benchmarks you stamp with a tap, resources on scene and requested, a satellite map in the corner, patients awaiting transport, nearest hospitals with load |
| **Map** | Pin the scene, staging and LZ by tapping. Locate me, the county staging areas, cameras the squad adds (other agencies' or businesses', shared with every tablet; a still-image link refreshes in place) plus a link to 511NJ's traffic cameras, nearest hospitals with specialty filters, coordinates in decimal and degree-minute form for air medical, and links out to Apple and Google Maps |
| **Transport** | Log a departure in five taps: category, unit, destination (nearest and best-fit first, with live divert status and each hospital's red/yellow/green room shown in color), optional tag number and age group |
| **Units** | Lanes from Available to Released, with one-tap Arrived and To-scene buttons. Paste a list to load expected units, member check-in by number, and resource requests for EMS, county MCI assets, the NJ EMS Task Force, fire and special operations |
| **Hospitals** | Favorites the squad stars (listed first everywhere, with a Favorites filter), capabilities, distance, **live ED status, reason and comment** from New Jersey's public ED status board (njdivert.juvare.com, through the relay, every 3 minutes), MCI capacity by color vs. sent, beds available by type. Includes University Hospital, Newark, for the Eye Trauma Center for New Jersey |
| **Phone** | Directory of published numbers, plus your own |
| **ICS** | Unified command, command staff, operations and the medical group; tap a box to assign it |
| **Radio** | METHANE, CAN, triage report, hospital notification, mutual-aid request, air medical request and command transfer, all written from the board. Also a channel reference. **Listen live** at the top: the county's public Broadcastify feeds (they open on Broadcastify, whose terms don't allow playing them inside another app), and feeds the squad adds that it has the right to use, which play right in OpsBoard in a bar that stays up across screens |
| **Log** | Every tap, time-stamped and marked with which tablet made it, for the final report. One log per workspace: the incident's, the event's, today's |
| **Supervisor** | The supervisor board for everyday calls (see above) |
| **Event** | For a planned event rather than an emergency (a parade, the fireworks, a concert, a race). Posts on the map (numbered posts, first aid, command post, roaming, ambulance standby, cooling, gates), placed by tapping the map; members and units assigned to each; who's at their post, on break or done; a patient log (seen, released, transported, refused) with no patient names; a copyable briefing. Members' phones show their post with directions and "I'm at my post", and can check in to the event themselves. **Upgrade to MCI** starts an incident with the event's members and units already on scene. |

Every action can be undone. **My agency** (in Menu) holds the squad's own logo (shown next to its name on every tablet and phone) and units, which load into every new day and incident; **PAR checks** are an option, off by default.

## Building

The page has to be a single self-contained file, because it is published as a sandboxed web page that can only load scripts from a few CDNs. So the source and its data are kept separate and spliced together:

```bash
node prototypes/scene-command/build.mjs
```

| File | What it is |
|---|---|
| `src/board.html` | The page: markup, styles, and all the logic |
| `data/monmouth-geo.json` | Town boundaries for Monmouth, Ocean and Middlesex, plus state and US routes, simplified from US Census 2023 cartographic boundary and TIGER road files (public domain) |
| `data/sample-scene.json` | Aerial photo of the sample scene (Route 35 & Deal Road, Ocean Township) from the NJ Office of GIS 2020 orthophotography, with its bounds |
| `vendor/leaflet-1.9.4.css` | Leaflet's stylesheet (BSD-2-Clause); Leaflet's script loads from cdnjs |
| `index.html` | The built page; don't edit it by hand |
| `logo.svg` | The OpsBoard mark (option A, the status board). `icon-180.png`, `icon-512.png` and `icon-1024.png` are drawn from it |

## Limits of this prototype

- **Sharing needs the relay deployed** (see server/README.md) and each tablet signed in with an invite. Nothing is sent to CAD, EMTrack or anyone else.
- **The map's live layer** is the NJ Office of GIS 2020 aerial imagery, loaded tile by tile. Where tiles can't load, because the page is sandboxed or offline, it falls back to the built-in map and the sample scene's aerial. Locate me needs a browser that grants location; the sandboxed preview does not.
- **Distances are straight-line**, and the drive minutes are a rough estimate from them (1.3× the distance at 40 mph).
- **Hospital capacity and beds are typed in** from what each hospital reports. ED status comes live from the public NJ ED status board, which isn't an official feed for apps: it can change shape without notice, so confirm diversion by radio or phone.
- **There's no automatic traffic-camera feed.** New Jersey publishes none; 511NJ shows its cameras on its own site.
- **Calls are typed in by the supervisor.** There is no CAD or paging feed, and no push alert: a member sees a new call when they open the app.
- **The board starts empty.** Units, members (numbers like JS111) and calls are the squad's own. **Practice mode** — the same address with `?demo` on the end — has a made-up sample incident, day and roster, kept apart from the real board and never shared, for training and showing other squads.
- **The sample incident and day, and their units, people and numbers, are made up.** Hospital capabilities, county assets, and published phone numbers are from the sources in the research notes; confirm them locally.
