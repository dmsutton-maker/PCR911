# Scene Command Board (prototype)

A touch-first incident board for the EMS officer running a scene, built for an iPad in landscape. It scales from a two-ambulance crash to an MCI, with Monmouth County, NJ, reference data built in. Research behind it: [docs/SCENE-COMMAND-RESEARCH.md](../../docs/SCENE-COMMAND-RESEARCH.md).

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
| **Log** | Every tap, time-stamped, for the after-action report |

Every action can be undone, and the board keeps running with no signal.

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

- **One tablet, one board.** State is kept in that browser's local storage. Nothing syncs between tablets and nothing is sent anywhere.
- **The map's live layer** is the NJ Office of GIS 2020 aerial imagery, loaded tile by tile. Where tiles can't load, because the page is sandboxed or offline, it falls back to the built-in map and the sample scene's aerial. Locate me needs a browser that grants location; the sandboxed preview does not.
- **Distances are straight-line**, and the drive minutes are a rough estimate from them (1.3× the distance at 40 mph).
- **Hospital capacity, beds and ED status are typed in** from what each hospital reports. There is no EMResource feed.
- **The sample incident and its units, people and squad numbers are made up.** Hospital capabilities, county assets, and published phone numbers are from the sources in the research notes; confirm them locally.
