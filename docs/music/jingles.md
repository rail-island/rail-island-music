# Jingles

**Covers** - the jingles: short motifs recorded by hand and transcribed as
played, polished. This covers their folders and metadata, the score, how they
arrange, and where the build puts them (the site only, not the game's export).
**Code** - `jingles/`, `lib/jingles.ts`, `generator/jingles.ts`, `generator/arrangeById.ts`, `test/jingles.test.ts`
**See also** - [scores.md](scores.md), [arrangement.md](arrangement.md), [export.md](export.md), [../site/catalog-site.md](../site/catalog-site.md)

A jingle is a few seconds of music: a motif the game will later play (not
yet). Jingles are recorded, not composed from public-domain sources, so they
live apart from the pieces in `jingles/`, and the public-domain rule does not
apply to them. They are the user's own.

## The folder

`jingles/<id>/`:

| File | What |
|---|---|
| `jingle.json` | `JingleMeta` (`lib/jingles.ts`): `id`, `title`, `composer`, `year`, `groove`, `swing`, `defaults` (ensemble, tempo, key) and `source` (one line: the recording) |
| `score.abc` | the score |
| `recording.mid` | the recording it was transcribed from |
| `SOURCES.md` | what the score was made from and what the polish changed |

Ids and titles are neutral ("Jingle 1"): until the game uses them, they can
change freely. The score uses the ABC subset of [scores.md](scores.md), with
chord symbols for the other ensembles' drums. `generator/jingles.ts` checks
that the folder name, `id` and the `T:` title agree.

## The transcription

The recordings are live piano takes at a nominal 60 bpm with millisecond
timing, the sustain pedal down, with stray and zero-length touches. Each one is
read note by note (onsets, velocities, the pedal) and polished, not rewritten:
quantized on one steady tempo, the stray touches and grace notes dropped, the
pedalled notes written as held notes. The melody, the harmony and the
accompaniment are the recording's; nothing is added. `SOURCES.md` lists what
the polish changed.

A jingle writes all three voices: `melody`, `harmony` (what the right hand
holds under the melody) and `bass` (the left hand). A score that writes both
its harmony and its bass gets no generated chords ([arrangement.md](arrangement.md)),
so solo piano plays exactly what was recorded.

| Jingle | Key | What it is |
|---|---|---|
| `jingle-1` | D, 3/4 | harp chords D, D/C#, D/C under B-A-F#-G, a plain G/B with a run up to D, then D, A7 and a rising D arpeggio to the close |

## Parameters and arranging

`JINGLE_PARAMS` is a piece's ensemble, tempo and key (`PARAMS` without
Length): a jingle is never shortened or repeated. `jingleAsPiece` hands the
arranger the jingle as a piece, with the whole score played once.
`resolveJingleParams` applies overrides and drops unknown names and values. The
ensembles, the drums and the range fitting are the pieces'
([arrangement.md](arrangement.md)). The default is solo piano at normal tempo in
the written key.

## Where the build puts them

`pnpm build:music` writes them for the **site only**:
- `export/site/jingles.json` (`JingleCatalog`: the parameters, and per jingle
  its metadata with the default arrangement's key, meter, duration and bars);
- `export/site/jingles/<id>/score.abc`.

They are not part of what the game would import (`catalog.json`, `music/`,
`sounds/`).

The render tools take a jingle id as well as a piece id (`generator/arrangeById.ts`):

```bash
pnpm exec tsx generator/renderAudio.ts jingle-1 /tmp/j1.mp3 ensemble=chiptune
```

## Tests

`test/jingles.test.ts`:
- the jingles, each with its recording and sources;
- the parameters: ensemble, tempo, key, and no Length;
- each lasts 1.5-15 s and at most 8 bars, played once;
- every ensemble, tempo and key arranges within the samples;
- `jingle-1` keeps the recording's chords, with rolled harp chords in bars 1-3
  and a plain G/B in bar 4;
- the site's list entry.
