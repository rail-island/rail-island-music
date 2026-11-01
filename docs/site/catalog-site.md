# The catalog site (sound.railisland.com)

**Covers** - the Solid site that lists and plays every sound Rail Island plays: the list grouped by category with its search, category and kind filters; a sound's page with its spectrogram; stopping what a page plays when it is left; the URL state.
**Code** - `index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/catalogList.ts`, `src/EffectPage.tsx`, `src/audition.ts`, `src/query.ts`, `src/site.css`, `src/favicon.svg`, `test/query.test.ts`, `test/catalogList.test.ts`, `test/audition.test.ts`
**See also** - [../sounds/sounds.md](../sounds/sounds.md), [../guide/deploy.md](../guide/deploy.md)

The site follows the factory's catalog in look (the same dark palette, app bar
and table), in shape (one filterable list, a detail per item) and in stack
(Solid, Vite). English only.

## Data

The designs themselves (`sounds/`), bundled into the site from source, so a
page plays the very code the game imports. Nothing is fetched. The build also
copies `export/sounds/` into `dist/`, so the deployed site serves the bundle the
game imports.

## The list

Every sound design, under a heading per category (`src/catalogList.ts`):
- **Search box** - every word must match the title, id, description, category
  or kind (`filterSounds`).
- **Kind chips** - All, One-shots, Loops.
- **Category chips** - All and each category of `CATEGORIES`
  ([../sounds/sounds.md](../sounds/sounds.md#categories)), each with the number
  of sounds it holds (`countByCategory`) and its description as a tooltip. A
  second click on the chosen chip clears it.
- **Groups** - the matching sounds under their category's title and
  description, in category order; a category with no match is left out
  (`groupByCategory`). Each group is a table: title, kind, and what it is (the
  description, hidden on a phone).

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
- the list: `q`, `cat` (a category id) and `kind` (`oneShot`, `loop`);
- the open sound: `sound=<id>`.

Unknown values are dropped. Links from the time the site also held music land on
the list: `set=<category>` is read as `cat`, while `kind=effect`, `?sounds`, a
`piece` or a `jingle` are ignored. Back walks all of it. Nothing is stored.
