# Score sources

**Covers** - the pieces: one folder per piece, `piece.json`, the ABC subset `score.abc` is written in, the sources and the public-domain rule, adding a piece.
**Code** - `scores/`, `lib/abcParse.ts`, `lib/theory.ts`, `lib/params.ts` (`PieceMeta`), `generator/scores.ts`, `test/abcParse.test.ts`, `test/scores.test.ts`
**See also** - [arrangement.md](arrangement.md), [export.md](export.md)

## A piece's folder

`scores/<id>/` holds:

| File | What |
|---|---|
| `score.abc` | the music, our own transcription in ABC notation |
| `piece.json` | the metadata (below) |
| `SOURCES.md` | every reference the transcription was made from: file, origin, author, licence, use |
| reference files | the editions consulted (e.g. Mutopia's LilyPond sources), committed with the piece |

`<id>` is kebab-case and **permanent once published**: the game may store it
(a playlist setting), like the factory's model ids. `generator/scores.ts`
checks that the folder name, `id` and the ABC `T:` title agree.

`piece.json` (`PieceMeta` in `lib/params.ts`):

| Field | Meaning |
|---|---|
| `id`, `title`, `composer`, `year` | as shown in the catalog |
| `set` | `classical`, `ragtime`, `early-jazz` or `railway` |
| `groove` | the accompaniment pattern: `oompah`, `two-beat`, `swing`, `waltz` ([arrangement.md](arrangement.md)) |
| `swing` | 0.5 straight .. 2/3 triplet swing of the off-beat eighths |
| `defaults` | the default value of each of the four parameters; the default arrangement must last 2 to 5 minutes (`test/scores.test.ts`) |
| `publicDomain` | why the composition is public domain (composer's death, publication) |

## The public-domain rule

Only compositions that are public domain in the EU **and** the US qualify (life
of the authors + 70 years, and published before the US cut-off). Arrangements
and recordings are never used: the ABC is our own transcription, from public
domain editions where one exists. A piece whose status is unclear is left out
(St. Louis Blues is PD in the US but not in the EU until 2029; Tiger Rag's
authorship is disputed).

## The ABC subset

`lib/abcParse.ts` reads one tune and fails with the line number on anything it
does not understand, so a typo fails the build instead of playing a wrong note.

Header (up to `K:`): `X:`, `T:` (first one is the title), `C:`, `M:` (`2/4`,
`C`, `C|`), `L:` (required), `Q:` (`1/4=120`), `P:` (part order, e.g.
`ABRCD`, `A2B`), `V:` voice definitions, `K:`. Other information fields are
ignored.

Voices: `V:<id> role=melody|harmony|bass name="..."`. At least one voice is the
melody. A score with one voice may leave out `V:`.

Body:

- `P:<letter>` starts a part, `V:<id>` (or `[V:<id>]`) switches voice; each
  voice of a part must have the same bars, bar lengths and repeat signs;
- notes `A-G a-g` with `'` and `,`, accidentals `^ ^^ _ __ =` (kept to the end
  of the bar), lengths `2`, `/`, `3/2`, `//`; rests `z`, `x`; whole-bar rests
  `Z`, `Z4`; chords `[CEG]2`;
- ties `-` (also across bar lines and inside chords), tuplets `(3`, `(p:q:r`,
  broken rhythm `>`, `<`, `>>`;
- chord symbols `"Am"`, `"G7"`, `"C/E"`, `"F#dim7"`, `"Bbm/Db"`, `"D+"`
  (qualities: none, m, 7, maj7, m7, 6, m6, 9, m9, dim, dim7, o, o7, m7b5,
  aug, +, sus4); text annotations `"^text"` are ignored;
- bar lines `|`, `||`, `|]`, `[|`, `|:`, `:|`, `::`, endings `[1`, `[2`, `|1`,
  `:|2`;
- inline fields `[K:...]`, `[M:...]`, `[Q:...]`, `[L:...]`, or the same as
  body lines; a key change applies to the voice it is written in;
- `.` and `!staccato!` shorten a note; `!accent!` accents it; grace notes
  `{...}`, slurs, other decorations and `%` comments are skipped.

A short first bar of a part is a pickup: it is played with the bar that closes
its repeat and gets accompaniment from its own beats on, except the very first
bar of a performance, which stays unaccompanied.

## How the pieces are written

The transcriptions are reductions: the melody (the top line of the right hand,
octave doublings left out) and the harmony as chord symbols. The arranger
generates bass, chords, drums and a second line from them, so one
transcription serves every ensemble. A `role=harmony` or `role=bass` voice,
when written, replaces the generated line.

## Adding a piece

1. Check the public-domain status and record it in `publicDomain`.
2. Put the reference edition in the folder and list it in `SOURCES.md`.
3. Write `score.abc` (melody plus chord symbols, parts and repeats as in the
   original) and `piece.json`.
4. `pnpm test`; listen with `generator/renderAudio.ts` and look with
   `generator/renderNotation.ts` ([../guide/setup-and-build.md](../guide/setup-and-build.md)).

## The pieces

| Id | Set | Reference |
|---|---|---|
| `rondo-alla-turca` | classical | Mutopia, Mozart K. 331/3 |
| `hall-of-the-mountain-king` | classical | Mutopia, Grieg Op. 46 No. 4 (piano) |
| `thunder-and-lightning` | classical | Mutopia, Strauss II Op. 324 (Cady, 1878) |
| `the-entertainer` | ragtime | Mutopia, Joplin 1902 edition |
| `maple-leaf-rag` | ragtime | Mutopia, Joplin |
| `elite-syncopations` | ragtime | Mutopia, Joplin |
| `when-the-saints` | early jazz | traditional, transcribed without a file |
