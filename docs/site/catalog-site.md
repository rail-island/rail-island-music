# The catalog site (sound.railisland.com)

**Covers** - the Solid site that lists and plays every sound Rail Island plays: one sortable table with each sound's cost metrics, its search, category and kind filters; a sound's page with its spectrogram; stopping what a page plays when it is left; the URL state.
**Code** - `index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/catalogList.ts`, `src/EffectPage.tsx`, `src/audition.ts`, `src/query.ts`, `src/site.css`, `src/favicon.svg`, `test/query.test.ts`, `test/catalogList.test.ts`, `test/audition.test.ts`
**See also** - [../sounds/sounds.md](../sounds/sounds.md), [../guide/deploy.md](../guide/deploy.md)

The site follows the factory's catalog in look (the same dark palette, app bar
and table), in shape (one filterable list, a detail per item) and in stack
(Solid, Vite). English only.

## Data

The designs themselves (`sounds/`), bundled into the site from source, so a
page plays the very code the game imports. The build also copies
`export/sounds/` into `dist/`, so the deployed site serves the bundle the game
imports. The one thing fetched is that export's `sounds/sounds.meta.json`, for
the metrics the build measured ([../sounds/sounds.md](../sounds/sounds.md#metrics)):
until it arrives, or if it is missing, the metric cells show a dash.

## The list

Every sound design in **one table**, the way the factory lists its models
(`src/catalogList.ts`):
- **Search box** - every word must match the title, id, description, category
  or kind (`filterSounds`).
- **Kind chips** - All, One-shots, Loops.
- **Category chips** - All and each category of `CATEGORIES`
  ([../sounds/sounds.md](../sounds/sounds.md#categories)), each with the number
  of sounds it holds (`countByCategory`) and its description as a tooltip. A
  second click on the chosen chip clears it.
- **Columns** (`COLUMNS`) - title (with the id under it), category, kind, JS
  size, nodes at start, nodes per second, length in seconds and the number of
  parameters. The last three are hidden on a phone. A row's tooltip is its
  description.
- **Sorting** (`sortSounds`) - a header click sorts on its column; a second
  click flips the direction. Text starts ascending, numbers descending. The
  default is category, in the order of `CATEGORIES`, which reads like the old
  grouped list. A missing value (a loop's length, metrics not loaded) sorts
  last in both directions, and ties keep the order of `SOUNDS`.

A row opens the sound's page, and the app bar's back arrow returns to the list
with its filters.

## A sound's page (`EffectPage`)

- **Facts** - its category, one-shot or loop, its id and its description.
- **Controls** - a slider for each number parameter and a picker for each
  choice; Play (Start/Stop for a loop); Defaults. A running loop takes a change
  at once.
- **Spectrogram** - a live, scrolling spectrogram of what it plays: time left
  to right, 0-8 kHz bottom to top, louder brighter.
  - It is drawn from an analyser at the end of the page's own audio chain, only
    while something sounds (a loop while it runs, a one-shot until it ends).
  - The last picture stays.

**Leaving stops it.** What the page plays is held by an audition
(`src/audition.ts`): the running loop, ticked every 50 ms 0.2 s ahead, and every
one-shot still ringing. When the page is left - the back arrow, the browser's
Back, another sound opened from the URL - the page is unmounted (the detail is
a keyed `<Show>`, so another sound is another page) and `stopAll` fades out the
loop and every one-shot. A tolling bell or a horn's call no longer rings on
over the list.

## URL state

Everything is in the query string (`src/query.ts`):
- the list: `q`, `cat` (a category id), `kind` (`oneShot`, `loop`), `sort` (a
  column key; absent for category) and `dir` (absent for the column's own
  direction);
- the open sound: `sound=<id>`.

Unknown values are dropped. Links from the time the site also held music land on
the list: `set=<category>` is read as `cat`, while `kind=effect`, `?sounds`, a
`piece` or a `jingle` are ignored. Back walks all of it. Nothing is stored.
