# Agent Instructions

**Rail Island Sound** holds the sound effects of Rail Island and hosts their
catalog at `sound.railisland.com`. Every sound is a design in `sounds/`,
synthesized at run time with Web Audio and grouped into categories; the
generator bundles them into `export/sounds/`, which the game
(`rail-island-webapp`) imports with its `pnpm import:sounds`
(docs/sounds/sounds.md). The repository once also generated music; that was
removed and lives only in the git history.

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

- **TypeScript (strict)**. `sounds/` is the game's sound designs (Web Audio
  nodes, no DOM): the generator bundles them and the site plays them from
  source. `sounds/types.ts` is types only: it is written out as the bundle's
  `.d.ts`. `generator/` is Node-only, run with `tsx`.
- The site is **Solid** (`solid-js`) + **Vite**. Do not use
  React APIs; use signals, `createEffect`/`onMount`/`onCleanup`,
  `<Show>`/`<For>`, do not destructure props, `class` not `className`.
- Tests are **Vitest** under `test/`. Package manager is **pnpm**.
- Hosting is an assets-only **Cloudflare Worker** (`wrangler.jsonc`), deployed by
  `.github/workflows/deploy.yml` on every push to `master`.

## Rules

- **`sounds/` and `src/` never import `generator/`** or anything `node:`.
- **The package name `rail-island-music` and the `build:music` script stay**:
  the game's import checks both.
- **Sound ids are permanent once the game plays them**, and so are their
  parameter names: the game names both in code. Adding a parameter is fine
  (with a default); renaming or removing one is a change in the game too.
- **Output stays deterministic**: no timestamps, no randomness, no unordered
  iteration in what is written.
- **Every design has a category** of `CATEGORIES` (`sounds/index.ts`), and
  `SOUNDS` keeps each category's designs together, in category order.
- **Downloading references is allowed, and what you use is saved.** You may
  fetch recordings from the internet (archive.org, Wikimedia Commons, ...) to
  match a design against. Keep every recording a design was matched to as an
  excerpt in `references/`, listed in `src/references.ts` with its source,
  author and licence (CC0, Public Domain Mark or CC BY), and say in the design's
  comment and in docs/sounds/ what was measured from it and what was modelled
  without a measurement (docs/sounds/references.md).
- **No music.** Do not bring back scores, samples or a music synth unless asked.
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

## Let the user hear the sound

Whenever you add or change a sound design, **send the user the result in the
chat** before you finish: an MP3 from `generator/renderSound.ts`
(docs/sounds/sounds.md). Write it to your scratchpad, never into the
repository, send it with the chat's file-sending tool, caption it with the
sound id and parameters, and say what you would improve next.
