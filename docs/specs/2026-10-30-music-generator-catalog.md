# Music generator and catalog

Status: draft
Date: 2026-10-30
Area: new repository rail-island-music (generator, export, catalog site, deploy)

## Context of the change

`rail-island-music` is an empty repository (one branch, no commits). The game,
Rail Island (`rail-island-webapp`), has no music. Its sister repository
`rail-island-factory` sets the pattern this repository follows: a TypeScript
(strict) Node-only `generator/` run with `tsx` writes a deterministic,
gitignored `export/` folder. The game imports that folder in a separate,
standalone step. A Solid + Vite catalog site at `factory.railisland.com` lists
everything the generator builds, with a detail page per item and URL state in
the query string. It is hosted as an assets-only Cloudflare Worker and deployed
by GitHub Actions. Docs live in `docs/` with a hand-kept index. Tests use
Vitest; the package manager is pnpm.

The aim is to see whether generated music is good enough for the game before
committing to an import. Nothing is imported into the game in this change.

## User request

Create JS generator in rail-island-music, which will generate music for Rail
Island. For now, add several suitable classic sheets (eg. turkish march) or jazz
compositions. Add simple browsing UI allowing to play the composition and to
show notation (similar as Factory UI). We will import this into game in future,
if the results will be reasonable.

## Decisions

### What should the 'generator' in rail-island-music actually do with a composition like the Turkish March?
| Option | What it means |
|---|---|
| Arrange + render | Pieces are written once as note data. The generator turns them into game-ready output, with arrangement parameters (tempo, instrument set, style) like the factory's design parameters. |
| Faithful playback only | Pieces are transcribed and exported as-is; the generator only converts the format. |
| Procedural composing | Pieces act as style seeds; the generator writes new, original music in that style. |
**Answer: Arrange + render** - each piece is one score plus arrangement parameters, and the output stays deterministic.

### What will the music do in the game?
| Option | What it means |
|---|---|
| Background playlist | Whole pieces of 2-5 minutes played one after another while building. |
| Seamless loops | Shorter gapless loops tied to mood or game speed. |
| Jingles / stingers | Cues of a few seconds for game events. |
| Undecided yet | Keep the format generic. |
**Answer: Background playlist** - whole pieces of a few minutes, played one after another. Loops and jingles are not a goal now.

### In what format should the pieces be written in the repository (the source the generator arranges)?
| Option | What it means |
|---|---|
| ABC notation text | Compact, human-readable text per piece, reviewable in diffs, parsed in TS; abcjs can also render it. Weak at dense piano writing. |
| MusicXML imports | Most accurate, but huge, verbose and licence-checked file by file. |
| TypeScript note DSL | Own syntax in TS modules; full control, but a new notation nothing else reads. |
| MIDI imports | Easy to find, binary, poor notation, uneven quality. |
**Answer: ABC notation text.**

### What should the game eventually receive from the generator?
| Option | What it means |
|---|---|
| Note data + JS synth | Compact JSON/JS score per arrangement plus a small WebAudio synth module that plays it in the game and on the site. |
| Rendered audio files | OGG/MP3 rendered offline; best sound, MBs per piece, slower builds. |
| Both | Note data + synth as the main path, rendered audio as an optional extra. |
**Answer: Note data + JS synth** - the export is note data (kilobytes per arrangement) and one shared synth module, so the site and the game make the same sound.

### Which pieces should the first batch contain?
| Option | What it means |
|---|---|
| Classical set | Mozart Turkish March, Beethoven Fur Elise, Grieg In the Hall of the Mountain King, Offenbach Galop infernal, Strauss II Thunder and Lightning polka, Rossini William Tell finale. |
| Ragtime set | Joplin The Entertainer, Maple Leaf Rag, Elite Syncopations. |
| Early jazz set | Public-domain early jazz (published before 1930): St. Louis Blues (1914), Tiger Rag (1917), Darktown Strutters' Ball (1917), When the Saints (traditional). |
| Railway-themed pieces | Traditional railroad songs: Casey Jones (1909), Wabash Cannonball, I've Been Working on the Railroad. |
**Answer: Classical set, Ragtime set, Early jazz set, Railway-themed pieces** - all four sets are in. Only compositions that are public domain qualify; the transcriptions are our own, so no edition's copyright applies.

### How many pieces is 'several' for the first version?
| Option | What it means |
|---|---|
| About 6 | Enough to judge the result. |
| About 12 | A real playlist of 30-40 minutes; double the work. |
| 3 | Minimal proof of concept. |
**Answer: About 12.** The first batch takes the strongest pieces from each set (see the piece list in the high-level plan); the rest are reserves.

### How should the shared JS synth make its sound?
| Option | What it means |
|---|---|
| Small sample set | A few short CC0/public-domain instrument samples (piano, bass, brass, drums), about 1-3 MB, stored in git with their sources, pitched between sampled notes. |
| Pure oscillator synth | WebAudio oscillators only; zero asset bytes, retro character, may sound thin. |
| Full General MIDI soundfont | Any instrument, 10-30 MB, licence to check. |
**Answer: Small sample set.**

### Which arrangement parameters should each piece offer?
| Option | What it means |
|---|---|
| Ensemble / style | Solo piano, ragtime band, brass band, chiptune...; maps voices to instruments and may add a generated accompaniment. |
| Tempo | Named tempos (calm, normal, lively). |
| Length / repeats | Whether repeats are played; shortening to fit 2-5 minutes. |
| Key / transposition | Transpose for playlist fit or instrument range. |
**Answer: Ensemble / style, Tempo, Length / repeats, Key / transposition** - all four.

### What should the notation on a piece's page show?
| Option | What it means |
|---|---|
| Arranged score, follows playback | The generator writes the chosen arrangement back as ABC; abcjs renders it; the current bar is highlighted while playing; a bar click starts playback there. |
| Original source score only | abcjs renders the source ABC as written; no accompaniment, transposition or ensemble shown. |
| Piano roll instead of notation | Scrolling canvas view of the note data; not real notation. |
**Answer: Arranged score, follows playback.**

### What should the browsing UI look like?
| Option | What it means |
|---|---|
| Factory-like catalog | Solid + Vite site in the factory's look: app bar, list of pieces with search and set filter, piece page with parameter pickers, Play/Pause/Stop, progress and notation; mini player keeps playing while browsing; state in the URL. |
| Playlist-first player | One page with playlist, player and notation, auto-advancing. |
| Catalog + playlist mode | The catalog plus a "Play all" mode. |
**Answer: Factory-like catalog.**

### Where should the music catalog site live?
| Option | What it means |
|---|---|
| music.railisland.com | Separate assets-only Cloudflare Worker deployed by GitHub Actions on push to master, same Cloudflare secrets as the factory. |
| No hosting yet | Local `pnpm dev` only. |
| Inside the factory site | A Music section on factory.railisland.com; couples the repositories. |
**Answer: music.railisland.com.**

### The game shows every factory text in 14 languages. What about piece titles and parameter labels here?
| Option | What it means |
|---|---|
| Defer to game import | English only now; titles are mostly proper nouns; phrasebooks come with the game import decision. |
| 14 languages now | Copy the factory's text export and gap test from day one. |
**Answer: Defer to game import.**

### May the site remember anything in the browser beyond the URL?
| Option | What it means |
|---|---|
| Volume only | One localStorage key with the player volume (0..1); everything else in the URL. |
| Nothing | URL state only. |
| Volume + favourites | Also favourites and last-played piece. |
**Answer: Volume only.**

## High-level plan

**1. Repository foundation.** Set the repository up the way the factory is set
up: the same stack, scripts, `AGENTS.md`/`CLAUDE.md` with the factory's rules
where they apply (determinism, generated folders gitignored, docs owned per
subsystem, sources stored in git, headless verification), a `docs/` index, and
Vitest. Everything else depends on this.

**2. Score sources.** Write each piece as our own ABC transcription, one folder
per piece, with metadata: title, composer, year, set (classical, ragtime, early
jazz, railway), public-domain basis, and the sources consulted, kept in a
SOURCES file like the factory's `assets/<name>/SOURCES.md`. Proposed first
batch of twelve:

| Set | Pieces |
|---|---|
| Classical | Mozart Rondo alla Turca; Grieg In the Hall of the Mountain King; Offenbach Galop infernal; Strauss II Thunder and Lightning polka |
| Ragtime | Joplin The Entertainer; Maple Leaf Rag; Elite Syncopations |
| Early jazz | Handy St. Louis Blues; Tiger Rag; When the Saints Go Marching In |
| Railway | Casey Jones; Wabash Cannonball |

Reserves: Beethoven Fur Elise, Rossini William Tell finale, Darktown Strutters'
Ball, I've Been Working on the Railroad. Orchestral pieces are reduced to a
melody plus a harmony line per voice, which the ensembles then voice.

**3. Generator.** A Node-only TypeScript generator parses the ABC into a
neutral note model, applies the four arrangement parameters (ensemble/style,
tempo, length/repeats, transposition), adds each ensemble's generated
accompaniment (for example stride bass, oom-pah, a drum groove), and writes for
every piece the default arrangement and its parameter list: note data per
arrangement, the arranged score as ABC, and a catalog listing every piece. The
output is deterministic. Depends on 2 for real input; it can start on one piece.

**4. Synth and samples.** One shared WebAudio synth module that plays the note
data with a small sample set (piano, bass, brass/reed, drums; 1-3 MB, CC0 or
public domain, sources recorded). Exported next to the note data so the game
can reuse it unchanged. Depends on the note data format from 3.

**5. Catalog site.** A Solid + Vite site in the factory's look: app bar, the
list of pieces with search and set filter, a piece page with parameter pickers,
Play/Pause/Stop, progress, volume, and the arranged notation rendered by abcjs
with the current bar highlighted and click-to-seek. A mini player keeps playing
while browsing. State lives in the URL. Non-default parameter combinations are
arranged in the browser from the same generator code, if it can be shared
without Node imports, or are pre-generated otherwise. Depends on 3 and 4.

**6. Deploy.** An assets-only Cloudflare Worker on `music.railisland.com`,
deployed by GitHub Actions on push to master, plus a test workflow, as in the
factory.

**7. Evaluation.** Listen to the twelve pieces on the site and decide whether to
import into the game. The import is a later, separate change.

## Database and persistent storage

- **Score sources (git).** One folder per piece: the ABC transcription, a
  metadata record (id, title, composer, year, set, public-domain basis, default
  parameters) and a SOURCES file. Piece ids are permanent once published, since
  a future game may store them (a playlist setting), like the factory's model ids.
- **Instrument samples (git).** Short audio files per instrument with a SOURCES
  file (file, origin, author, licence). About 1-3 MB in total.
- **Export folder (generated, gitignored).** A catalog of pieces, and per piece
  and arrangement the note data and the arranged ABC, plus the synth module and
  samples. This is what the game would import later; it is rebuilt each build.
- **Browser localStorage (site).** One key holding the player volume, a number
  from 0 to 1. It is read on load and written on change. A missing or broken
  value falls back to a default. No migration.
- No database, no server-side storage.

## Architecture decisions

- **ABC as the source, note data as the product.** ABC is diffable and easy to
  write by hand; the game never parses ABC. It gets a simple timed note list, so
  the game side stays small. MusicXML and MIDI were rejected for reviewability
  and quality.
- **Synthesised playback, not rendered audio.** Kilobytes per piece instead of
  megabytes, the same sound in the site and the game, and arrangements that can
  change at runtime (tempo, ensemble). The cost: the sound quality depends on our
  synth and samples.
- **The arrangement is the generator's job.** Parameters work like the
  factory's design parameters, so one transcription yields several playable
  variants, and the notation shows the arrangement actually heard.
- **Separate repository and site.** The music deploys and is judged without
  touching the factory or the game.
- **English only until import.** Avoids translation work on a trial.

## Weaknesses and risks

- **Transcription accuracy.** Twelve pieces by hand (some long piano works) is
  the bulk of the work, and errors are easy to make. Mitigation: a validity
  test per piece (bar lengths add up, voices aligned), listening on the site,
  and SOURCES naming the public-domain edition checked against.
- **Copyright.** Compositions must be public domain worldwide or at least in the
  EU/US. Arrangements and recordings of them may not be. Mitigation: our own
  transcriptions only, recorded basis per piece, and dropping any piece whose
  status is unclear (e.g. Tiger Rag's authorship dispute; St. Louis Blues by
  death date + 70 years: Handy died 1958, so it is PD in the US but **not** in
  the EU until 2029). This needs checking per piece before shipping.
- **Synth sound may be too thin** for 3-minute listening. Mitigation: invest in
  the sample set and simple effects (reverb, swing feel). If it still fails, the
  "rendered audio" path stays open as a later addition.
- **ABC limits** for dense piano writing (cross-staff writing, ornaments).
  Mitigation: simplify where needed. Accepted for a game soundtrack.
- **Parameter explosion.** Four parameters across twelve pieces give many
  combinations. Mitigation: pre-generate defaults only and arrange the rest on
  demand. Tests sample combinations, as the factory does.
- **Browser autoplay rules.** Audio starts only after a user gesture. The site
  starts playback from a Play button; the game must do the same.
- **Open question:** the exact ensemble list and which accompaniment each one
  generates. This is settled during implementation and recorded in the docs.

## Out of scope

- Importing into rail-island-webapp, and the game's playlist logic.
- Seamless loops, jingles and event cues.
- Procedural composing of new music.
- Translations into the game's 14 languages.
- Rendered audio files (OGG/MP3).
- User accounts, uploads, favourites, or any server-side storage.
