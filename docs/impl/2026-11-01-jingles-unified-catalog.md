# Jingles and a unified catalog

Spec: docs/specs/2026-11-01-jingles-unified-catalog.md
Date: 2026-11-01
Status: implemented
Area: rail-island-music (jingles, lib, generator, site, sound designs); rail-island-webapp (top bar, sea surf, db/sounds)

## What was done
- **Jingles** (`jingles/jingle-1` .. `jingle-5`, docs/music/jingles.md).
  - **The transcriptions.** The five MIDI recordings were read note by note
    (onsets, velocities, pedal) and written twice:
    - `tidy.abc`: quantized to eighths, stray touches dropped, rushed bars
      evened out;
    - `rewrite.abc`: the motif written again with a moving harmony, a cadence
      and a closing chord.

    Each jingle folder also holds `recording.mid`, `jingle.json` and
    `SOURCES.md`.
  - **The code.** `lib/jingles.ts` defines the kind and its parameters:
    Version, then a piece's ensemble, tempo and key, with no Length.
    `jingleAsPiece` feeds the arranger. `generator/jingles.ts` loads and checks
    the jingles and writes them for the site only, to `export/site/jingles.json`
    and `export/site/jingles/<id>/<version>.abc`. The game-facing export is
    unchanged.
  - **The render tools.** `renderAudio` and `renderNotation` take a jingle id
    (`generator/arrangeById.ts`).
- **A spelling fix found on the way.** `lib/theory.ts` `spellPitch` spelt a note
  the signature alters, played plain, as the next letter raised: C natural in D
  major came out as B#, and a "D7/C" chord symbol as "D7/B#". It is now written
  with a natural. A regression test is in `test/theory.test.ts`. This changes
  the arranged ABC of any piece that has such a note.
- **One catalog on the site** (docs/site/catalog-site.md).
  - **The list.** `src/catalogList.ts` turns pieces, jingles and sound effects
    into rows of one shape. The list has a search box, Kind chips, and group
    chips for the chosen kind (piece sets; effect categories).
  - **The pages.** `src/ScorePage.tsx` (formerly the piece page) serves pieces
    and jingles; a jingle's Version is a parameter picker. `src/EffectPage.tsx`
    (formerly the `?sounds` cards) adds a live 0-8 kHz spectrogram.
  - **The URL.** `src/query.ts` keeps the list in the URL (`kind`, `set`) and
    the open item (`piece` / `jingle` / `sound`). `?sounds` lands on the list
    filtered to sound effects.
- **Sound categories.** Every design has a `category` (trains, ships, water,
  editor) in the contract and in `sounds.meta.json`. The field is additive, so
  `SOUNDS_FORMAT` is unchanged.
- **Sea surf.** `sea-surf` (`sounds/designs/water.ts`) is the sea's steady
  wash, slowly swelling and settling, with no single waves (see *Follow-up
  changes* 1).
  In the game:
  - **Sources.** `WaterFeatures` groups each water tile's sea shore (sea cells
    with dry land beside them) into one source at its middle, as strong as the
    shore is long (`surfSoundOf`).
  - **Playing it.** The director plays the nearest 2 in view on voices of their
    own (`MAX_SURF_VOICES`), as ambient loops that keep playing while paused.
    Lakes and rivers make none.
  - **The import.** `pnpm import:sounds` was run: `db/sounds` now has 11
    designs.
- **Mute on mobile portrait (webapp).** The top bar's speaker button carries
  `topbar__iconbtn--sound`, hidden on the game's mobile-portrait breakpoint
  `(orientation: portrait) and (max-width: 820px)`. The Settings board's
  Mute/Unmute is the control there.
- **Docs**:
  - music repo: `docs/music/jingles.md` (new), `docs/site/catalog-site.md`
    (rewritten), `docs/sounds/sounds.md`, `docs/music/export.md`,
    `docs/guide/setup-and-build.md`, `docs/README.md`, `AGENTS.md`;
  - webapp: `docs/gameplay/sounds.md`, `docs/tooling/sound-import.md`,
    `docs/architecture/settings.md`, `CLAUDE.md`.
- **Checks.**
  - Music repo: `pnpm typecheck` passes, `pnpm test` passes (10 files, 103
    tests, about 3.5 s), and `pnpm build` passes.
  - Webapp: `pnpm typecheck` passes, `pnpm test` passes (634 files, 8465
    tests), and `pnpm build` passes.

## Follow-up changes
1. **The surf without waves: only the sea's wash.** The uneven waves (a rush,
   a break and shingle every 6-10 s) are gone. `sea-surf` is now one noise
   source: a low rush and a hiss whose filter and level drift every 0.7 s,
   seeded. Its test checks that nothing starts after the loop does. The game
   re-imported it.

## How to test
**Automated coverage.** None end-to-end: neither repository has an E2E framework,
and both ask for headless checks only. The unit suites cover the logic:
- music repo: `test/jingles.test.ts`, `test/catalogList.test.ts`,
  `test/query.test.ts`, `test/sounds.test.ts` (surf waves, categories),
  `test/theory.test.ts` (spelling);
- webapp: `test/soundTriggers.test.ts` (`surfSoundOf`),
  `test/soundDirector.test.ts` (surf voices), `test/soundDesigns.test.ts`,
  `test/soundSettings.test.ts` (mobile-portrait rule).

**Setup.**
- Music site: `pnpm dev` in `rail-island-music`, then open the printed URL.
- Game: `pnpm dev` in `rail-island-webapp`, signed in, with an island that has a
  sea coast.

**Steps.**
1. Music site: the list shows pieces, jingles and sound effects in one table.
   Click **Jingles**: only `Jingle 1`..`Jingle 5` remain, and no group chips
   appear.
2. Click **Sound effects**: group chips Trains, Ships, Water, Editor appear.
   Click **Water**: rapids, waterfall, spring fountain and sea surf remain.
3. Type `joplin` in the search with **All**: only Joplin's pieces remain.
4. Open **Jingle 1**: the facts read "Rail Island, 2026, Jingle, D, 4/4", and
   the pickers are Version, Ensemble, Tempo, Key (no Length). Press **Play**:
   the tidy version plays and the score follows. Switch **Version** to
   **Rewritten**: it carries on in the rewrite. In bar 3 the note and the chord
   read C natural and "D7/C", not B#.
5. Back, then open **Sea surf** under Sound effects. Press **Start**: a steady
   wash of the sea, slowly swelling, with no single waves, and the spectrogram
   scrolls. Move **Strength**: it grows fuller. Press **Stop**: the spectrogram
   stops scrolling and keeps its picture.
6. Open `/?sounds` directly: the list opens filtered to Sound effects.
7. Game on a desktop: the speaker button is in the top bar. In the browser's
   device toolbar, pick a phone in portrait: the button is gone, and three dots,
   then **Settings**, still has **Mute**. Turn the phone to landscape: the
   button is back.
8. Game: zoom in on a sea shore. The sea washes steadily. Turn the camera away
   from the sea and it stops. A river's rapids nearby still sound alongside
   them.

**Also worth trying.**
- Play a jingle in Brass band or Chiptune and in another key: it stays within
  the instruments' samples.
- Pause the game near the shore: the surf plays on, as the water does.
- Zoom out over the whole island: at most two shore sources sound, and quietly.

## What is missing
Nothing - the spec is implemented in full.

## Known problems
- The transcriptions are judgement: the tidy versions quantize live, rushed
  playing, and the rewrites are a transcriber's composition on the user's motif.
  Both are first takes, to be judged by ear.
- Short jingles in the band ensembles get the arranger's generated chords and
  drums, which were made for whole pieces. They may sound busy on a 2-6 s
  jingle (the spec's open question).
- `jingle-3`'s tidy version is one bar (about 2 s): the recording is that short.
- The surf's level and voice count were set by reasoning, not by ear. A coast is nearly always in view.
- The spectrogram reads the page's own audio chain, so it shows a sound effect
  only, never a playing piece.
- The spelling fix changes the arranged ABC of existing pieces that have a
  natural on a sharped letter. The audio is unchanged.

## Recommended follow-ups
- Listen to both versions of every jingle on the site, keep one each, and delete
  the other score and the Version parameter.
- Tune the surf and the water levels by ear in the game.
- Give jingles a lighter accompaniment in the band ensembles (no drums, chords
  only on the downbeats) if the full grooves sound busy.
- Export the chosen jingles for the game when the city jingles are built.

## Changelog
- The island's sea shores now wash softly when the camera looks at them.
- On a phone held upright, the mute switch moves out of the top bar into
  Settings.
- The music site lists all music and sounds in one searchable list, plays
  jingles, and shows a live spectrogram for sound effects.
