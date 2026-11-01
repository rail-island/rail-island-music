# Sounds

**Covers** - the game's sound effects: every horn, whistle, bell, water and knock
Rail Island plays is a design here, synthesized at run time with Web Audio. This
document covers the contract a design implements, the designs and their
parameters and categories, the export the game imports, and auditioning them on the site's catalog.
**Code** - `sounds/types.ts`, `sounds/nodes.ts`, `sounds/index.ts`,
`sounds/designs/trains.ts`, `sounds/designs/ships.ts`, `sounds/designs/water.ts`, `sounds/designs/editor.ts`,
`generator/sounds.ts`, `generator/renderSound.ts`, `src/EffectPage.tsx`, `test/sounds.test.ts`
**See also** - [../music/export.md](../music/export.md),
[../site/catalog-site.md](../site/catalog-site.md); in the game,
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
  `title`, a one-line `description`.
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
| `crossing-bell` | loop | `pitch` 600-2400 Hz (1590), `interval` 0.15-1.2 s (0.49), `uneven` 0-0.3 (0.085), `ring` 0.2-2 (1), `level` | a level crossing's electric bell, matched to a recording of a Czech crossing bell (below) |
| `ship-horn` | one-shot | `pitch` 50-250 Hz, `seconds` 0.3-3, `level` | two sawtooths and a square near the root through a low-pass, with a 4.5 Hz waver |
| `river-rapids` | loop | `strength` 0..1, `level` | a river over rocks: noise through a low and a bright band-pass that wander every 0.12 s, softened, with bubbles on top (short sines rising as they burst); the stronger, the louder and the more bubbles |
| `waterfall` | loop | `size` 0..1, `level` | a steady roar: low-passed noise, a deep rumble and a little spray hiss, wandering every 0.25 s; the bigger, the lower and heavier |
| `sea-surf` | loop | `strength` 0..1, `level` | the sea on a shore: a quiet wash under waves every 6-10 s (seeded, uneven), each a rush whose low-pass opens as it rises, a bright break at the crest and a hiss of shingle as it draws back |
| `spring-fountain` | loop | `size` 0..1, `level` | a spring, which the game draws as a fountain: the jets' hiss and the basin's splash, with a bright patter of droplets (band-passed noise clicks, 20-60 a second) |
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

**The calls** (`call`, `hornPattern`) are why a train sounds. Each is a pattern
of blasts:

| Call | Horn | Whistle |
|---|---|---|
| `departure` | 0.3 s high (x1.26), then 0.45 s root | 0.35 s, then 0.9 s |
| `crossing` | 1.0 s | 1.1 s |
| `tunnel` | 1.3 s | 1.4 s |
| `player` | 0.6 s | 0.8 s |

To add a design, write it in `sounds/designs/` with `oneShot` or `loop`
(`sounds/nodes.ts`) and list it in `SOUNDS` (`sounds/index.ts`). It appears on
the site's catalog at once. The game plays it once its code names the id.

## The export

`pnpm build:music` (`generator/sounds.ts`) writes `export/sounds/`:

| File | What |
|---|---|
| `sounds.js` | every design as ONE ES module (esbuild): `SOUNDS`, `SOUNDS_FORMAT`, `soundById`, `soundMeta`, `resolveValues` |
| `sounds.meta.json` | `{ note, format, module, sounds }`: every design's `id`, `title`, `description`, `kind` and `params`, without code |
| `sounds.d.ts` | `sounds/types.ts` followed by the module's exports |

`SOUNDS_FORMAT` (1) is bumped when the contract changes incompatibly. The game's
import refuses a format it does not know. The game runs
`pnpm import:sounds`, which builds this repository and mirrors `export/sounds/`
into its committed `db/sounds/`.

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

Every design has a `category`: `trains` (horn, whistle, exhaust beat, crossing
bell), `ships` (ship horn), `water` (rapids, waterfall, spring fountain, sea
surf) or `editor` (build, demolish). The site's list groups the effects by it.
It is part of `sounds.meta.json` and the contract, as an additive field the game
ignores, so it needs no format bump.

## Auditioning on the site

The sound effects are rows of the site's one list (filter it to Sound effects).
Each opens on a page of its own (`src/EffectPage.tsx`,
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
press. The old `?sounds` page is gone and its link lands on the filtered list.

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
- values are resolved as described;
- the call patterns hold;
- the export lists every design and `types.ts` stays types only.
