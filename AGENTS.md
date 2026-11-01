# Agent Instructions

**Rail Island Music** generates music for Rail Island and hosts its catalog at
`music.railisland.com`. Public-domain pieces are written once as ABC scores;
the generator arranges them (ensemble, tempo, length, key), exports note data,
the arranged score and a WebAudio synth with its samples. The game
(`rail-island-webapp`) does not import the music yet: whether it will is decided
after listening (docs/specs/2026-10-30-music-generator-catalog.md).

This repository is also the **source of the game's sound effects**
(docs/sounds/sounds.md): every horn, whistle, bell and knock is a synthesized
design in `sounds/`, exported as `export/sounds/sounds.js` and mirrored into the
game by its `pnpm import:sounds`, the way rail-island-factory's models are. A
sound is changed here and re-imported there, never edited in the game.

## Documentation (`docs/`)

All documentation lives in **`docs/`**, indexed by hand in `docs/README.md`; the
root `README.md` is a landing page only. **When you change behaviour, update the
document that owns it in the same change.** Conventions:

- One file, one subsystem, about 600 lines at most.
- Every file opens with `# Title` and three lines - **Covers**, **Code** (the
  source paths it documents) and **See also**.
- A new file gets a row in `docs/README.md` in the same change.
- Cross-references are relative paths between documents. English only.
- `docs/specs/` and `docs/impl/` are planning records, not reference.

## Stack

- **TypeScript (strict)**. `lib/` (parser, arranger, ABC writer) is isomorphic:
  the generator and the site run the same code. `synth/` is browser-only.
  `sounds/` is the game's sound designs, browser-only like `synth/` (Web Audio
  nodes, no DOM), and `sounds/types.ts` is types only: it is written out as the
  bundle's `.d.ts`. `generator/` is Node-only, run with `tsx`.
- The site is **Solid** (`solid-js`) + **Vite**, abcjs for the score. Do not use
  React APIs; use signals, `createEffect`/`onMount`/`onCleanup`,
  `<Show>`/`<For>`, do not destructure props, `class` not `className`.
- Tests are **Vitest** under `test/`. Package manager is **pnpm**.
- Hosting is an assets-only **Cloudflare Worker** (`wrangler.jsonc`), deployed by
  `.github/workflows/deploy.yml` on every push to `master`.

## Rules

- **`lib/` and `src/` never import `generator/`** or anything `node:`.
- **Piece ids are permanent once published** - the game may store them.
- **Sound ids are permanent once the game plays them**, and so are their
  parameter names: the game names both in code. Adding a parameter is fine
  (with a default); renaming or removing one is a change in the game too.
- **Output stays deterministic**: no timestamps, no randomness, no unordered
  iteration in what is written.
- **Jingles are the user's own recordings** (docs/music/jingles.md), in
  `jingles/<id>/` with the recording and `SOURCES.md`; the public-domain rule
  is for the pieces in `scores/`. They are written for the site only
  (`export/site/`) until the game uses them.
- **Public domain only** (docs/music/scores.md): a composition must be PD in
  the EU and the US; transcriptions are our own. Never use an arrangement or a
  recording.
- **Sources are stored in git.** Every reference a score is made from lives in
  `scores/<id>/` and is listed in its `SOURCES.md`; samples are listed in
  `samples/SOURCES.md`. Do not transcribe a piece from memory and present it as
  checked: say in `SOURCES.md` what it was made from.
- **`export/` and `dist/` are generated and gitignored.** Never commit them.
- Every bug fix ships with a regression test in the suite that owns the behaviour.
- Use ASCII in code and comments; no emoji.

## Git

- **Importing into the game is a separate, standalone step.** Never do it as part
  of a change here unless asked to.

## Verify changes

`pnpm typecheck`, `pnpm test` and `pnpm build`. The whole `pnpm test` must stay
well under a minute.

**Headless verification only**: do not drive a real browser unless the task is
about browser tooling and the user agreed first.

## Let the user hear and see the music

Whenever you add or change a piece, an ensemble, a groove or the synth, **send
the user the result in the chat** before you finish: an MP3 from
`generator/renderAudio.ts` (a minute or so is enough) and the first bars of the
score from `generator/renderNotation.ts` (docs/guide/setup-and-build.md). Write
them to your scratchpad, never into the repository, send them with the chat's
file-sending tool, caption each with the piece id and parameters, and say what
you would improve next.
