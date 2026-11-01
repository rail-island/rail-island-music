# The catalog site (music.railisland.com)

**Covers** - the Solid site that lists and plays everything Rail Island plays: the one filterable list of pieces, jingles and sound effects; the score page of a piece or a jingle; the sound effect page with its spectrogram; the mini player; the URL state; and the one stored setting.
**Code** - `index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/catalogList.ts`, `src/ScorePage.tsx`, `src/EffectPage.tsx`, `src/ScoreView.tsx`, `src/MiniPlayer.tsx`, `src/music.ts`, `src/query.ts`, `src/music.css`, `src/favicon.svg`, `test/query.test.ts`, `test/catalogList.test.ts`
**See also** - [../music/export.md](../music/export.md), [../music/jingles.md](../music/jingles.md), [../sounds/sounds.md](../sounds/sounds.md), [../music/synth.md](../music/synth.md), [../guide/deploy.md](../guide/deploy.md)

The site follows the factory's catalog in look (the same dark palette, app bar
and table), in shape (one filterable list, a detail per item) and in stack
(Solid, Vite). English only.

## Data

- **Pieces** - `App.tsx` fetches `/catalog.json` once; a missing catalog says to
  run `pnpm build:music`. A piece's page fetches `/scores/<id>.abc` and arranges
  it in the browser with `lib/`, the generator's own code, for the chosen
  parameters, then writes the arranged ABC.
- **Jingles** - fetched from `/site/jingles.json`, the build's site-only copy
  ([../music/jingles.md](../music/jingles.md)). A jingle's page fetches
  `/site/jingles/<id>/score.abc`. If the file is missing, the site simply
  shows no jingles.
- **Sound effects** - the designs themselves (`sounds/`), bundled into the site
  from source, so the page plays the very code the game imports.
- **Samples** load from `/samples/` the first time something plays.

## The list

One table of every piece, jingle and sound effect (`src/catalogList.ts`
`buildRows`). Every item is a row of the same shape: a kind and a group.
- **Search box** - every word must match the title, composer, kind, group, or
  extras (year, key, a jingle's source, an effect's id and description).
- **Kind chips** - All, Pieces, Jingles, Sound effects.
- **Group chips** - for the chosen kind, when it has more than one group: the
  piece sets; the effect categories Trains, Ships, Water, Editor (`groupsOf`).
- **Columns** - title, by (composer; for an effect, One-shot or Loop; hidden
  on a phone), kind, group, and the default arrangement's length (`-` for an
  effect).

A row opens the item's page, and the app bar's back arrow returns to the list
with its filters.

## A piece or a jingle (`ScorePage`)

- the facts: composer, year, group, key and meter;
- a picker for each parameter, defaults marked: a piece's four (ensemble, tempo,
  length, key), a jingle's three (ensemble, tempo, key). A change
  re-arranges, and while it plays it carries on in the new arrangement at the
  same point;
- Play/Pause, Stop, a progress slider (seeks), the time, and a volume slider;
- the arranged score, drawn by abcjs on a light sheet. Bars are numbered in
  reading order from the first voice's line and measure classes, so the bar
  under the playback is highlighted in every voice and scrolled into view, and
  a click on a note or rest of a bar seeks there;
- a closing line: why a piece is public domain, or what a jingle was
  transcribed from.

## A sound effect (`EffectPage`)

- **Facts** - its category, one-shot or loop, its id and its description.
- **Controls** - a slider for each number parameter and a picker for each
  choice; Play (Start/Stop for a loop); Defaults. A running loop takes a change
  at once.
- **Spectrogram** - a live, scrolling spectrogram of what it plays: time left
  to right, 0-8 kHz bottom to top, louder brighter.
  - It is drawn from an analyser at the end of the page's own audio chain, only
    while something sounds (a loop while it runs, a one-shot until it ends).
  - The last picture stays.

The old Sounds page (`?sounds`) is gone. Its link lands on the list filtered to
sound effects.

## The mini player

While a piece or a jingle plays and another page is shown, a bar at the bottom
keeps its title, Play/Pause and progress; its title opens it again. There is one
player for the whole site (`src/music.ts`).

## URL state and storage

Everything is in the query string (`src/query.ts`):
- the list: `q`, `kind` (`piece`, `jingle`, `effect`) and `set` (the group
  chip);
- the open item: `piece=<id>`, `jingle=<id>` or `sound=<id>`;
- a piece's or a jingle's parameter names, with unknown values dropped;
- `t`, the position in seconds, written when playback pauses;
- `?sounds` parses as `kind=effect`.

Back walks all of it.

The only stored setting is the player volume: one localStorage key,
`rail-island-music.volume`, a number from 0 to 1, read on load and written on
change; a missing, broken or blocked value falls back to 0.8.
