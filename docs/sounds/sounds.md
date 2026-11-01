# Sounds

**Covers** - the game's sound effects: every horn, whistle, engine, bell, water, woods and knock
Rail Island plays is a design here, synthesized at run time with Web Audio. This
document covers the contract a design implements, the designs and their
parameters and categories, the export the game imports, and auditioning them on the site's catalog.
**Code** - `sounds/types.ts`, `sounds/nodes.ts`, `sounds/index.ts`,
`sounds/designs/trains.ts`, `sounds/designs/diesel.ts`, `sounds/designs/ships.ts`, `sounds/designs/water.ts`, `sounds/designs/nature.ts`,
`sounds/designs/bells.ts`, `sounds/designs/editor.ts`,
`generator/sounds.ts`, `generator/metrics.ts`, `generator/renderSound.ts`, `src/EffectPage.tsx`, `test/sounds.test.ts`, `test/metrics.test.ts`
**See also** - [diesel.md](diesel.md) (the diesel engines), [../site/catalog-site.md](../site/catalog-site.md),
[../guide/setup-and-build.md](../guide/setup-and-build.md); in the game,
`rail-island-webapp` `docs/gameplay/sounds.md` (when each sound plays) and
`docs/tooling/sound-import.md` (`pnpm import:sounds`)

This repository is the source of the sounds and the game is a consumer, the way
rail-island-factory is the source of the models. A sound is changed here and
re-imported in the game, never edited there. The split:

| Here (a design) | In the game |
|---|---|
| how it sounds: the oscillators, noise, filters, envelopes | when it plays: departures, crossings, tunnels, berths, edits |
| its parameters, their ranges and defaults | the values: a horn's pitch from the locomotive's weight, the beat's rate from its speed |
| the patterns of blasts per call | where it is heard from: the listener at the camera, the voice limit, cooldowns |

## The contract (`sounds/types.ts`)

A design is a `OneShotDesign` or a `LoopDesign`:
- **Identity** - an `id` (kebab-case, **permanent once the game plays it**), a
  `title`, a `category` ([Categories](#categories)), a one-line `description`.
- **Parameters** - `params`: `number` parameters (`min`, `max`, `step`,
  `default`, optional `unit`) and `choice` parameters (`values`, `default`).
  Every design has a `level` (0..1).
- **A one-shot** - `play(ctx, dest, t, values)`, which returns a `Voice`:
  `endsAt`, the time it falls silent by itself, and `stop(at)`, which fades it out.
- **A loop** - `start(ctx, dest, t, values)`, which returns a `LoopVoice`. On
  each `tick(now, horizon)` it schedules only `horizon` seconds ahead, so a loop
  nobody ticks (a hidden tab, a closed map) falls silent by itself. `set(values)`
  changes its parameters from the next scheduled event on.

Everything is scheduled at an explicit time, never "now". A design therefore
plays the same into a live `AudioContext` and into the `OfflineAudioContext` the
game's video recorder renders a sound track with.
- **Values** - values are resolved before a design sees them (`resolve`):
  missing names take the default, numbers are clamped to their range, and an
  unknown choice is defaulted. A design never has to check.
- **Determinism** - the shared white noise is generated from a fixed seed
  (`sounds/nodes.ts`), so a render hisses the same every time.

`types.ts` is **types only, with no imports**: the generator writes it out as
the bundle's declarations, so it must stay valid as a `.d.ts` on its own.

## The designs

| Id | Kind | Parameters | What it is |
|---|---|---|---|
| `loco-horn` | one-shot | `pitch` 150-500 Hz, `call`, `level` | the two-tone air horn of a diesel, an electric or a multiple unit: a three-reed sawtooth chord (root, major third, fifth) through a soft low-pass |
| `steam-whistle` | one-shot | `pitch` 400-1100 Hz, `call`, `level` | a steam locomotive's whistle: three sine pipes sliding up onto the note, over band-passed noise |
| `steam-chuff` | loop | `rate` 0-12 beats/s, `intensity` 0..1, `level` | the exhaust beat: looped noise through a band-pass, gated by one struck envelope per beat; every fourth beat heavier; loudness `0.3 + 0.7 * intensity` |
| `diesel-engine` | loop | `rpm` 0..1 (0.4), `load` 0..1 (0.5), `size` 0..1 (0.5), `engine` (`mainline`), `level` | a running diesel of one of six profiles (railcar, shunter, mainline V12, two-stroke V16, bus, truck), matched to recordings: a cycle wave of its cylinders' uneven pulses, the knock and the exhaust's breath gated in step, a turbo and, for the truck, a fan ([diesel.md](diesel.md)) |
| `diesel-start` | one-shot | `size`, `engine`, `level` | the engine started: silent until it coughs (no starter), then it catches, flares and settles to idle, fading out as the game starts `diesel-engine` ([diesel.md](diesel.md)) |
| `diesel-stop` | one-shot | `size`, `engine`, `level` | the engine shut down from idle: it runs down through its compressions, rocks to a stop, the turbo spins down ([diesel.md](diesel.md)) |
| `crossing-bell` | loop | `pitch` 600-2400 Hz (1590), `interval` 0.15-1.2 s (0.49), `uneven` 0-0.3 (0.085), `ring` 0.2-2 (1), `level` | a level crossing's electric bell, matched to a recording of a Czech crossing bell (below) |
| `ship-horn` | one-shot | `pitch` 50-250 Hz, `seconds` 0.3-3, `level` | two sawtooths and a square near the root through a low-pass, with a 4.5 Hz waver |
| `river-rapids` | loop | `strength` 0..1, `level` | a river over rocks: noise through a low and a bright band-pass that wander every 0.12 s, softened, with bubbles on top (short sines rising as they burst); the stronger, the louder and the more bubbles |
| `waterfall` | loop | `size` 0..1, `level` | a steady roar: low-passed noise, a deep rumble and a little spray hiss, wandering every 0.25 s; the bigger, the lower and heavier |
| `sea-surf` | loop | `strength` 0..1, `level` | the sea on a shore: a steady wash, a low rush and a hiss whose filter and level drift slowly (every 0.7 s, seeded), swelling and settling with no single waves; fuller the stronger |
| `spring-fountain` | loop | `size` 0..1, `level` | a spring, which the game draws as a fountain: the jets' hiss and the basin's splash, with a bright patter of droplets (band-passed noise clicks, 20-60 a second) |
| `woods` | loop | `density` 0..1 (0.6), `birds` 0..1 (0.6), `level` | a forest around the listener: leaves rustling in slow gusts (band-passed noise every 1.2 s) over a low breath of wind, and now and then a bird of a flock of five calling (chirps, a two-note whistle or a trill), seconds apart (`birdGap`), more often the denser and livelier; no birds at `birds` 0 |
| `church-bell` | one-shot | `pitch` 200-900 Hz (440), `strikes` 1-12 (3), `interval` 0.8-6 s (2.2), `ring` 0.3-1.5, `level` | a village church bell tolling: nine partials of a tuned bell (`CHURCH_PARTIALS`) and the clapper's clang per strike |
| `big-ben` | one-shot | `pitch` 100-260 Hz (165, E), `strikes` (the hour, 3), `chime` `quarters` / `hour`, `ring`, `level` | the Great Bell of the Westminster clock tower: twinned, beating partials (`GREAT_BELL_PARTIALS`), struck every 4.5 s; with `quarters`, first the Westminster Quarters' last four changes on the four quarter bells (G#4 F#4 E4 B3, kept in tune with `pitch`) |
| `notre-dame-bell` | one-shot | `pitch` 60-160 Hz (92.5, F#), `strikes` 1-12 (4), `interval` 1.5-8 s (3.4), `ring`, `level` | Emmanuel, the bourdon of Notre-Dame de Paris: a deep bell whose hum rings about 22 s (`BOURDON_PARTIALS`) |
| `edit-build` | one-shot | `level` | a falling sine thud with a short burst of grit |
| `edit-demolish` | one-shot | `level` | a lower, longer thud and a long crumble of low-passed grit |

**The crossing bell** was matched to a recording of a Czech level crossing's
warning bell (`zvonek vystrazniku`), measured for its partials, ring and timing:

| Partial | Ratio to `pitch` | Level | Rings (s to -60 dB) |
|---|---|---|---|
| low | 0.566 (900 Hz) | 0.13 (-18 dB) | 3.2 |
| main | 1 (1590 Hz) | 1 | 2.8 |
| main's twin | 1.0038 (+6 Hz, the beat) | 0.45 | 2.8 |
| fifth-ish | 1.512 (2404 Hz) | 0.6 (-4 dB) | 2.2 |
| upper | 2.083, 3.078 | 0.06, 0.03 | 1.2, 0.9 |

- **Ring.** A strike barely decays before the next one: about 12 dB in half a
  second. The bell therefore rings continuously, and the twin beats it about six
  times a second.
- **Strokes.** The hammer's strokes alternate short and long, `interval` x
  (1 - `uneven`) then x (1 + `uneven`), which gives 0.45 s and 0.53 s at the
  defaults (`bellGap`).
- **Click.** A strike adds a short high-passed click of the hammer.
- **Oscillators.** Each partial is one oscillator for the whole loop. A strike
  only re-excites its envelope (`setTargetAtTime` from wherever it rings), so a
  bell costs seven sources however long it rings. `ring` scales every ring time.

**The water** is three loops built the same way (`sounds/designs/water.ts`).
Continuous filtered noise has filters and gains that wander, and the scattered
events on top (a rapid's bubbles, a fountain's droplets) are drawn from a seeded
random sequence (`seeded`, mulberry32). A render therefore sounds the same every
time, and like every loop they schedule only as far ahead as they are ticked.

**The levels.** The loops the game plays continuously are trimmed against one
another, measured as EBU R128 integrated loudness of a render at the defaults
(`generator/renderSound.ts`, through its compressor):

| Design | LUFS |
|---|---|
| `steam-chuff` | -30.6 (-27.5 at full effort) |
| `diesel-engine` | -29.5 at every `engine` (about -40 idling, -21 at full revs and effort) |
| `river-rapids`, `waterfall`, `spring-fountain` | about -31 |
| `sea-surf` | -33.7 |
| `woods` | -38 |
| a horn's blast, for comparison | about -15 |

The water is ambient and plays as long as it is in view, so it sits under the
running engines. Each water loop multiplies its `level` by its `WATER_TRIM`
(`sounds/designs/water.ts`); they used to play at -14 to -22 LUFS, louder than
any locomotive. The woods are quieter still.

**The bells** are one-shots that play a whole ringing and end by themselves once
the last strike's longest partial, the hum, has died (`bellTail`). A strike is
one sine per partial, started together and each decaying at its own rate, plus
a short band of noise for the clapper. The Westminster Quarters (William Crotch,
1793, public domain) are written in `WESTMINSTER_CHANGES` from the well-known
five changes; they were not checked against a recording. The three bells'
partial tables are typical values for tuned bells, not measurements of the real
ones. The game plays none of the bells yet.

**The calls** (`call`, `hornPattern`) are why a train sounds. Each is a pattern
of blasts:

| Call | Horn | Whistle |
|---|---|---|
| `departure` | 0.3 s high (x1.26), then 0.45 s root | 0.35 s, then 0.9 s |
| `crossing` | 1.0 s | 1.1 s |
| `tunnel` | 1.3 s | 1.4 s |
| `player` | 0.6 s | 0.8 s |

To add a design, write it in `sounds/designs/` with `/* @__PURE__ */ oneShot` or `loop`
(`sounds/nodes.ts`; [Metrics](#metrics)), give it a `category`, and list it in `SOUNDS`
(`sounds/index.ts`) among its category's designs. It appears on the site's
catalog at once. The game plays it once its code names the id.

## The export

`pnpm build:sounds` (`generator/sounds.ts`; `pnpm build:music` is the same
script, kept for the game's import) writes `export/sounds/`:

| File | What |
|---|---|
| `sounds.js` | every design as ONE ES module (esbuild): `SOUNDS`, `SOUNDS_FORMAT`, `CATEGORIES`, `soundById`, `categoryById`, `soundsIn`, `soundMeta`, `resolveValues` |
| `sounds.meta.json` | `{ note, format, module, categories, sounds }`: every category, and every design's `id`, `title`, `category`, `description`, `kind`, `params` and `metrics` ([Metrics](#metrics)), without code |
| `sounds.d.ts` | `sounds/types.ts` followed by the module's exports |

`SOUNDS_FORMAT` (1) is bumped when the contract changes incompatibly. The game's
import refuses a format it does not know. The game runs
`pnpm import:sounds`, which builds this repository and mirrors `export/sounds/`
into its committed `db/sounds/`. That import checks for a `rail-island-music`
package with a `build:music` script, so both names stay.

## Metrics

`generator/metrics.ts` measures what each design costs, the way the factory's
table shows a model's JS size and triangles. The build writes the result into
each design's `metrics` in `sounds.meta.json`, and the site's table shows it
([../site/catalog-site.md](../site/catalog-site.md)):

| Field | What |
|---|---|
| `jsBytes` | minified bytes of the design bundled alone (esbuild), the shared `nodes.ts` code it uses included |
| `nodesAtStart` | Web Audio nodes (gains, filters, oscillators, noise sources) created when it starts, at its defaults |
| `nodesPerSecond` | a loop's nodes created per second while it is ticked for 10 s, 50 ms apart and 0.2 s ahead, as the game ticks it; `null` for a one-shot |
| `seconds` | a one-shot's length at its defaults (`endsAt`); `null` for a loop |
| `params` | how many parameters it has |

The nodes are counted against a stub context, so every number is
deterministic: they rank the designs by what they ask of the browser, but they
are not a CPU profile. Each design is declared `/* @__PURE__ */ oneShot(...)` or
`loop(...)`, which lets esbuild drop the designs beside it in the same module
when it sizes one; keep that annotation on a new design. The field is additive:
`SOUNDS_FORMAT` stays 1 and the game ignores it.

## Rendering a sound to a file

```bash
pnpm exec tsx generator/renderSound.ts crossing-bell /tmp/bell.mp3 interval=0.5 --seconds=6
```

`generator/renderSound.ts` renders one design through the very code the game
imports. A one-shot plays once at 0; a loop starts at 0 and is ticked for the
whole length. It writes WAV or MP3 (ffmpeg), at 44.1 kHz, through headless
Chromium's `OfflineAudioContext` (Playwright's, pre-installed in the cloud
sessions). Parameters are `name=value`: a number is parsed as one, anything else
is a choice. Use it to compare a design with a reference recording, or to send
someone a sound.

## Categories

Every design has a `category`, and `CATEGORIES` (`sounds/index.ts`) lists them
in order, each with a `title` and a one-line `description`:

| Category | What it holds | Designs |
|---|---|---|
| `trains` | locomotives and the railway, and the diesel engines of buses and trucks | horn, whistle, exhaust beat, diesel engine and its start and stop, crossing bell |
| `ships` | vessels in port and at sea | ship horn |
| `water` | ambient water, played while in view | rapids, waterfall, spring fountain, sea surf |
| `nature` | ambient life of the land | woods |
| `bells` | tower bells tolling | church bell, Big Ben, Notre-Dame bourdon |
| `editor` | feedback of the map editor | build, demolish |

`SOUNDS` keeps each category's designs together, in the order of `CATEGORIES`
(tested), so the list reads the same grouped or not. `categoryById` and
`soundsIn(category)` look them up. The site's list groups the sounds under their
category and filters by it ([../site/catalog-site.md](../site/catalog-site.md)).

The categories are in `sounds.meta.json` (`categories`, and each design's
`category`) and in the contract (`SoundCategory`, `SoundCategoryInfo`). They are
additive fields the game ignores, so they need no format bump. A new category is
a new `SoundCategory` member and a row of `CATEGORIES`.

## Auditioning on the site

The sounds are the site's list, grouped by category. Each opens on a page of
its own (`src/EffectPage.tsx`,
[../site/catalog-site.md](../site/catalog-site.md)):
- the design's category, kind, id and description;
- a slider for every number parameter and a picker for every choice;
- Play for a one-shot, Start/Stop for a loop (ticked every 50 ms, 0.2 s ahead,
  the way the game ticks it each frame);
- Defaults;
- a live spectrogram (0-8 kHz) of what it plays.

A running loop takes a parameter change at once, so a beat's rate can be swept
while it plays. The page plays the design **from source**, the same code the
generator bundles, through one `AudioContext` of its own created on the first
press. Leaving the page stops everything it still plays, one-shots included.

## Tests

`test/sounds.test.ts`, over a stub Web Audio context:
- every design is well formed and includes each id the game plays;
- it plays at its defaults and at both ends of every range;
- the beat schedules only as far ahead as asked, at its rate; the bell strikes
  on its uneven strokes from oscillators that run for the whole loop, and stops
  when stopped;
- the water loops bubble the same way every time, more the stronger they are,
  and never past what they were ticked for;
- the bell keeps the measured shape of the recording (main tone, the x1.51
  partial, the beating twin);
- the water's output stays trimmed under the engines, and the woods under the water;
- the diesel profiles are every `engine` choice, idle and run at their
  measured speeds, draw a cycle whose strongest line is the firing order with
  the lines of their unevenness, start silent until they cough, with no starter, and stop after running
  down, and change engine while running;
- the diesel fires faster as it revs and lower the bigger it is, and schedules
  only as far ahead as asked;
- the woods sing the same birds every time, more the denser and livelier, none
  at `birds` 0;
- the bells ring the Quarters' four last changes before the hour and end once
  rung out;
- values are resolved as described;
- the call patterns hold;
- every design is in a known category, each category's designs together and in
  category order;
- the export lists every category and design, and `types.ts` stays types only.
