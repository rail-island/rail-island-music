# Jingles and a unified catalog

Status: agreed
Date: 2026-11-01
Area: rail-island-music (scores, generator, export, catalog site); rail-island-webapp (in-game top bar, mobile portrait)

## Context of the change
`rail-island-music` holds two kinds of things today:
- **Pieces**: public-domain scores in `scores/<id>/` (`piece.json` + ABC). The
  arranger (`lib/arrange.ts`) arranges them by ensemble, tempo, length and key.
  The site lists them in a table (`src/App.tsx`); a piece page plays the
  arrangement and draws its score with abcjs (`src/PiecePage.tsx`).
- **Sound effects**: synthesized Web Audio designs in `sounds/`, which the game
  imports with `pnpm import:sounds`. The site shows them on a separate `?sounds`
  page, as cards with parameter sliders (`src/SoundsPage.tsx`).

The user recorded five short piano motifs as MIDI (`Recording_2026-11-01_11_53`,
`_55`, `_56`, `_57`, `_58`). They are live-played, about 1-6 s long with 17-78
notes each, recorded at a fixed 60 bpm with millisecond timing (no grid). They
carry zero-length touches, stray keys and uneven velocity; the left hand plays
bass octaves and the right a melody. They are meant to become city jingles in
the game later. There is no "jingle" kind yet.

The site has two separate surfaces (the pieces table and the sounds page),
unlike the factory site's single filterable catalog.

In the game, the top bar's speaker (mute) button
(`rail-island-webapp/src/ui/GameTopBar.tsx`) shows on every layout, including a
phone held upright, where the bar is crowded. The game already has a
mobile-portrait breakpoint, `(orientation: portrait) and (max-width: 820px)`, used
by the camera column, the minimap and the vehicle boards. The Settings board also
has the same mute switch.

## User request
1. The mute button is fine, but do not show it in the game on a mobile-portrait
   layout. Show it in every other case.
2. I recorded a few MIDI recordings. Tidy them up, and create a new kind of
   sound in the music repo: a jingle. Jingles will be used as city jingles (do
   not do that yet).
3. Tidy up the music web interface. All sounds go in one filterable list, the
   way the factory has it. Clicking a sound shows its detail and lets it be
   played, and shows the notes where they exist, as now. Jingles are another
   kind.

## Decisions
### In what form should the jingles be stored in the music repo (the source of truth)?
| Option | What it means |
|---|---|
| Tidied ABC like the pieces (Recommended) | Each jingle is a folder in scores/ with a piece.json (kind jingle) and a hand-tidied ABC score transcribed from the MIDI. Reuses the parser, the arranger (ensemble, key, tempo), the notation and the synth. The MIDI stays in git as the source (SOURCES.md). |
| MIDI as source + automatic cleaning | The generator quantizes and cleans the MIDI on every build. Less hand work, but the result depends on heuristics and single notes are harder to tune. |
| Hand-tidied note data (JSON) | The note format directly, without ABC. Simple, but no arranger, no parameters, and the notes would have to be drawn separately. |
**Answer: Tidied ABC like the pieces.**

### What exactly does "tidy up" the recordings mean?
| Option | What it means |
|---|---|
| Quantize + fix mistakes (Recommended) | Snap to a rhythmic grid and bars, pick a tempo and key, drop slips and zero-length touches, even out note lengths and chords. The musical idea and the melody stay the user's. |
| Quantize timing only | Keep every note as it is, only straighten the rhythm. More faithful, but the slips stay audible. |
| Use as motifs and rewrite cleanly | Take the melody as an idea and write the jingle again (harmony, cadence, opening and closing chord). Sounds best, but strays furthest from the recording. |
**Answer: "Varianta 1 + varianta 3. V GUI music budou obe, budu se moct mezi nima prepinat a rozhodnout, co dal"** - both the quantized-and-fixed version and the clean rewrite exist for every recording. The site lets the user switch between them, to decide which way to go.

### Where should the specification live, given item 1 touches the game and items 2-3 the music repo?
| Option | What it means |
|---|---|
| One spec in the music repo (Recommended) | docs/specs in rail-island-music; item 1 (mute on mobile portrait) is a small separate part of it for the webapp. |
| Two specs | A small one in the webapp (mute) and the main one in the music repo. |
| One spec in the webapp | docs/specs in rail-island-webapp, the music repo an affected area. |
**Answer: One spec in the music repo.**

### How should the two versions of a jingle (tidied and rewritten) be stored and switched?
| Option | What it means |
|---|---|
| One jingle, a Version parameter (Recommended) | One id per recording (e.g. jingle-1153), two ABC scores (tidy, rewrite) and a "Version" parameter next to ensemble/tempo/key. The detail switches it like any other parameter; once decided, one version is simply deleted. |
| Two separate jingles | Two ids per recording (-tidy, -rewrite), both rows in the list. Simple, but the list doubles and comparing means clicking back and forth. |
**Answer: One jingle, a Version parameter.**

### Which arrangement parameters should jingles offer?
| Option | What it means |
|---|---|
| Ensemble, tempo, key (Recommended) | As pieces, but without "Length" (a jingle is neither shortened nor repeated). Useful for cities later: each city can have its own ensemble or key. |
| Ensemble only | Tempo and key fixed by the score. Fewer combinations. |
| None, piano only | The jingle plays as written. |
**Answer: Ensemble, tempo, key.**

### What should the unified list on the music site look like (pieces, jingles, sound effects)?
| Option | What it means |
|---|---|
| Table + kind chips and search (Recommended) | One table like the factory's: a search box, Kind chips (Piece / Jingle / Sound effect) and below them chips of subgroups (piece sets, effect categories: trains, ships, water, editor). Columns: title, kind, group, length. A click opens the detail. |
| Cards with a preview | A grid of cards with title, kind and a Play button right in the list. Quick listening, but less clear and unlike the factory. |
| Table with Play in the row | As the first, plus a play button in every row for quick listening without opening the detail. |
**Answer: Table + kind chips and search.**

### What should a sound effect's detail show (horn, bell, water)?
| Option | What it means |
|---|---|
| Parameter sliders + Play, no notes (Recommended) | What the card on ?sounds shows today: description, id, sliders/pickers, Play or Start/Stop, Defaults. Effects have no notes. The ?sounds page goes away (its URL lands on the list filtered to effects). |
| Sliders + playback + spectrogram | Also a live spectrogram/oscilloscope while playing, useful for tuning. More work. |
**Answer: Sliders + playback + spectrogram.**

### With the top bar's mute button hidden on mobile portrait, how is sound controlled there?
| Option | What it means |
|---|---|
| Through Settings only (Recommended) | Nothing in the top bar on a phone held upright; the Mute/Unmute button stays on the Settings board (three dots -> Settings). Uses the existing breakpoint (orientation: portrait) and (max-width: 820px). |
| Move it into the three-dots menu | On mobile portrait a "Mute sounds" entry appears in the main menu instead of the button. |
**Answer: Through Settings only.**

### What should the jingles be called (ids are permanent once the game uses them)?
| Option | What it means |
|---|---|
| Neutral numbers, rename later (Recommended) | jingle-1 to jingle-5 (in recording order), titles "Jingle 1..5". Until the game uses them they can be renamed freely. |
| By recording | jingle-1153, jingle-1155 ... from the time in the file name. A clear link to the source, but hard to remember. |
| I name them myself | Names given in "Other". |
**Answer: Neutral numbers, rename later.**

### Should the spectrogram show for pieces and jingles too, or only for sound effects?
| Option | What it means |
|---|---|
| Effects only (Recommended) | Pieces and jingles have notes that follow the playback; a spectrogram adds nothing there. |
| Every kind | One detail layout: a spectrogram above the notes for pieces and jingles too. |
**Answer: Effects only.**

### Should the jingles already be exported for a future import into the game?
| Option | What it means |
|---|---|
| Yes, like pieces (Recommended) | In catalog.json with kind "jingle" and note data of the default arrangement in music/<id>.json, the pieces' format. The game does not read them yet; a later import for cities is a small step. |
| Only on the site for now | The export does not change; jingles live only on the site until a version is chosen. |
**Answer: Only on the site for now.** The site still needs their scores, so they reach it through a site-only part of what the build writes, which is not part of what the game would import.

## High-level plan
1. **Mute on mobile portrait (webapp).** The top bar's speaker button is hidden on
   the game's existing mobile-portrait breakpoint and shown everywhere else. The
   Settings board's Mute/Unmute stays the control there. This is independent of
   everything below and can land first.
2. **Transcribe the recordings.** Each of the five MIDI recordings becomes a
   jingle (`jingle-1` .. `jingle-5`, in recording order) with two scores:
   - a **tidy** version: quantized to a grid and bars, tempo and key chosen, slips
     and zero-length touches removed, lengths and chords evened out, the melody
     kept;
   - a **rewrite**: the melody as the idea, written again cleanly, with harmony,
     cadence and an opening and closing chord.

   The MIDI files are committed as sources and listed in each jingle's
   `SOURCES.md`, saying what each version was made from.
3. **The jingle kind.** A jingle is a score folder like a piece, marked as a
   jingle, with its own parameters:
   - **Version**: tidy or rewrite;
   - **Ensemble, tempo, key**: as for pieces;
   - **no Length**: a jingle is neither shortened nor repeated.

   The arranger, the synth and the score drawing serve it as they serve pieces.
   Jingles are not exported for the game. The site reads them from a site-only
   part of the build output.
4. **One catalog on the site.**
   - **The list.** Pieces, jingles and sound effects go in one table, the way the
     factory site lists everything. It has a search box, Kind chips (Piece /
     Jingle / Sound effect), chips for the subgroups of the chosen kind (the piece
     sets; the effect categories: trains, ships, water, editor), and columns for
     title, kind, group and length.
   - **The detail.** A row opens the detail of its kind:
     - a piece or a jingle plays with its parameters and shows its score
       following the playback, as a piece page does today;
     - a sound effect shows its parameter sliders, Play or Start/Stop, Defaults,
       and a live spectrogram while it plays.
   - **The URL.** The separate `?sounds` page goes away, and its URL lands on the
     list filtered to sound effects. The view stays in the query string, so links
     and the back button keep working.
   - Steps 2 and 3 feed the list's jingle rows; step 4 can start with pieces and
     effects.
5. **Docs and tests.**
   - Docs: the music repo's scores, arrangement, export, sounds and site
     documents gain the jingle kind and the unified catalog. The webapp's
     top-bar and settings docs note the mobile-portrait rule.
   - Tests: the jingles' scores parse and arrange in both versions; the list
     filters by kind, group and search; the URL state round-trips, including the
     old `?sounds`; the top bar hides the button on that breakpoint.

## Database and persistent storage
Nothing new is stored in a database, R2 or browser storage. The new committed
files are:
- per jingle, a score folder holding its metadata, two ABC scores (tidy and
  rewrite) and `SOURCES.md`;
- the five MIDI recordings, as sources.

The build writes the jingles to the gitignored site output only. The game-facing
export (`catalog.json`, `music/`, `sounds/`) is unchanged, apart from an additive
category on each sound design (below).

## Architecture decisions
- **Jingles are scores, not a new engine.** Writing them as ABC reuses the
  parser, the arranger, the synth and the notation, and keeps one way to tune a
  note. Cleaning MIDI automatically at build time was rejected: single notes
  would be at the mercy of heuristics.
- **Both versions behind one Version parameter.** Comparing is one switch on the
  same page, and dropping the losing version later deletes one file without
  changing the id the game may one day store.
- **Not exported until a version is chosen.** The game-facing export stays what
  the game can rely on. Jingles join it when the city jingles are built.
- **One list over three kinds.** The site models an entry as a kind plus a
  group, so the list, the chips and the search treat pieces, jingles and effects
  alike. Each kind keeps its own detail.
- **Effects need a category.** To group them in the list, each sound design gains
  a category (trains, ships, water, editor). This adds a field to the sounds
  contract. The game ignores it, so no format bump and no game change are needed.
- **The mute rule is CSS on the existing breakpoint**, not a new layout signal,
  so it follows every other mobile-portrait rule of the game.

## Weaknesses and risks
- **Transcription is judgement.** The recordings are loose and short, so the
  tidy version still involves choices about grid, tempo and key, and the rewrite
  is the transcriber's composition on the user's idea. Mitigation: both versions
  are on the site side by side, and the MIDI stays in git.
- **Ensembles on a 2-5 s jingle.** The arranger's grooves, generated bass and
  drums were made for whole pieces. On a very short jingle they may sound busy or
  cut off. Open question: some ensembles may need a jingle-specific treatment,
  found by listening.
- **Spectrogram cost.** A live analyser and canvas while an effect plays is
  cheap, but must stop with playback and not run on the list.
- **The `?sounds` link changes.** Anyone with the old link lands on the filtered
  list rather than the cards. That is intended, but it is a visible change.
- **Hidden mute on phones.** A phone player upright has to open Settings to
  mute; the top bar has no room. Accepted.

## Out of scope
- Using jingles in the game (city jingles), and exporting them for the game.
- Choosing between the tidy and rewrite versions; the user decides after
  listening.
- Final names for the jingles.
- A spectrogram for pieces and jingles.
- Any change to the existing pieces, the arranger's ensembles or the sound designs
  themselves, beyond the effect category.
