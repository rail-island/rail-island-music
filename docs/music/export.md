# Export

**Covers** - the export folder `pnpm build:music` writes, which the site serves and the game would import: the catalog, the note data format, the arranged ABC, the source scores, the synth bundle and the samples.
**Code** - `generator/generate.ts`, `lib/catalog.ts`, `lib/performance.ts`, `synth/index.ts`
**See also** - [arrangement.md](arrangement.md), [synth.md](synth.md), [sounds.md](sounds.md), [../guide/setup-and-build.md](../guide/setup-and-build.md)

`export/` is generated, gitignored and deterministic.

| Path | What |
|---|---|
| `catalog.json` | `{ params, sets, pieces }`: the parameter definitions, the sets, and per piece its `piece.json` plus `key`, `meter`, `duration` (s) and `bars` of the default arrangement |
| `music/<id>.json` | the default arrangement as note data (below) |
| `music/<id>.abc` | the default arrangement's score as ABC |
| `scores/<id>.abc` | the source score, which the site arranges for other parameters |
| `synth/synth.js` | the synth as one ES module ([synth.md](synth.md)) |
| `samples/` | the sample files, `samples.json` (the manifest) and `SOURCES.md` |
| `sounds/sounds.json` | `{ sounds }`: the sound effects catalog ([sounds.md](sounds.md)); the sounds are computed by the synth bundle |

## Note data (`music/<id>.json`)

`Performance` in `lib/performance.ts`, format 1:

| Field | Meaning |
|---|---|
| `format`, `piece`, `title`, `composer`, `params` | identity |
| `ppq` | ticks per quarter note (480) |
| `swing` | share of a beat the first of two eighths takes (0.5 straight) |
| `tempos` | `[tick, quarter notes per minute]`, first at 0 |
| `meters`, `keys` | `[tick, numerator, denominator]`, `[tick, fifths, mode]` at each change |
| `bars` | start tick of every bar, repeats written out |
| `chords` | `[tick, symbol]`, transposed |
| `length`, `duration` | end in ticks; length in seconds |
| `tracks` | per line: `id` (melody, harmony, chords, bass, drums), `name`, `instrument`, `clef`, `gain`, `pan`, `notes` |

`notes` is a flat array of quadruples `[tick, duration ticks, MIDI pitch,
velocity 1..127]`, sorted by tick then pitch; drums use General MIDI
percussion numbers (36 bass drum, 38 snare, 42 closed hi-hat, 49 crash, 51
ride). Times are on a straight grid: `tickToSeconds(perf, tick)` applies the
tempo map and the swing, the same way in the synth and the site. A default
arrangement is 20-80 kB.

## What the game would take

The note data of the default arrangements, `synth/synth.js` and `samples/`;
the synth bundle also computes the train sounds and the tram bell
(`playSound`, [sounds.md](sounds.md)).
The import is a separate step, decided after listening; nothing here is
imported by the game yet. Arranging other parameter combinations in the game
would need the arranger as well (`lib/`), which is not exported today.
