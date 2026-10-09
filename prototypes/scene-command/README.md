# Scene Command Board (prototype)

A touch-first EMS command app for iPads in landscape, set up for Squad 78 in Monmouth County, NJ. It has two boards that any number of tablets share live: a **shift board** for the supervisor on everyday calls, and a **scene board** for an MCI. Research behind it: [docs/SCENE-COMMAND-RESEARCH.md](../../docs/SCENE-COMMAND-RESEARCH.md).

## Tablets and jobs

Each tablet picks a job, and each job has its own home screen. All of them share the same incident and the same shift.

| Job | Home screen |
|---|---|
| **Supervisor** | Shift board: our units in or out of service with who is riding, active calls stepped from dispatch to back in service, crew on duty, today's numbers. Alerts when no crew is en route after 5 minutes or a unit has been at the hospital over 30. Any call can become an MCI. |
| **Command** | The full scene board below |
| **Triage** | Big counters, re-triage, the triage report |
| **Transport** | Units ready to load, hospital grid of sent vs. can-take, transport log |

How sharing works: every change is an event. Each tablet writes only its own events to the page's shared store and replays every tablet's events over the board's starting state, so two people tapping at once never overwrite each other, counts add up, and undo takes back one change. Without the store (signed out, or opened from a file) the boards run on that tablet alone.

This is a clickable prototype for deciding what the real thing should be. It is not part of the PCR Narrative app yet, and it should only ever hold practice data.

## What is on it

| View | What it does |
|---|---|
| **Board** | Triage counters (START or SALT, plus an optional White · Uninjured count), benchmarks you stamp with a tap, resources on scene and requested, a satellite map in the corner, patients awaiting transport, nearest hospitals with load |
| **Map** | Pin the scene, staging and LZ by tapping. Locate me, the county staging areas, nearest hospitals with specialty filters, coordinates in decimal and degree-minute form for air medical, and links out to Apple and Google Maps |
| **Transport** | Log a departure in five taps: category, unit, destination (nearest and best-fit first, with diversion and capacity shown), optional tag number and age group |
| **Units** | Lanes from Available to Released, with one-tap Arrived and To-scene buttons. Paste a list to load expected units, member check-in by number, and resource requests for EMS, county MCI assets, the NJ EMS Task Force, fire and special operations |
| **Hospitals** | Capabilities, distance, ED status (Monmouth/Ocean divert terms), MCI capacity by color vs. sent, beds available by type |
| **Phone** | Directory of published numbers, plus your own |
| **ICS** | Unified command, command staff, operations and the medical group; tap a box to assign it |
| **Radio** | METHANE, CAN, triage report, hospital notification, mutual-aid request, air medical request and command transfer, all written from the board. Also a channel reference |
| **Log** | Every tap, time-stamped and marked with which tablet made it, for the after-action report |
| **Shift** | The supervisor's board for everyday calls (see above) |

Every action can be undone. **My agency** (in Menu) holds the squad's own units, which load into every new shift and incident; **PAR checks** are an option, off by default.

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

- **Sharing runs through the published page's store**, so every tablet needs to open the page's link while signed in to an account that can edit it. Nothing is sent to CAD, EMTrack or anyone else. A real product would need its own sync service and accounts.
- **The map's live layer** is the NJ Office of GIS 2020 aerial imagery, loaded tile by tile. Where tiles can't load, because the page is sandboxed or offline, it falls back to the built-in map and the sample scene's aerial. Locate me needs a browser that grants location; the sandboxed preview does not.
- **Distances are straight-line**, and the drive minutes are a rough estimate from them (1.3× the distance at 40 mph).
- **Hospital capacity, beds and ED status are typed in** from what each hospital reports. There is no EMResource feed.
- **Calls are typed in by the supervisor.** There is no CAD or paging feed.
- **The sample incident and shift, and their units, people and squad numbers, are made up.** Hospital capabilities, county assets, and published phone numbers are from the sources in the research notes; confirm them locally.
