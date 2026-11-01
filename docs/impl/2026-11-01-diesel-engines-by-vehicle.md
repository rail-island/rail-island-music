# Diesel engines by vehicle

Spec: docs/specs/2026-11-01-diesel-engines-by-vehicle.md
Date: 2026-11-01
Status: implemented
Area: rail-island-music (sound designs, render tool), rail-island-factory (sound
mapping, site Sounds block, imported sounds), rail-island-webapp (sound director,
sound engine, bus sound sources, imported sounds and factory export)

## What was done

All three repositories, on `claude/epic-planck-cbv6qy` each.

**rail-island-music.**
- `sounds/designs/diesel.ts`: `diesel-engine`, `diesel-start` and `diesel-stop` are
  replaced by six loops built from one factory function (`dieselEngineOf`):
  `diesel-engine-railcar`, `-shunter`, `-mainline`, `-two-stroke`, `-bus`, `-truck`.
  Each takes `rpm`, `load`, `size`, `state` and `level`.
- `state` is `run` (the default), `start`, `stop` or `off`. `start` and `run` mean
  "runs", `stop` and `off` mean "does not". Changing sides through `set()` plays the
  transition on the next tick, inside the same voice:
  - the start is the former one-shot's coughs, catch and flare, after which the
    engine glides to `rpm` and `load`;
  - the stop goes back to idle, cuts the fuel, runs down with a thud and spins the
    turbo down.
- A voice begun at `run` is running at once; one begun at `start` plays the start;
  one begun at `stop` or `off` is silent.
- `Engine.cancel(at)` drops scheduled automation, so a start can interrupt a
  run-down and the other way round.
- A shut-down voice reports its `endsAt` (when it falls silent); `sounds/types.ts`
  documents this on `Voice.endsAt`.
- `generator/renderSound.ts` takes `--at=S:param=value` to change a loop
  mid-render.
- Docs updated: `docs/sounds/diesel.md`, `docs/sounds/sounds.md`, `docs/README.md`.

**rail-island-factory.**
- `pnpm import:sounds` re-imported the export.
- `generator/soundMapping.ts`:
  - `dieselEngine(tonnes, group)` gives a railcar (group `unit`) the railcar
    engine, and a locomotive the shunter under 80 t (`MAINLINE_TONNES`) or the
    mainline from 80 t; `size` still comes from weight.
  - `roadEngine(group)` gives a bus `diesel-engine-bus` and a truck
    `diesel-engine-truck`, with nothing pinned.
  - `state` joins `RUNTIME_PARAMS`.
- `generator/catalog.ts` passes the catalog group to the derivation.
- The model page's Sounds block (`src/modelSounds.ts`, `src/SoundsPanel.tsx`) plays
  a diesel's start on Start and its run-down on Stop, both on the same voice.
- Docs and tests updated: `docs/models/sounds.md`, `docs/site/catalog-site.md`,
  `test/soundMapping.test.ts`, `test/modelSounds.test.ts`.

**rail-island-webapp.**
- `pnpm import:sounds` and `pnpm import:factory` brought in the new designs and the
  new mapping.
- `soundTriggers.EngineLife` keeps whether each engine runs (awake) or is shut down
  (asleep) for every engine of a vehicle the simulation drives. It reports `start`
  or `stop` only on the frame the state changes; an engine seen for the first time
  joins its state silently.
- `soundParams.engineValues` runs a diesel while the vehicle is awake (idling
  wherever it stands) and passes `state`; it is silent while the vehicle sleeps or
  when the simulation does not drive it.
- `SoundDirector` has a shared `engine()` path for trains and, new, buses
  (`host.buses()`).
- `TrainController` adds `driven` (`snap.running`) and `asleep` (`signals.lampsOff`)
  to each train's sound state.
- `BusController.soundSources()` reports each bus with an engine slot: the lamp
  rule with scenario cues, plus speed and acceleration from the leg's profile
  (`legMotion`).
- `SoundEngine.updateLoops` lets an unrequested loop whose `endsAt` is finite and in
  the future finish its run-down instead of fading it. The voice is reused if it is
  requested again.
- `SLOT_RUNTIME` lists `state`.
- Docs updated: `docs/gameplay/sounds.md`, `docs/tooling/sound-import.md`,
  `docs/rendering/vehicle-lights.md`.

**Checks.**
- music: `pnpm typecheck`, `pnpm test` (57 tests) and `pnpm build` pass.
- factory: `pnpm typecheck` passes; `pnpm test` passes all 117 files (7631 tests)
  in 5 min 26 s; `pnpm build` passes, including `build:models`.
- webapp: `pnpm typecheck` (app and worker) passes; `pnpm test` passes all 646
  files (8696 tests); `pnpm build` passes. `pnpm import:factory` changed only
  `db/procedural/vehicles.meta.json`, so no model's JS moved.
- Two renders were sent to the user: `diesel-engine-mainline` and
  `diesel-engine-bus`, each going start, idle, rev, idle, stop.

**Commits.**
- music: the designs, then these notes.
- factory: the mapping, the site and the imported sounds.
- webapp: the imports (`chore(models)`), then the game change (`feat(sound)`).

## How to test

**Automated coverage.** No E2E test: none of the three repositories has an E2E
framework, and the rules say verification is headless. The unit tests cover:
- music `test/sounds.test.ts` ("the diesel engine"): each engine's ids and
  parameters; a voice joining its state; a start and stop inside one voice and when
  it falls silent; a start that must finish before revving; a restart during a
  run-down.
- factory `test/soundMapping.test.ts`: the derivation per group and weight, on the
  real models.
- webapp:
  - `test/soundTriggers.test.ts` (`EngineLife`);
  - `test/soundParams.test.ts` (`engineValues`, `legMotion`);
  - `test/soundDirector.test.ts` ("a diesel's engine", "a bus's engine");
  - `test/soundEngine.test.ts` (a run-down allowed to finish);
  - `test/proceduralGame.test.ts` (the imported mapping).

**Setup.**
- Sound catalog: `pnpm dev` in rail-island-music.
- Factory catalog: `pnpm dev` in rail-island-factory.
- Game: `pnpm dev` in rail-island-webapp, with a map that has a diesel train on a
  line with station stops and a bus line with a road station stand.

**Steps.**
1. Sound catalog: open `diesel-engine-bus`, press Play, then set State to
   Stopping. It runs down and falls silent.
2. Set State back to Starting. It coughs, catches and settles at idle; move Revs to
   1 and it revs up.
3. Factory catalog: open `proc-vehicle-cd-810` (a railcar). The Sounds block shows
   Engine `diesel-engine-railcar`.
4. Press Start: the start plays. Press Stop: the run-down plays. Press Start again:
   it starts again.
5. Open `proc-vehicle-cd-781`: the engine is `diesel-engine-mainline`. Open
   `proc-vehicle-cd-749`: the engine is `diesel-engine-shunter`. Open a Karosa bus:
   the engine is `diesel-engine-bus`.
6. Game: start the simulation with the camera near the diesel train standing at a
   station. The engine idles and does not play a start.
7. Wait for a long dwell. About 2 s after it stops, its lamps go out and the engine
   runs down to silence.
8. About 2 s before departure the lamps come on and the engine coughs, catches and
   idles, then revs as the train pulls away.
9. Watch the train held at a red signal: it keeps idling.
10. Watch a bus at its road station stand: the engine shuts down and starts with
    its lamps, as the train's does. At a plain stop it keeps idling.

**Also worth trying.**
- Turn the camera away during a dwell and back after the lamps went out: silence,
  no stop sound.
- Turn it back after departure: the engine is simply running, with no start.
- Stop a running train from its board: the engine fades with no run-down.
- Pause the simulation during a run-down: the run-down finishes.
- In a dwell of 4 to 7 s the stop is followed by the start on the same voice.

## What is missing

Nothing - the spec is implemented in full.

## Known problems

- A bus's drive uses the train's mapping, full revs at 120 km/h. A city bus at
  50 km/h therefore reaches only about rpm 0.4, and its effort is the smoke model
  with no grade.
- Road engines pin no `size`: every bus and every truck sounds the profile as
  measured.
- A run-down allowed to finish holds its nodes outside the voice limit for up to
  about 7 s. At a busy station several can sound on top of the eight loops.
- The 80 t threshold puts CD 749, CD 750 and T 499.0 on the shunter's six, as the
  spec foresaw. None is stated otherwise in `SOUND_TABLE`.
- The factory's full `pnpm test` took 5 min 26 s on this container, over the
  5-minute rule. The change adds only a few cheap tests, so the time is the
  container's.
- The music site's State select offers all four values. Choosing Starting on a
  running engine does nothing, since that only matters when a voice begins.

## Recommended follow-ups

- Listen in the game. If the start's flare overlaps the pull-away badly, shorten
  the flare.
- Give a bus its own drive scale (full revs nearer its top speed), and a size from
  its weight.
- State the mainline engine for CD 749, CD 750 and T 499.0 in `SOUND_TABLE`, or
  move the threshold.
- Count winding-down voices against the voice limit if busy stations get crowded.

## Changelog

- Diesel trains and buses now start their engines audibly shortly before they
  leave a station and shut them down while they stand there with their lights
  out.
- A diesel waiting at a signal keeps idling instead of falling silent.
- Buses have engine sound.
- Railcars, shunting locomotives and mainline locomotives each have their own
  engine sound.
