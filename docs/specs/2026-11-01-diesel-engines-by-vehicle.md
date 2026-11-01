# Diesel engines by vehicle

Status: agreed
Date: 2026-11-01
Area: rail-island-music (`sounds/designs/diesel.ts`, the export), rail-island-factory
(the sound mapping, `pnpm import:sounds`), rail-island-webapp (the sound director,
`pnpm import:sounds`, `pnpm import:factory`)

## Context of the change

rail-island-music has three diesel designs (`docs/sounds/diesel.md`):

- `diesel-engine` - a loop with `rpm`, `load`, `size`, `engine` (a choice of six
  profiles: `railcar`, `shunter`, `mainline`, `two-stroke`, `bus`, `truck`) and `level`;
- `diesel-start` and `diesel-stop` - one-shots with `size`, `engine`, `level`. The
  game is meant to chain them by hand: start the loop at idle at
  `dieselStartTimes().idles`, and on shutdown stop the loop and fire `diesel-stop`
  in the same instant, cross-faded over 0.06 s.

So the split today is by *phase* (start / running / stop) across three ids, and by
*vehicle* only inside one choice parameter. Neither consumer follows that design:

- The factory's committed copy of the sounds (`sounds/`) predates the profiles: it
  knows `diesel-engine` only, with no `engine` parameter and no start or stop. Its
  derived mapping (`generator/soundMapping.ts` `dieselEngine`) gives every rail
  vehicle with `traction: "diesel"` - six diesel locomotives (`generator/dieselLocos.ts`)
  and the diesel railcars (DMU_CATALOG: CD 810, 812, 843, M 131, M 240, M 296,
  DB 628) - the same `diesel-engine`, distinguished only by `size` from weight.
  Road vehicles (buses, trucks) have no engine slot at all.
- The game's committed `db/sounds/` is the same old export. Its director
  (`SoundDirector`, `soundParams.ts` `engineValues`) runs a diesel loop while the
  consist moves or stands at a platform with its doors open, and simply drops it
  (a 0.06 s fade) anywhere else: an engine never starts or shuts down audibly. Buses
  (`BusController`) make no engine sound.

The loop is also started and dropped by the engine's voice limit and by what is in
view (`SoundEngine.updateLoops`, `selectLoops`), so the sound voice's life is not the
engine's life: an engine that comes into view while running must not "start".

Nothing is persisted by any of this: sound ids and parameters live in code and in
the generated/imported exports (`db/sounds`, the factory's `sounds/`, the model meta).

## User request

Make a diesel sound refactor. The diesel engine's start / stop / running split is
probably incorrect. Instead, it should be divided by vehicle (e.g.
`diesel-engine-bus`, `diesel-engine-train`). Start / stop / running should be some
mode or parameter of the diesel engine. Use the divided diesel engines in the
factory. Then in the game, start and stop the diesel engine correctly.

## Decisions

### How should the diesel engines be split into sound ids?
| Option | What it means |
|---|---|
| Per vehicle kind | four ids (train with a small loco profile choice, railcar, bus, truck) |
| Two ids: train and road | `diesel-engine-train` and `diesel-engine-bus`, each with a profile choice |
| One id per profile | six ids, one per current profile, no profile choice left |

**Answer: One id per profile** - `diesel-engine-railcar`, `diesel-engine-shunter`,
`diesel-engine-mainline`, `diesel-engine-two-stroke`, `diesel-engine-bus`,
`diesel-engine-truck`. The `engine` choice parameter disappears; each id is one
fixed engine.

### How should start / running / stop work as a mode of each engine design?
| Option | What it means |
|---|---|
| Loop with state param | one loop per engine with a `state` choice (off / start / run / stop) that the game sets; the voice plays the transitions itself |
| Loop + one-shot by mode | the id is a loop when running and a one-shot for start/stop; the game chains them by timing helpers |
| Separate ids per phase | `diesel-engine-bus`, `diesel-start-bus`, `diesel-stop-bus`, ... |

**Answer: Loop with state param.** Each engine is one loop. The game changes its
state with `set()`. A voice started at `run` (coming into view, freed from the
voice limit) is running at once and does not replay the start. The game does no
cross-fading.

### What happens to the existing ids `diesel-engine`, `diesel-start`, `diesel-stop`?
| Option | What it means |
|---|---|
| Remove all three | delete in music, re-import into factory and game in one coordinated round |
| Keep diesel-engine as legacy | remove start/stop now, `diesel-engine` later |

**Answer: Remove all three.** Sound ids are not stored in saved maps; between the
imports the game only warns and plays nothing for the slot.

### How does the factory choose the engine id for a rail diesel?
| Option | What it means |
|---|---|
| Derive, table overrides | railcar (DMU catalog) -> `diesel-engine-railcar`; diesel loco under 80 t -> `-shunter`, from 80 t -> `-mainline`; `size` from weight; `SOUND_TABLE` may state any model's id |
| State every one by hand | every diesel model gets its id in `SOUND_TABLE`, the build fails without |
| Derive only, no override | railcar vs loco by catalog, shunter vs mainline by weight, no per-model choice |

**Answer: Derive, table overrides.**

### Do buses and trucks get engines in this change?
| Option | What it means |
|---|---|
| Buses in factory + game | factory derives road engine slots (bus -> `diesel-engine-bus`, truck -> `diesel-engine-truck`); the game plays buses |
| Factory mapping only | slots exported, game keeps road vehicles silent |
| Rail only | road vehicles stay without engines |

**Answer: Buses in factory + game.** Trucks carry the mapping but play nowhere
until the game simulates them.

### When should the game start and shut down a diesel (train or bus)?
| Option | What it means |
|---|---|
| Idle, shut down after a wait | idles at signals, platforms and stops; shuts down after ~30 s standing away from a platform |
| Like today, but audible | runs while moving or at a platform; every change plays start/stop; a signal stop shuts it down |
| Follow the simulation | every engine starts and stops with the simulation, idling whenever it stands |

**Answer: "shut down only in station, in the same event as switching off lights
(2s before departure)".** The engine follows the vehicle's existing *asleep* signal
(`asleepAtStation` / `roadVehicleAsleep` in the game's
`core/motion/VehicleSignals.ts`, docs/rendering/vehicle-lights.md): when the
lights go out (`SLEEP_AFTER`, 2 s into a station dwell long enough, or a spacing or
turnback hold) the engine shuts down, and when they come back on (`WAKE_BEFORE`,
2 s before departure) it starts. Everywhere else - at a signal, a junction, in a
queue, at a stop a bus does not sleep at - it keeps running and idles while it
stands. A scenario's cues that override the lamps (`cuedSignals`) drive the
engine the same way.

### Does starting an engine delay the vehicle's departure?
| Option | What it means |
|---|---|
| No, sound only | the simulation is untouched; a start still playing when the vehicle moves off finishes and glides into the requested revs |
| Yes, wait for the start | a vehicle waits ~2.9 s for its start before moving; changes the simulation |

**Answer: No, sound only.** The start is woken 2 s before departure, so the engine
has caught (0.5 s) and is settling to idle as the vehicle moves off.

### What does a diesel sound like when its voice begins while the engine is already in a state?
| Option | What it means |
|---|---|
| Join silently | a voice begun mid-state joins it with no transition: silent when asleep, running when awake; simulation start does not play starts |
| Start on sim start | as above, but every awake diesel in hearing plays its start when the simulation starts |

**Answer: Join silently.** Only a real asleep/awake change plays a start or a stop.

### Where does the engine run when the simulation is not driving the vehicle?
| Option | What it means |
|---|---|
| Off, as today | no simulation, no engine; a vehicle that stops being simulated falls silent with the loop's fade, no stop sound |
| Play the stop | when the simulation stops, every running diesel in hearing plays its shutdown |

**Answer: Off, as today.**

## High-level plan

1. **rail-island-music: six engines with a state.** The three diesel designs are
   replaced by six loops, one per profile: `diesel-engine-railcar`,
   `diesel-engine-shunter`, `diesel-engine-mainline`, `diesel-engine-two-stroke`,
   `diesel-engine-bus`, `diesel-engine-truck`. Each has `rpm`, `load`, `size`,
   `level` (unchanged meaning) and a new `state` choice: `off`, `start`, `run`,
   `stop` (default `run`, so the catalog and an unaware player hear a running
   engine). Changing `state` with `set()` plays the transition inside the same
   voice: `start` is today's start (silent, coughs, catches, flares, settles to
   idle, then follows `rpm`/`load`); `stop` is today's run-down from wherever it
   runs to silence; `off` is silent. A voice begun at `run` is running at once, one
   begun at `off` or `stop` is silent, one begun at `start` plays the start. `run`
   during a start lets the start finish and then glides to the requested revs. The
   synthesis (profiles, cycle waves, knock, breath, turbo, fan) is kept as it is.
   The catalog site gets a state control to audition the transitions; the docs
   (`docs/sounds/diesel.md`, `docs/sounds/sounds.md`) and tests move to the new
   ids. Delivered first; nothing else can move before it is exported.
2. **rail-island-factory: the mapping.** `pnpm import:sounds` brings in the new
   export. The derived engine slot names a profile id: a railcar (the DMU
   catalog) `diesel-engine-railcar`; a diesel locomotive `diesel-engine-shunter`
   under 80 t and `diesel-engine-mainline` from 80 t; a bus `diesel-engine-bus`,
   a truck `diesel-engine-truck` (road vehicles get an engine slot for the first
   time). `size` stays derived from weight. `SOUND_TABLE` may state another id for
   any model (e.g. `diesel-engine-two-stroke`). `state` joins the runtime
   parameters a slot may not pin. The factory site's sound block auditions the
   engines with the state control. Depends on 1.
3. **rail-island-webapp: starting and stopping.** `pnpm import:sounds` and
   `pnpm import:factory` bring in the designs and the new mapping. The game keeps
   an engine state per diesel vehicle, independent of whether its voice exists:
   awake is running, asleep (the lamps' signal, including scenario cues) is
   shut down. The sleep event sets `stop`, the wake event (2 s before departure)
   sets `start`; afterwards `off` / `run`. Moving or standing awake anywhere -
   signal, junction, queue, a stop it does not sleep at - it runs and idles
   (`rpm` 0) while standing. A voice the voice limit or the view brings in joins
   the current state silently; a voice in its run-down is kept until the run-down
   ends. Without a simulation driving the vehicle there is no engine, as today.
   Buses (`BusController`) become engine sources like trains. Docs
   (`docs/gameplay/sounds.md`, `docs/tooling/sound-import.md`) and the sound
   tests follow. Depends on 1 and 2.

The three imports land as one coordinated round; between them the game warns about
an unknown design and plays nothing in that slot, which is acceptable.

## Database and persistent storage

Nothing new is stored. Sound ids and parameters live in code and in the generated
or imported exports (music `export/sounds/`, factory `sounds/` and the models'
`game.sounds` in the meta, game `db/sounds/` and `db/procedural/`); none is in a
saved map, a database, R2 or browser storage.

## Architecture decisions

- **One id per profile instead of an `engine` choice.** The vehicle's engine is a
  character the factory pins, not something the game varies; an id names it
  directly, the mapping and the catalog read plainly, and a profile can diverge
  (its own start, its own parameters) without touching the others.
- **The transitions live inside the loop voice, driven by `state`.** One voice
  per engine means no cross-fade timing in the game, no separate one-shots to keep
  in step with a loop, and a start interrupted by `run` or a stop by `start` is
  the design's to handle smoothly. The alternative (the game chaining loop and
  one-shots on `dieselStartTimes`/`dieselStopTimes`) put the sound's timing in the
  game.
- **Engine life follows the lamps' asleep signal.** It is already computed for
  trains and buses, cued by scenarios and tested; the engine adds no new rule of
  when a vehicle is "parked", and lights and engine always agree.
- **The engine state is the game's, the voice only renders it.** Voices come and
  go with view and the voice limit, so the state (asleep/awake and the moment it
  changed) is held per vehicle, and a voice joins it without a transition.
- **Sound only, no simulation delay.** Waking 2 s before departure gives the start
  time to catch; the simulation, timetables and their tests stay untouched.

## Weaknesses and risks

- **The start is longer than the wake lead.** The start reaches idle at 2.3 s and
  its flare settles over ~1 s, the wake comes 2 s before departure: the engine is
  still settling as the vehicle moves off. Mitigation: `run` during a start
  finishes it and then glides; listen and shorten the flare if it sounds wrong.
- **Removing ids breaks the slot between imports.** If music is exported and the
  game imports it before the factory mapping, every diesel is silent. Mitigation:
  do the three imports in one round; the game's import already warns.
- **The site and the factory site lose the old ids.** Any bookmarks or catalog
  links to `diesel-engine` stop resolving; acceptable for internal catalogs.
- **Voice slots during a run-down.** A stopping voice holds a slot for up to ~7 s
  (the two-stroke's rundown plus turbo); at a busy station several may compete
  with running engines. Mitigation: the voice limit's nearest-first selection;
  watch for dropped stops.
- **The 80 t shunter/mainline threshold is a guess.** CD 749 (72 t), CD 750
  (74 t) and T 499.0 Kyklop (76 t, 3000 kW) land on shunter although they are
  mainline locos; only CD 771, CD 781 and T 679.0 come out mainline. Mitigation: state them
  in `SOUND_TABLE`; the threshold may move after listening.
- **Buses that never sleep** (a line whose stops do not sleep) idle at every stop
  and never shut down until the simulation stops; that is the rule as decided.
- **Open:** whether the stop length is exported (meta) or the loop reports it (a
  finite `endsAt` once the run-down is scheduled) is left to implementation.

## Out of scope

- Trucks playing in the game (the game does not simulate trucks yet).
- New synthesis or retuning of the profiles beyond what the state transitions need.
- Ships, aircraft or any non-diesel engine; electric vehicles stay silent.
- Delaying departures for the start, or any simulation change.
- Sounds at simulation start or stop (no chorus of starts or shutdowns).
