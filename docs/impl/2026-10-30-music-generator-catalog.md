# Music generator and catalog

Spec: docs/specs/2026-10-30-music-generator-catalog.md
Date: 2026-10-30
Status: partially implemented
Area: new repository rail-island-music - lib/ (parser, arranger, ABC writer), synth/, samples/, scores/, generator/, src/ (site), deploy, docs

## What was done

The repository is set up the way the factory is (TypeScript strict, pnpm,
Vitest, Solid + Vite, an assets-only Cloudflare Worker, `docs/` with an index,
`AGENTS.md`/`CLAUDE.md`).

- **Score sources** (`scores/<id>/`): seven pieces as our own ABC
  transcriptions, the melody plus the harmony as chord symbols, with
  `piece.json` and `SOURCES.md`. Six are checked against public-domain Mutopia
  editions committed in the piece's folder: Rondo alla Turca, In the Hall of the
  Mountain King, Thunder and Lightning, The Entertainer, Maple Leaf Rag and
  Elite Syncopations. When the Saints Go Marching In is the traditional chorus,
  written without a file.
- **Parser** (`lib/abcParse.ts`): a strict ABC subset with voices and roles,
  parts, repeats and endings, ties, tuplets, broken rhythm, chord symbols and
  inline fields. It fails with the line number on anything unknown.
- **Arranger** (`lib/arrange.ts`, `lib/ensembles.ts`, `lib/params.ts`): the four
  parameters (ensemble x5, tempo x3, length x3, key x7) produce a deterministic
  `Performance`. It unrolls the form, transposes, generates bass, chords and
  drums for four grooves plus a harmony line, and folds every line into its
  instrument's range.
- **ABC writer** (`lib/abcWrite.ts`): writes the arrangement back as a
  multi-voice score with the repeats written out, so bar k of the notation is
  bar k of the sound.
- **Synth** (`synth/`): a WebAudio player with look-ahead scheduling.
  Instruments are sampled (piano, clarinet, trumpet, trombone, tuba, double
  bass, drums) or oscillators (chiptune). The 1.4 MB sample set is cut from
  VS Chamber Orchestra CE (CC0) by `generator/prepareSamples.ts`, which also
  corrects VSCO's octave naming. It can render offline.
- **Generator** (`pnpm build:music`): writes `export/`: `catalog.json`, the
  note data and ABC of every default arrangement, the source scores,
  `synth/synth.js` and the samples. It is deterministic: two builds were
  byte-identical.
- **Site** (`src/`): the factory-like list (search, set chips, table) and a
  piece page. The page has parameter pickers, Play/Pause/Stop, seek, a volume
  slider and the abcjs score, which highlights the bar being played and seeks
  when you click a bar. A mini player keeps playing while you browse. The state
  is in the URL, and the volume is the only localStorage key.
- **Deploy**: `wrangler.jsonc` for `music.railisland.com`, plus `deploy.yml` and
  `test.yml` copied from the factory.
- **Headless tools**: `generator/renderAudio.ts` (MP3/WAV through the real
  synth) and `generator/renderNotation.ts` (PNG through abcjs).

Checks: `pnpm typecheck` clean; `pnpm test` 66 tests passing in about 2 s;
`pnpm build` succeeds. Every piece x every ensemble x keys -3/+3 x short/long
(140 scores) renders in abcjs without error. A headless run of the built site
(list, piece page, Play, mini player) showed no console errors and the
highlight following the playback.

Work happened on the session's designated branch
`claude/nifty-brahmagupta-lzspq5` (the environment fixes the branch name).

## Follow-up changes

1. "Allows copyright to add 'Pochod gladiatoru'?" Copyright allows it: Fucik's
   Entry of the Gladiators (1897) is public domain, since Fucik died in 1916. It
   is not added yet. No reference edition is reachable from the build
   environment, and AGENTS.md forbids presenting an unchecked memory
   transcription as checked (see *What is missing*).
2. "Please, also render notes for me into this chat." Added
   `generator/renderNotation.ts`, which draws an arrangement's score to PNG with
   abcjs. The score images, with MP3s from `generator/renderAudio.ts`, are sent
   in the chat, and AGENTS.md makes that a rule for every music change.

## How to test

**Automated coverage.** No end-to-end browser test: the repository has no E2E
framework and the spec asks for none. `pnpm test` covers the parser, arranger,
writer (round trip), scores and URL state.

**Setup.** `pnpm install`, then `pnpm dev`, and open the printed localhost URL.
No account and no flags.

**Steps.**
1. On the list, check that seven pieces show with title, composer, year, set
   and length.
2. Type `joplin` in the search box: three ragtime pieces remain. Click the
   `Classical` chip: none remain. Click `All`, then clear the search.
3. Click `The Entertainer`. The page shows Solo piano, Normal, Full and
   Original, each marked "(default)", and a score.
4. Press `Play`. Sound starts within a second or two (the samples load first).
   The bar being played is drawn in orange and moves along the score, and the
   time counts up.
5. Click a bar on the second line of the score. Playback jumps there.
6. Change `Ensemble` to `Chiptune` while it plays. The music carries on at the
   same point with square-wave sounds, and the score now shows five staves.
7. Press `Pause`. The URL gains `t=`. Reload the page and press `Play`: it
   resumes near that time.
8. Press the back arrow. The mini player at the bottom shows The Entertainer
   still playing; its title opens the piece again.
9. Move the volume slider, then reload: the volume is kept.

**Also worth trying.**
- `Length: Short` gives a shorter piece without repeats. `Long` plays the form
  twice.
- `Key: +3` and `-3` change the key signature in the score. Every instrument
  still sounds natural (no extreme re-pitching).
- Mountain King speeds up section by section; the tempo marks in the score
  change with it.
- Open `?piece=nope`: the list shows (the unknown piece is ignored).
  `?piece=maple-leaf-rag&ensemble=bogus` uses the default ensemble.

## What is missing

- **Five of the twelve proposed pieces.** Built: Rondo alla Turca, Mountain
  King, Thunder and Lightning, The Entertainer, Maple Leaf Rag, Elite
  Syncopations and When the Saints. Not built:
  - Offenbach's Galop infernal, Casey Jones and the other early-jazz and
    railway songs (Bill Bailey, Down by the Riverside, I've Been Working on the
    Railroad).
  - Fucik's Entry of the Gladiators, which the user asked for during the work.

  The build environment reaches GitHub's raw files (Mutopia Project, VSCO)
  but not IMSLP, Wikipedia, abcnotation.com or other score sites, and Mutopia
  has none of these pieces. A transcription from memory would be unverified,
  so they are left out rather than published with possibly wrong notes. The
  `railway` set is therefore empty and the early-jazz set has one piece.
- **St. Louis Blues and Tiger Rag**, proposed in the spec, are excluded on
  purpose under the spec's own risk rule. St. Louis Blues is public domain in
  the US but not in the EU until 2029; Tiger Rag's authorship is disputed
  (LaRocca's heirs, EU 2032).
- **Wabash Cannonball** is excluded too: the melody everyone knows is the
  Carter Family's 1929 version (A. P. Carter died in 1960).

## Known problems

- The transcriptions are reductions: the melody and chord symbols, without the
  original left hands or inner voices. In the piano ensemble the generated
  oom-pah stands in for Joplin's and Mozart's left hands.
- Some octave placements in Maple Leaf Rag follow LilyPond relative notation as
  read by hand. A phrase may sit an octave from the print.
- Thunder and Lightning's harmony is reconstructed from the right hand's chords
  and is simpler than Strauss's. The introduction and the second half of the
  trio are left out.
- Mountain King's whole form lasts under 2 minutes, so its default length is
  `long`. The accelerando then plays twice.
- The drum staff in the score has no name: abcjs drops the voice name when the
  first line carries the percussion key field the staff needs.
- Samples are MP3. Browsers strip the encoder delay using the LAME header, but
  an old decoder that ignores it would start every note about 25 ms late.
- The sustained instruments loop their sample's middle without a crossfade.
  Notes held longer than about 2.5 s can click faintly.
- Arranging a non-default combination runs in the browser (a few ms). The
  JavaScript bundle is 580 kB (180 kB gzipped), mostly abcjs.

## Recommended follow-ups

- Supply reference scores (a PDF or photos in `scores/<id>/`) for Entry of the
  Gladiators, Galop infernal and the songs, so they can be transcribed and
  checked.
- Write the real left-hand parts of the rags as `role=bass` voices for the
  piano ensemble. This is the biggest step in authenticity.
- Add per-section variety to repeated choruses (an ensemble lead change, or a
  drum fill at part ends) so the longer songs do not repeat identically.
- Crossfade the sample loops, and add a second velocity layer for the piano.
- When the game import is decided, export the arranger bundle too, so the game
  can offer the parameters, and add the 14-language text.

## Changelog

- New site music.railisland.com lists the music made for Rail Island and plays
  it in the browser.
- Seven public-domain pieces: Rondo alla Turca, In the Hall of the Mountain
  King, Thunder and Lightning, The Entertainer, Maple Leaf Rag, Elite
  Syncopations and When the Saints Go Marching In.
- Every piece plays as solo piano, ragtime band, brass band, jazz band or
  chiptune, at three tempos, three lengths and seven keys.
- The score of the chosen arrangement is shown, follows the playback, and
  starts playback from any clicked bar.
- A mini player keeps the music going while you browse; the volume is
  remembered.
