# Scene Command Board: research notes

Background for the tablet scene-command prototype in [`prototypes/scene-command`](../prototypes/scene-command/README.md). Researched October 2026. Anything marked *verify* came from a dated or secondhand source and should be confirmed with the Monmouth County EMS Coordinator or County Communications before it is relied on.

## What already exists, and the gap

| Tool | Good at | Missing for an EMS commander |
|---|---|---|
| Tablet Command, First Due Command | Fire command boards: drag units to assignments, PAR and work timers, time-stamped log, CAD sync | No triage counts, patient transport log, or hospital capacity |
| Pulsara, Juvare EMTrack | Per-patient tracking from a scanned tag, hospital hand-off | Not a command board: no units, benchmarks, or ICS |
| ZoneEMS, OHTrac | Victim counts by color, load per hospital | Narrow; little command support |
| Paper (ICS 201, county MCI worksheets, grease-pencil boards) | Everything above on one sheet | Not shared, no clocks, no math |

No product puts triage counters, a hospital capacity grid, a transport log, and EMS benchmarks on one offline screen. The published county MCI worksheets (Westchester NY, NWC EMSS Illinois, Washington County OR) agree closely on what that screen needs, and the prototype follows them.

## What the commander tracks

- **Header:** incident, location, command name, MCI declaration, clock from dispatch, PAR countdown.
- **Triage counts** by category, with transported vs. on scene for each.
- **Benchmarks** stamped with a time: command established, MCI declared, staging, hospitals notified, treatment area, triage complete, extrication complete, all Immediate transported, all transported, clear.
- **Units** by status (available, en route, staged, on scene, transporting, released) and assignment; **people** checked in by member number.
- **Hospital grid:** what each ED says it can take (Red / Yellow / Green) against what has been sent; beds by type; ED status.
- **Transport log:** tag number, category, age group, unit, destination, time out.
- **ICS positions:** Medical Group, Triage, Treatment (Red / Yellow / Green), Transport (Medical Communications, Ambulance Staging), Morgue, Staging, Safety, PIO, Liaison, unified command with Fire and Police.
- **Radio reports:** METHANE initial report, CAN progress report, triage report, hospital notification, mutual-aid request, air medical request, command transfer.

## New Jersey and Monmouth County specifics

**MCI framework**
- New Jersey has **no numbered statewide MCI levels**. The statewide EMS protocol (v1, 8/21/2025, section 9.1) distinguishes a *multiple casualty situation* (patients within provider capability) from a *mass casualty incident* (patients exceed it).
- Triage is "a system such as START or SALT". Categories: Immediate (Red), Delayed (Yellow), Minimal (Green), Expectant (Black/Gray), Deceased (Black). The NJ Disaster Triage Tag adds White "Uninjured".
- **Tag rule** (NJ OEMS tag program): tag every patient once there are 4+ Red, 6+ mixed, or 8+ Green. *Verify the tag is still issued in this form.*
- Monmouth escalates by **alarm**, using the Garden State Parkway run cards in the county EMS communications plan (2023): 1st alarm 10 ambulances, 2 rescues, 2 ALS; 2nd the same again; 3rd 5 ambulances, 1–2 ALS.
- The **County EMS Coordinator** is notified when 3+ towns or 5+ squads are involved. **Field Comm** (mobile communications) responds automatically to an MCI with 6+ squads.

**Who does what**
- **Dispatch:** Monmouth County Sheriff's Office Communications, 2500 Kozloski Rd, Freehold. Backup center in Neptune. Mutual aid, staging-area activation and medevac requests all go through County Communications.
- **ALS:** MONOC closed in April 2020. Paramedics are now Hackensack Meridian Health and RWJBarnabas Health.
- **BLS:** volunteer and municipal squads, plus the Sheriff's paid **MedStar** service (launched 2024; Central HQ at Fort Monmouth, Tinton Falls, opened June 2026, with a Mass Casualty Response Unit).
- A mutual-aid request needs: IC unit, location, type, approximate patients, ambulances needed, MICUs needed, extrication, special services, staging area.
- Unit numbers follow a town–unit pattern; 56–63 are ambulances, 50 the captain or chief.

**County MCI assets** (2023 plan; *verify current*): Mass Casualty Trailer 67-MCT-1 (Marlboro FA); Mass Casualty Response units MCR-1 (Atlantic Highlands FA) and MCR-2 (Howell PD EMS); Medical Ambulance Buses MAB-2 and MAB-6; Staging Area Management Teams SAMT-1 and SAMT-2; hospital surge trailers; 18 in-county ambulance strike teams.

**County staging areas:** Monmouth Executive Airport (Route 34, Wall) and the Parkway Monmouth Rest Area between exits 98 and 100.

**NJ EMS Task Force:** requested by the County EMS Coordinator, not by the scene. Assets include the Mass Care Response Unit (supplies for 100 patients), Medical Ambulance Bus (up to 20 stretcher patients), Mobile Satellite ED, ambulance strike teams, and ASAP/Gator off-road units.

**Hospitals**
- **JSUMC (Neptune) is the county's only trauma center**: state Level II, verified by the American College of Surgeons as Level I adult and Level I pediatric. The nearest state Level I is RWJUH in New Brunswick.
- **Cooperman Barnabas (Livingston, formerly Saint Barnabas) is New Jersey's only state-certified burn center.** The Crozer burn center in Pennsylvania closed in 2025.
- CentraState (Freehold) joined Atlantic Health in 2021. Raritan Bay's Old Bridge campus is now Old Bridge Medical Center. Monmouth Medical Center is approved to move to Tinton Falls around 2032.
- Monmouth/Ocean **diversion terms**: ED divert (ends after 2 hours), critical care, special services, full, and facility divert (end after 4). Trauma patients are never diverted from a trauma center, nor burn patients from a burn center.
- Hospital status and MCI bed polls run on **Juvare EMResource**, operated by the NJ Hospital Association's healthcare coalition team. Monmouth is in the Central Healthcare Coalition.
- No source confirms Juvare EMTrack is used for patient tracking in New Jersey.

**Air medical:** in Monmouth all medevac requests go through County Communications. NJ State Police NorthSTAR flies from Somerset Airport; Hackensack Meridian AirMed 2 is based at Ocean County Airport. The Hammonton SouthSTAR base closed in 2016. LZ: about 100 × 100 ft, firm and level, with wires and wind called out. Medevac radio traffic uses Fireground 3 or 4.

## Field-tablet design rules the prototype follows

- **Touch targets:** 56 px minimum, larger for the triage counters. NIST (IR 8340) wants critical controls largest, and research on use under vibration suggests about 20 mm for safety-critical targets.
- **Color is never the only signal.** Every triage color also carries its word. About 8% of men have red-green color deficiency.
- **Day and night modes:** a high-contrast light mode for sunlight and a dark mode for night.
- **Undo on every action.** Every action is also written to a time-stamped log for the after-action report.
- **Minimal typing:** taps for categories, units and destinations; a number pad for tags and member numbers; paste for unit rosters.
- **Offline first:** the map and every count work with no signal. The paper fallback stays in the MCI kit.

## Main sources

- NJ statewide EMS clinical protocols, v1, 8/21/2025: https://www.nj.gov/health/ems/documents/NEWJERSEYEMSCLINICALPRACTICEPROTOCOLS_GUIDELINES_FINAL8.21.2025v1.pdf
- Monmouth County EMS communications plan (2023 content): https://mcsonj.org/wp-content/uploads/2026/06/EMS-Communications-2018_FINAL.pdf
- NJ Disaster Triage Tag program: https://www.nj.gov/health/ems/documents/ems-task-force/disaster_tag_presentation.pdf
- NJ EMS Task Force, requesting assets: https://www.njemstf.org/request-us.html
- NJ trauma centers: https://www.nj.gov/health/ems/documents/NJ%20Trauma%20Centers.pdf
- NJ stroke centers: https://www.nj.gov/health/healthcarequality/documents/designated-stroke-centers.pdf
- NJ air medical program: https://nj.gov/health/ems/special-services/air-medical-services/
- MCSO MedStar Central HQ (June 2026): https://www.mcsonj.org/wp-content/uploads/2026/06/News-Release-MONMOUTH-COUNTY-OPENS-NEW-MEDSTAR-CENTRAL-REGIONAL-HEADQUARTERS-TO-STRENGTHEN-RESPONSE-WHEN-IT-MATTERS-MOST-June-17.pdf
- Westchester County EMS tactical worksheet: https://emergencyservices.westchestercountyny.gov/images/archive/edocman/ems-division/Tacticaldataworksheet201511x17.pdf
- NWC EMSS Region 9 MCI checklists (2025): https://nwcemss.org/assets/1/region_9/MCI_Incident_Command_Checklist-2025.pdf
- NIST IR 8340, public safety UI guidance: https://nvlpubs.nist.gov/nistpubs/ir/2021/NIST.IR.8340.pdf
- FEMA ICS forms booklet (ICS 201): https://training.fema.gov/emiweb/is/icsresource/assets/nims%20ics%20forms%20booklet.v3.pdf

## Open questions for the agency

1. START or SALT? The board does both; which is your default?
2. Is the NJ Disaster Triage Tag still what your MCI kit carries?
3. Which ALS provider covers your town today, HMH or RWJBH?
4. Who is the current County EMS Coordinator, and what is the direct line?
5. Do you see EMResource during an MCI, or does County Communications relay hospital capacity to you?
6. Which squads are your usual mutual aid? Their unit numbers become the preloaded roster.
