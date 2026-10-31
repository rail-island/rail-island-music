# Sounds

**Covers** - the game's sound effects: every horn, whistle, bell and knock Rail
Island plays is a design here, synthesized at run time with Web Audio. This
document covers the contract a design implements, the designs and their
parameters, the export the game imports, and the Sounds page that auditions them.
**Code** - `sounds/types.ts`, `sounds/nodes.ts`, `sounds/index.ts`,
`sounds/designs/trains.ts`, `sounds/designs/ships.ts`, `sounds/designs/editor.ts`,
`generator/sounds.ts`, `src/SoundsPage.tsx`, `test/sounds.test.ts`
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
| `crossing-bell` | loop | `pitch` 600-2400 Hz, `interval` 0.15-1.2 s, `level` | a level crossing's bell: four inharmonic sine partials (1, 2.76, 5.4, 8.93) struck every `interval` |
| `ship-horn` | one-shot | `pitch` 50-250 Hz, `seconds` 0.3-3, `level` | two sawtooths and a square near the root through a low-pass, with a 4.5 Hz waver |
| `edit-build` | one-shot | `level` | a falling sine thud with a short burst of grit |
| `edit-demolish` | one-shot | `level` | a lower, longer thud and a long crumble of low-passed grit |

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
the Sounds page at once. The game plays it once its code names the id.

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

## The Sounds page (`?sounds`)

`src/SoundsPage.tsx`: one card per design, in `SOUNDS` order. Each card has:
- the design's title, id and description;
- a slider for every number parameter and a picker for every choice;
- Play for a one-shot, Start/Stop for a loop (ticked every 50 ms, 0.2 s ahead,
  the way the game ticks it each frame);
- Defaults, which resets the parameters.

A running loop takes a parameter change at once, so a beat's rate can be swept
while it plays. The page plays the designs **from source**, the same code the
generator bundles, through one `AudioContext` of its own, created on the first
press.

## Tests

`test/sounds.test.ts`, over a stub Web Audio context:
- every design is well formed and includes each id the game plays;
- it plays at its defaults and at both ends of every range;
- the beat and the bell schedule only as far ahead as asked, at their rate, and
  stop when stopped;
- values are resolved as described;
- the call patterns hold;
- the export lists every design and `types.ts` stays types only.
