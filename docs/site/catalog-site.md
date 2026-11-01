# The catalog site (music.railisland.com)

**Covers** - the Solid site that lists and plays every piece: the list, the piece page with parameters, player and score, the mini player, the URL state and the one stored setting.
**Code** - `index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/PiecePage.tsx`, `src/ScoreView.tsx`, `src/MiniPlayer.tsx`, `src/SoundsSection.tsx`, `src/music.ts`, `src/query.ts`, `src/music.css`, `src/favicon.svg`, `test/query.test.ts`
**See also** - [../music/export.md](../music/export.md), [../music/synth.md](../music/synth.md), [../guide/deploy.md](../guide/deploy.md)

The site follows the factory's catalog in look (the same dark palette, app bar
and table) and stack (Solid, Vite). English only.

## Data

`App.tsx` fetches `/catalog.json` once; a missing catalog says to run
`pnpm build:music`. A piece page fetches `/scores/<id>.abc` and arranges it in
the browser with `lib/` - the generator's own code - for the chosen
parameters, then writes the arranged ABC. Samples load from `/samples/` the
first time a piece plays.

## The list

A search box (title, composer, set, year; every word must match), chips for the
four sets, and a table: title, composer, year (hidden on a phone), set and the
default arrangement's length. A row opens the piece.

Under the table, **Train sounds** lists every sound effect with a button per
variant (`src/SoundsSection.tsx`): a click computes the sound in the browser
(the first time; kept after) and plays it at the stored volume, a second click
stops it ([../music/sounds.md](../music/sounds.md)).

## The piece page

- the facts: composer, year, set, key and meter;
- four pickers for the parameters, the piece's defaults marked; a change
  re-arranges, and while the piece plays it carries on in the new arrangement at
  the same point of the piece;
- Play/Pause, Stop, a progress slider (seeks), the time, and a volume slider;
- the arranged score, drawn by abcjs on a light sheet. Bars are numbered in
  reading order from the first voice's line and measure classes, so the bar
  under the playback is highlighted in every voice and scrolled into view, and
  a click on a note or rest of a bar seeks there.

## The mini player

While a piece plays and another page is shown, a bar at the bottom keeps its
title, Play/Pause and progress; its title opens the piece again. There is one
player for the whole site (`src/music.ts`).

## URL state and storage

Everything is in the query string (`src/query.ts`): `q` and `set` for the list,
`piece`, the four parameter names, and `t` - the position in seconds, written
when playback pauses. Unknown parameter values are dropped. Back walks it.

The only stored setting is the player volume: one localStorage key,
`rail-island-music.volume`, a number from 0 to 1, read on load and written on
change; a missing, broken or blocked value falls back to 0.8.
