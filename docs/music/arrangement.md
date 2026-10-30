# Arrangement

**Covers** - how a score and four parameters become a performance: the parameters, the form, transposition, the grooves and the generated lines, the ensembles and ranges, and the arranged score written back as ABC.
**Code** - `lib/arrange.ts`, `lib/ensembles.ts`, `lib/params.ts`, `lib/abcWrite.ts`, `lib/theory.ts`, `test/arrange.test.ts`, `test/abcWrite.test.ts`
**See also** - [scores.md](scores.md), [export.md](export.md), [synth.md](synth.md)

`arrange(piece, score, params)` is pure and deterministic. The generator runs it
for every piece's default parameters; the site runs the same code in the
browser for any other combination, so both give the same notes.

## Parameters

Every piece offers the same four enum parameters (`PARAMS`):

| Parameter | Values | Effect |
|---|---|---|
| `ensemble` | `piano`, `ragtime-band`, `brass-band`, `jazz-band`, `chiptune` | which instruments play which line (below) |
| `tempo` | `calm`, `normal`, `lively` | the score's tempo times 0.88, 1 or 1.12 |
| `length` | `short`, `full`, `long` | each part once without repeats (last ending), as written, or the whole form twice |
| `key` | `-3` .. `+3` | transposition in semitones; the new key is spelt with the fewest accidentals |

A piece's defaults are in its `piece.json`.

## Form

`unroll` lays the bars out in playing order: the parts in `P:` order (or as
written), each part with its repeats and first/second endings. `short` keeps
the first appearance of each part, every bar once, taking the highest-numbered
ending. The result has repeats written out, so bar k of the performance is
bar k of the arranged score.

## Generated lines

Chord symbols are carried from bar to bar. From them and the piece's `groove`:

| Groove | Bass | Chords | Drums |
|---|---|---|---|
| `oompah` (2/4, 2/2, 6/8) | every beat, root then fifth | off-beat stabs | bass drum on the beats, snare off |
| `two-beat` (4/4) | beats 1 and 3, root and fifth | beats 2 and 4 | bass drum 1 and 3, snare 2 and 4, hi-hat |
| `swing` (4/4) | walking quarters, approaching the next root by a semitone | beats 2 and 4 | ride with the swung off-beats, hi-hat 2 and 4 |
| `waltz` (3/4) | beat 1 | beats 2 and 3 | bass drum 1, hi-hat 2 and 3 |

A bar with another number of beats falls back to `oompah` (or `waltz` for
three). A crash cymbal marks the first full bar of every part. Chords are close
voicings between G3 and D5, each led to the nearest voicing of the one before.
In the chiptune ensemble the chords are a 16th-note arpeggio.

When the score has no `harmony` voice, a second line is generated: under every
melody note of an eighth or longer, the nearest chord tone a third to a sixth
below (skipped under short non-chord tones). A written `bass` or `harmony` voice
replaces the generated one.

## Ensembles

`ENSEMBLES` maps each line to a synth instrument, a MIDI range, a gain, a pan
and a velocity factor:

| Ensemble | Melody | Harmony | Chords | Bass | Drums |
|---|---|---|---|---|---|
| `piano` | piano | piano | piano | piano | none |
| `ragtime-band` | clarinet | trombone | piano | tuba | kit |
| `brass-band` | trumpet | trombone | trombone ("Horns") | tuba | march (no hi-hat or ride) |
| `jazz-band` | trumpet | clarinet | piano | double bass | kit |
| `chiptune` | square | pulse | pulse arpeggio | triangle | noise |

Each line is shifted by whole octaves to fit its range best; notes still
outside are folded in by octaves, so every note lies where the instrument has
samples (`test/scores.test.ts`). Velocities: written notes 92-100 (accented
112), harmony 72, chords 62, bass 80-92. A staccato note sounds half its
length.

## The arranged score

`writeAbc(perf)` writes the performance back as ABC, one voice per track,
four bars to a line, `L:1/16`. Piano tracks share a grand staff; two tracks of
the same instrument share a staff. Notes of a track are grouped by onset, each
group lasting until its shortest note ends or the next onset; groups are split
at bar lines (tied) and spelt in the bar's key with accidentals tracked per
bar; triplets of equal non-dyadic lengths are written `(3`. The melody voice
carries the chord symbols. A drum staff uses the percussion clef and no key
(bass drum F, snare c, hi-hat g, ride f, crash a). Key, meter and tempo
changes that fall on the first bar of a line are written at the end of the line
before (abcjs fails on a key field that opens a voice's line).
`test/abcWrite.test.ts` reads the result back with the parser and compares
bars and onsets.
