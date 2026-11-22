# Sounds

**Covers** - the game's sound effects: every horn, whistle, engine, rotor, hoof beat, animal call, bell, crash, water, woods, knock, coin and fanfare
Rail Island plays is a design here, synthesized at run time with Web Audio. This
document covers the contract a design implements, the designs and their
parameters and categories, the export the game imports, and auditioning them on the site's catalog.
**Code** - `sounds/types.ts`, `sounds/nodes.ts`, `sounds/index.ts`,
`sounds/designs/trains.ts`, `sounds/designs/crash.ts`, `sounds/designs/diesel.ts`, `sounds/designs/electric.ts`, `sounds/designs/ships.ts`, `sounds/designs/aircraft.ts`, `sounds/designs/animals.ts`, `sounds/designs/water.ts`, `sounds/designs/nature.ts`,
`sounds/designs/bells.ts`, `sounds/designs/rewards.ts`, `sounds/designs/editor.ts`,
`generator/sounds.ts`, `generator/metrics.ts`, `generator/renderSound.ts`, `src/EffectPage.tsx`, `test/sounds.test.ts`, `test/metrics.test.ts`
**See also** - [diesel.md](diesel.md) (the diesel engines), [animals.md](animals.md) (the hoof beat and the animal calls), [../site/catalog-site.md](../site/catalog-site.md),
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
- **A loop** - `start(ctx, dest, t, values)`, which returns a `LoopVoice`. Its
  `endsAt` is Infinity while it runs on; a loop that winds down by itself (a
  diesel shutting down) reports when it is silent, so a player may drop it then. On
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
| `steam-whistle` | one-shot | `pitch` 400-1100 Hz, `call`, `level` | a steam locomotive's whistle: four sine pipes in the chord shape measured in a recorded whistle (`WHISTLE_PIPES`: x0.357, 1, 1.438, 1.727, the top loudest) sliding up onto the note, over band-passed noise |
| `steam-chuff` | loop | `rate` 0-12 beats/s, `intensity` 0..1, `level` | the exhaust beat: looped noise through a band-pass, gated by one struck envelope per beat; every fourth beat heavier; loudness `0.3 + 0.7 * intensity` |
| `diesel-engine-railcar`, `diesel-engine-shunter`, `diesel-engine-mainline`, `diesel-engine-two-stroke`, `diesel-engine-bus`, `diesel-engine-truck` | loop | `rpm` 0..1 (0.4), `load` 0..1 (0.5), `size` 0..1 (0.5), `state` (`run`, `start`, `stop`, `off`), `level` | a diesel engine, one loop per profile (a railcar's six, a shunter's six, a mainline V12, a two-stroke V16, a bus's six, a truck's V8), matched to recordings: a cycle wave of its cylinders' uneven pulses, the knock and the exhaust's breath gated in step, a turbo and, for the truck, a fan. `state` starts it and shuts it down inside the voice ([diesel.md](diesel.md)) |
| `electric-engine-resistor` | loop | `speed` 0..1 (0.5), `load` 0..1 (0.5), `level` | an old DC electric locomotive with resistor control: blowers (noise and a 290 Hz blade tone), a compressor thumping 12 times a second while it stands, the gears' mesh whine (79 teeth, 1.25 m wheels, top speed 120 km/h) with its octave and the brushes, and a controller clack every 1.1-1.4 s while it pulls hard (`load` > 0.5) below two thirds of its top speed |
| `electric-engine-converter` | loop | `speed`, `load`, `level` | a modern three-phase electric train: the converters' cluster of tones measured in an ICE (1180, 1830, 2420, 2750, 3070 Hz) rising 8 % as it gathers speed while it pulls, the auxiliary converter's 620 Hz, gear tone and fans (top speed 160 km/h) |
| `electric-engine-shinkansen` | loop | `speed`, `load`, `level` | a Shinkansen: an inverter whine from 420 Hz fading as it gathers speed, the pantograph's hiss with the cube of speed and the roar of the wind (top speed 300 km/h) |
| `crossing-bell` | loop | `pitch` 600-2400 Hz (1590), `interval` 0.15-1.2 s (0.49), `uneven` 0-0.3 (0.085), `ring` 0.2-2 (1), `level` | a level crossing's electric bell, matched to a recording of a Czech crossing bell (below) |
| `tram-bell` | one-shot | `call` (`departure`, `warning`), `level` | the bell of a Czech Tatra tram, matched to a KT4DM's: five measured partials struck 50 times a second while the button is held; two short rings before departure, one 2.8 s ring as a warning |
| `train-crash` | one-shot | `size` 0..1 (0.5), `level` | two trains colliding: an impact's thump and burst, inharmonic crumpling steel struck again as the cars behind run in, a scrape sliding down as they grind off the rail, debris settling and a rumble; lower, longer and denser the bigger ([below](#the-train-crash)) |
| `ship-horn` | one-shot | `pitch` 50-250 Hz, `seconds` 0.3-3, `level` | two sawtooths and a square near the root through a low-pass, with a 4.5 Hz waver |
| `helicopter` | loop | `spin` 0..1 (1), `load` 0..1 (0.5), `size` 0..1 (0.5), `blades` 2-6 (4), `level` | a helicopter's rotor and turbine, shared by every helicopter: a struck pulse per blade passing (a low thump and a band of noise, harder the more it lifts) at blades x the rotor's revolutions, a turbine whine rising with the rotor, the tail rotor's buzz and the rotor wash; silent at `spin` 0 ([below](#the-helicopter)) |
| `hoof-beat` | loop | `rate` 0-16 footfalls/s per animal (3), `foot` `hoof`/`cloven`/`padded`, `size` 0..1 (0.5), `stride` 0.5-3 m (1.4), `count` 1-6 (1), `level` | a draft team's footfalls: per animal a click, a knock and a thud in the foot's character, four per gait cycle in a walk's or a trot's rhythm, the animals out of step, the harness jingling; silent at `rate` 0 ([animals.md](animals.md)) |
| `animal-call` | one-shot | `species` `horse`/`donkey`/`mule`/`cow`/`camel`/`elephant`, `pitch` 0.7-1.4 (1), `level` | a whinny, a bray, a mule's call, a moo, a groan or a trumpet: oscillators along a pitch contour through formants, with a breath of noise; played only by the player's Horn ([animals.md](animals.md)) |
| `river-rapids` | loop | `strength` 0..1, `level` | a river over rocks: noise through a low and a bright band-pass that wander every 0.12 s, softened, with bubbles on top (short sines rising as they burst); the stronger, the louder and the more bubbles |
| `waterfall` | loop | `size` 0..1, `level` | a steady roar: low-passed noise, a deep rumble and a little spray hiss, wandering every 0.25 s; the bigger, the lower and heavier |
| `sea-surf` | loop | `strength` 0..1, `level` | the sea on a shore: a steady wash, a low rush and a hiss whose filter and level drift slowly (every 0.7 s, seeded), swelling and settling with no single waves; fuller the stronger |
| `spring-fountain` | loop | `size` 0..1, `level` | a spring, which the game draws as a fountain: the jets' hiss and the basin's splash, with a bright patter of droplets (band-passed noise clicks, 20-60 a second) |
| `woods` | loop | `density` 0..1 (0.6), `birds` 0..1 (0.6), `level` | a forest around the listener: leaves rustling in slow gusts (band-passed noise every 1.2 s) over a low breath of wind, and now and then a bird of a flock of five calling (chirps, a two-note whistle or a trill), seconds apart (`birdGap`), more often the denser and livelier; no birds at `birds` 0 |
| `church-bell` | one-shot | `pitch` 200-900 Hz (440), `strikes` 1-12 (3), `interval` 0.8-6 s (2.2), `ring` 0.3-1.5, `level` | a village church bell tolling: nine partials of a tuned bell (`CHURCH_PARTIALS`) and the clapper's clang per strike |
| `big-ben` | one-shot | `pitch` 100-260 Hz (165, E), `strikes` (the hour, 3), `chime` `quarters` / `hour`, `ring`, `level` | the Great Bell of the Westminster clock tower: twinned, beating partials (`GREAT_BELL_PARTIALS`), struck every 4.5 s; with `quarters`, first the Westminster Quarters' last four changes on the four quarter bells (G#4 F#4 E4 B3, kept in tune with `pitch`) |
| `notre-dame-bell` | one-shot | `pitch` 60-160 Hz (92.5, F#), `strikes` 1-12 (4), `interval` 1.5-8 s (3.4), `ring`, `level` | Emmanuel, the bourdon of Notre-Dame de Paris: a deep bell whose hum rings about 22 s (`BOURDON_PARTIALS`) |
| `token-coins` | one-shot | `coins` 1-5 (1), `pitch` 0.8-1.25 (1), `level` | tokens earned: one clink of a gold coin per coin, about 85 ms apart (`coinTimes`), each a struck disc of five inharmonic partials (`COIN_PARTIALS`, from 2350 Hz) with a tick of its edge ([below](#the-rewards)) |
| `gift-fanfare` | one-shot | `level` | a gift has arrived: a 2.6 s brass fanfare in C major (`FANFARE_NOTES`), a cymbal's shimmer and a timpani stroke under the held chord |
| `gift-take` | one-shot | `level` | a gift taken into the collection: the wrapping torn open (noise sweeping up), then a glittering chime arpeggio (C6 E6 G6 C7 E7) landing on a soft C major chord |
| `shop-buy` | one-shot | `level` | an item bought with tokens: the register's clack, three coins into the till and its two-tone ka-ching |
| `edit-build` | one-shot | `level` | a falling sine thud with a short burst of grit, trimmed by `EDIT_TRIM` (0.3, about -10 dB) as it plays at the listener on every edit |
| `edit-demolish` | one-shot | `level` | a lower, longer thud and a long crumble of low-passed grit, trimmed like `edit-build` |

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

**The electric engines** (`sounds/designs/electric.ts`) are loops the game drives
with `speed` (a fraction of the train's top speed) and `load` (how hard it
pulls); each tick glides every tone and level to the new values (0.25 s). Only
the resistor locomotive schedules events: its compressor strokes while it
stands and its controller notches while it pulls away, both only as far ahead
as it is ticked. What was measured and what was not:

| Design | Measured (reference) | Modelled without a measurement |
|---|---|---|
| `electric-engine-resistor` | the blowers' level against the rest (an electric idling at Kosice) | gears, notches, compressor: no recording of one pulling away was found |
| `electric-engine-converter` | the five converter tones, their 8 % rise, the 620 Hz (an ICE leaving Berlin Hbf) | gear tone, fans |
| `electric-engine-shinkansen` | the wind's roar: broadband, mostly below 1.2 kHz (a set passing Odawara) | the inverter whine, the pantograph |

**The helicopter** (`sounds/designs/aircraft.ts`) is one loop for every
helicopter. The factory pins its **character** per model: `size` (0 a light
single-engine helicopter like a Bell 206, 1 a heavy one like a Mil Mi-8: the
bigger, the lower, slower and heavier) and `blades` (the main rotor's blades).
The game drives it at **run time** with `spin` (the rotor's speed, a fraction of
full: 0 stands, silent but still running as a voice) and `load` (the collective:
climbing heavier and louder, descending lighter). Each tick glides to the new
values, the rotor's speed with a time constant of 0.6 s (`SPIN_GLIDE`), and the
blade pulses are scheduled only as far ahead as it is ticked, their rate
following the same glide.

| Part | What | Rate |
|---|---|---|
| blade slap | one struck pulse per blade: a low thump (a sine of 110-60 Hz and low-passed noise) and band-passed noise (820-440 Hz), deeper the bigger; one blade a little stronger (tracking), so the rotor lopes once a turn | blades x the rotor's revolutions (`bladePass`) |
| turbine | three sines (x1, x1.5, x0.25 of 2600-1500 Hz, lower the bigger) and an exhaust band near 1.2 kHz, softened by a 3.2 kHz low-pass; from a third of its pitch up with `spin` | - |
| tail rotor | a sawtooth band-limited to its 2nd and 3rd harmonics | about 6.2 x the main rotor, 2 to 3 blades (`tailPass`) |
| wash | broadband noise, 90 Hz to 1.8-1.1 kHz | - |

The rotor's revolutions follow from a tip speed that is about the same for
every helicopter (`TIP_SPEED`, 212 m/s) and a diameter from 10.2 m (`size` 0)
to 21.3 m (`size` 1), published figures: a Bell 206 turns at 394 rpm (2 blades:
a slap of 13.2 Hz), a Mil Mi-8 at 192 rpm (5 blades: 15.8 Hz), so `size` 0.85
with 4 blades (an S-92-like) slaps at 13.8 Hz. What was measured and what was not:

| Measured (references) | Modelled without a measurement |
|---|---|
| a light two-bladed helicopter hovering: its slap (11.8 Hz) and its depth, about 11 dB; the spectrum, broad from 125 Hz to 2 kHz and falling above; the tail rotor's 2nd and 3rd harmonics (159, 233 Hz) the strongest lines. One starting up: a weak turbine line near 1.5 kHz, about 20 dB under the rotor | the heavy end of `size` (no recording of a large helicopter was used), the turbine's pitch and its rise with the rotor, how `load` weighs each part, the spin-up's glide |

**The tram bell** was matched to the bell of a Tatra KT4DM (a Czech-built tram)
ringing as its doors close: partials at 1565, 3647, 6230 (the loudest), 9295
and 12452 Hz at -5, -12, 0, -3 and -18 dB, struck 50 times a second (a
mains-driven electric bell), steady for the 2.8 s it rings. The design plays
those partials as five sines under one envelope per press, rippled and ticked
by a 50 Hz sawtooth while held; a render matches the recording's partial
levels within 1 dB. The departure's two short rings are timed from how Czech
drivers ring, not from a recording; the decay after release is estimated.

**The train crash** (`sounds/designs/crash.ts`) is a one-shot of 2.2 s (`size`
0) to 3.4 s (`size` 1, `crashLength`), which the game plays at the point where
two trains collide. It was **modelled without a reference recording**: nothing
in it is measured.

| Part | What |
|---|---|
| impact | a sine falling from 80-60 Hz to 28 Hz and a low-passed burst of noise, struck together |
| steel | six inharmonic partials (`CRASH_METAL`: x1, 1.57, 2.36, 3.62, 5.1, 7.13 of 340-190 Hz, lower the bigger, `metalBase`), each sagging 7 % in pitch, struck at the impact and three times more, softer (`CRASH_CRUMPLES`), as the cars behind run into the ones in front |
| scrape | band-passed noise (Q 6) sliding from 3.1 kHz to 900 Hz over 1.3-1.7 s |
| debris | 14-28 short knocks of band-passed noise, 0.5-4 kHz, scattered over the crash and thinning out, from a seeded sequence so a render is the same every time |
| rumble | low-passed noise (220-140 Hz) dying away over the whole crash |

At the defaults it renders at about -20 LUFS, between a running engine and a
horn's blast: it is the loudest thing a train can do short of its horn.

**The rewards** (`sounds/designs/rewards.ts`) are what the player hears when
something is given to them; like the editor's knocks they are not placed in the
world, and each is trimmed by `REWARD_TRIM` (0.45). They were **modelled without a
reference recording**. A coin is five sines struck together, each ringing
0.1-0.42 s, and a band-passed tick of its edge; the coins of one payment differ a
little in pitch and fall slightly unevenly, from a seeded sequence. The fanfare's
brass is two sawtooths detuned by 12 cents through a low-pass that opens on each
attack; its held chord swells and wavers at 5.5 Hz. The chimes of `gift-take` and
`shop-buy` are a sine with two bright overtones (x2.76, x5.4). At the defaults a
single coin renders at about -32 LUFS (three coins -21), `gift-take` and
`shop-buy` near -20 and the fanfare -17.5, about a horn's blast: tokens come often,
a gift rarely.

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
| `diesel-engine-*` | -29.5 for every engine (about -40 idling, -21 at full revs and effort) |
| `electric-engine-*` | -29.0 to -29.5 at the defaults (`speed` 0.5, `load` 0.5) |
| `helicopter` | -28.8 at the defaults (-27.9 light, -30.1 heavy; -32.4 descending, -25.3 climbing) |
| `hoof-beat` | -30.1 at the defaults (one horse walking; -25.0 four horses trotting) |
| `river-rapids`, `waterfall`, `spring-fountain` | about -31 |
| `sea-surf` | -33.7 |
| `woods` | -38 |
| a horn's blast, for comparison | about -15 (an `animal-call`: -15 to -17.5) |

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
pnpm exec tsx generator/renderSound.ts diesel-engine-bus /tmp/bus.mp3 state=start rpm=0 --at=4:rpm=0.7 --at=9:state=stop --seconds=14
```

`generator/renderSound.ts` renders one design through the very code the game
imports. A one-shot plays once at 0; a loop starts at 0 and is ticked for the
whole length. `--at=S:name=value` changes a loop's value at S seconds (one
change per flag); the loop is then ticked every 50 ms with the changes set as
they come, the way the game drives it, which is how a diesel's start, revving
and stop are heard in one render. It writes WAV or MP3 (ffmpeg), at 44.1 kHz, through headless
Chromium's `OfflineAudioContext` (Playwright's, pre-installed in the cloud
sessions). Parameters are `name=value`: a number is parsed as one, anything else
is a choice. Use it to compare a design with a reference recording, or to send
someone a sound.

## Categories

Every design has a `category`, and `CATEGORIES` (`sounds/index.ts`) lists them
in order, each with a `title` and a one-line `description`:

| Category | What it holds | Designs |
|---|---|---|
| `trains` | locomotives and the railway, and the diesel engines of buses and trucks | horn, whistle, exhaust beat, diesel engine and its start and stop, electric engines, crossing bell, tram bell |
| `ships` | vessels in port and at sea | ship horn |
| `aircraft` | aircraft in the air and on the pad | helicopter |
| `animals` | draft animals: their hooves and their calls | hoof beat, animal call |
| `water` | ambient water, played while in view | rapids, waterfall, spring fountain, sea surf |
| `nature` | ambient life of the land | woods |
| `bells` | tower bells tolling | church bell, Big Ben, Notre-Dame bourdon |
| `rewards` | what the player is given | tokens, gift arrives, gift taken, bought |
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
- the resistor locomotive clacks a notch every 1.1-1.4 s only while pulling
  hard at low speed, only as far ahead as asked; the gears whine at their mesh
  frequency; the converter keeps the measured tones;
- the tram bell rings twice short or once long, keeps the measured partials,
  and ends once rung out; the whistle keeps the measured chord shape;
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
- the helicopter has the parameters the game and the factory name, slaps at
  blades x the rotor's revolutions (a Bell 206 near 13 Hz, a Mi-8 near 16 Hz)
  only as far ahead as asked, is silent at `spin` 0 while its voice runs on,
  speeds its slap up gradually when `spin` is set, slaps harder the more it
  lifts, and schedules the same every time;
- the animals have the parameters the factory and the game name; the hoof beat
  is silent at `rate` 0, steps at its rate in the gait's rhythm only as far
  ahead as asked, puts down about `count` times the footfalls out of step, and
  schedules the same every time; every species of the call sounds and ends by
  itself;
- the woods sing the same birds every time, more the denser and livelier, none
  at `birds` 0;
- the rewards are one-shots that end by themselves, clink once per coin about
  `COIN_GAP` apart the same every time, and the fanfare's held chord ends it;
- the bells ring the Quarters' four last changes before the hour and end once
  rung out;
- values are resolved as described;
- the call patterns hold;
- every design is in a known category, each category's designs together and in
  category order;
- the export lists every category and design, and `types.ts` stays types only.
