# Jingles

**Covers** - the jingles: short motifs recorded by hand and transcribed into two
versions each. This covers their folders and metadata, the tidy and the
rewritten score, the Version parameter, how they arrange, and where the build
puts them (the site only, not the game's export).
**Code** - `jingles/`, `lib/jingles.ts`, `generator/jingles.ts`, `generator/arrangeById.ts`, `test/jingles.test.ts`
**See also** - [scores.md](scores.md), [arrangement.md](arrangement.md), [export.md](export.md), [../site/catalog-site.md](../site/catalog-site.md)

A jingle is a few seconds of music: a motif the game will later play for its
cities (not yet). They are recorded, not composed from public-domain sources,
so they live apart from the pieces in `jingles/`, and the public-domain rule
does not apply to them. They are the user's own.

## The folder

`jingles/<id>/`:

| File | What |
|---|---|
| `jingle.json` | `JingleMeta` (`lib/jingles.ts`): `id`, `title`, `composer`, `year`, `groove`, `swing`, `defaults` (version, ensemble, tempo, key) and `source` (one line: the recording) |
| `tidy.abc` | the tidy version |
| `rewrite.abc` | the rewritten version |
| `recording.mid` | the recording it was transcribed from |
| `SOURCES.md` | what each version was made from |

The ids are `jingle-1` .. `jingle-5`, in recording order (11:53, 11:55, 11:56,
11:57, 11:58), with titles "Jingle 1..5". They are neutral on purpose: until
the game uses them, ids and titles can change freely. Both scores use the ABC
subset of [scores.md](scores.md), with a melody voice and a written `bass` voice,
and chord symbols for the generated chords and drums. `generator/jingles.ts`
checks that the folder name, `id` and both `T:` titles agree.

## Two versions

The recordings are live piano takes: about 1-6 s each, at a nominal 60 bpm with
millisecond timing, the sustain pedal down, with stray and zero-length touches.
Each one was read note by note (onsets, velocities, the pedal) and written
twice:

- **tidy** - the playing, cleaned up. Quantized to eighths on a steady tempo, the
  stray touches dropped, the pedalled bass written as notes of their length, and
  rushed bars evened out to whole bars. The melody and harmony are the
  recording's.
- **rewrite** - the idea, written again cleanly. The same motif, with a
  harmony that moves where the recording held a pedal, a cadence and a closing
  chord.

The **Version** parameter picks between them, and the site switches it like any
other parameter, so the two can be compared on one page. Once one is chosen for
a jingle, the other file is deleted and the parameter goes.

| Jingle | Key | What it is |
|---|---|---|
| `jingle-1` | D | F#-E-D-A falling over a bass descending D, C#, C, B |
| `jingle-2` | C | a quick chime G-E-D-C, G-A-G down to C |
| `jingle-3` | D minor | A/F-E-D-C-D over a D pedal |
| `jingle-4` | D minor | D-D-E-F-D, G, a run to F-G-E-C#-A, a leap to D-A-D |
| `jingle-5` | C | a C-G-C arpeggio under a turn C-B-D from E, F, then G |

## Parameters and arranging

`JINGLE_PARAMS` is Version, then a piece's ensemble, tempo and key (`PARAMS`
without Length): a jingle is never shortened or repeated. `jingleAsPiece`
hands the arranger the jingle as a piece, with the whole score played once.
`resolveJingleParams` applies overrides and drops unknown values. The ensembles,
the generated chords and drums and the range fitting are the pieces'
([arrangement.md](arrangement.md)). The default is solo piano at normal tempo
in the written key, tidy version.

## Where the build puts them

`pnpm build:music` writes them for the **site only**:
- `export/site/jingles.json` (`JingleCatalog`: the parameters, and per jingle
  its metadata with the default arrangement's key, meter, duration and bars);
- `export/site/jingles/<id>/tidy.abc` and `rewrite.abc`.

They are not part of what the game would import (`catalog.json`, `music/`,
`sounds/`). They join that export when the city jingles are built.

The render tools take a jingle id as well as a piece id (`generator/arrangeById.ts`),
with `version=tidy|rewrite` among the parameters:

```bash
pnpm exec tsx generator/renderAudio.ts jingle-1 /tmp/j1.mp3 version=rewrite
```

## Tests

`test/jingles.test.ts`:
- the five jingles, each with its recording and sources;
- the parameters: Version, ensemble, tempo, key, and no Length;
- both versions last 1.5-15 s and at most 8 bars, played once;
- every version, ensemble, tempo and key arranges within the samples;
- the Version parameter switches the melody;
- the site's list entry.
