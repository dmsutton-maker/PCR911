# Scene Command Board (prototype)

A touch-first EMS command app for iPads in landscape, with a phone view for members, set up for Hatzalah Jersey Shore (county number 78) in Monmouth County, NJ. It has two boards that any number of tablets share live: a **supervisor board** for everyday calls, and a **scene board** for an MCI. It's free on one tablet; sharing between tablets and phones is the squad plan, free for the first 60 days (see server/README.md). Research behind it: [docs/SCENE-COMMAND-RESEARCH.md](../../docs/SCENE-COMMAND-RESEARCH.md).

## Tablets and jobs

Each tablet picks a job, and each job has its own home screen. Tablets start on the Supervisor board; phones on My calls. All of them share the same incident and the same supervisor board. The supervisor board is one board per day: it turns over by itself at 6 AM, carrying units, crew still on duty and any open call, so there is no shift to start.

| Job | Home screen |
|---|---|
| **Supervisor** | Supervisor board: our units in or out of service with who is riding, active calls stepped from dispatch to back in service with the members responding on their own (first on scene starts the clock), ALS and other requests, crew on duty, today's numbers. Alerts when no crew is en route after 5 minutes or a unit has been at the hospital over 30. Any call can become an MCI. |
| **Command** | The full scene board below |
| **Triage** | Big counters, re-triage, the triage report |
| **Transport** | Units ready to load, hospital grid of sent vs. can-take, transport log |
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
| **Hospitals** | Capabilities, distance, **live ED status, reason and comment** from New Jersey's public ED status board (njdivert.juvare.com, through the relay, every 3 minutes), MCI capacity by color vs. sent, beds available by type. Includes University Hospital, Newark, for the Eye Trauma Center for New Jersey |
| **Phone** | Directory of published numbers, plus your own |
| **ICS** | Unified command, command staff, operations and the medical group; tap a box to assign it |
| **Radio** | METHANE, CAN, triage report, hospital notification, mutual-aid request, air medical request and command transfer, all written from the board. Also a channel reference and links to listen live to the county's public Broadcastify feeds |
| **Log** | Every tap, time-stamped and marked with which tablet made it, for the after-action report |
| **Supervisor** | The supervisor board for everyday calls (see above) |

Every action can be undone. **My agency** (in Menu) holds the squad's own units, which load into every new day and incident; **PAR checks** are an option, off by default.

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

## Limits of this prototype

- **Sharing needs the relay deployed** (see server/README.md) and each tablet signed in with an invite. Nothing is sent to CAD, EMTrack or anyone else.
- **The map's live layer** is the NJ Office of GIS 2020 aerial imagery, loaded tile by tile. Where tiles can't load, because the page is sandboxed or offline, it falls back to the built-in map and the sample scene's aerial. Locate me needs a browser that grants location; the sandboxed preview does not.
- **Distances are straight-line**, and the drive minutes are a rough estimate from them (1.3× the distance at 40 mph).
- **Hospital capacity and beds are typed in** from what each hospital reports. ED status comes live from the public NJ ED status board, which isn't an official feed for apps: it can change shape without notice, so confirm diversion by radio or phone.
- **There's no automatic traffic-camera feed.** New Jersey publishes none; 511NJ shows its cameras on its own site.
- **Calls are typed in by the supervisor.** There is no CAD or paging feed, and no push alert: a member sees a new call when they open the app.
- **The board starts empty.** Units, members (numbers like JS111) and calls are the squad's own. **Practice mode** — the same address with `?demo` on the end — has a made-up sample incident, day and roster, kept apart from the real board and never shared, for training and showing other squads.
- **The sample incident and day, and their units, people and numbers, are made up.** Hospital capabilities, county assets, and published phone numbers are from the sources in the research notes; confirm them locally.
