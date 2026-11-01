# Setup and build

**Covers** - installing, the package scripts, what a build produces, the tests and the headless render tool.
**Code** - `package.json`, `generator/sounds.ts`, `generator/renderSound.ts`, `generator/headless.ts`, `vite.config.ts`, `test/`
**See also** - [deploy.md](deploy.md), [../sounds/sounds.md](../sounds/sounds.md)

## Install

Node 22 and the pnpm that `packageManager` in `package.json` pins:

```bash
pnpm install
```

## Scripts

| Script | Does |
|---|---|
| `pnpm build:sounds` | `generator/sounds.ts`: writes `export/sounds/` ([../sounds/sounds.md](../sounds/sounds.md#the-export)) |
| `pnpm build:music` | the same as `build:sounds`. Kept because the game's `pnpm import:sounds` checks for and runs it, and checks the package name `rail-island-music`; rename neither without changing the game |
| `pnpm dev` | `build:sounds`, then the Vite dev server with `export/` as its public folder |
| `pnpm build` | `build:sounds`, `tsc --noEmit`, `vite build` into `dist/` (the site plus `export/`) |
| `pnpm preview` | serves `dist/` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest, all of `test/` |
| `pnpm deploy` | `build`, then `wrangler deploy` (CI does this; [deploy.md](deploy.md)) |

`export/` and `dist/` are generated and gitignored. The build is deterministic:
the same sources give the same files.

## Tests

`pnpm test` runs in about a second:

- `sounds` - the designs, their categories and the export
  ([../sounds/sounds.md](../sounds/sounds.md#tests));
- `catalogList` - the site's list: search, category and kind filters, the
  grouping by category, the chip counts;
- `query` - the site's URL state, and the old music site's links;
- `audition` - what a sound's page plays, and that leaving it stops all of it.

## Rendering a sound headlessly

```bash
pnpm exec tsx generator/renderSound.ts crossing-bell /tmp/bell.mp3 --seconds=6
```

It renders through headless Chromium (Playwright's, pre-installed in the cloud
sessions; not a dependency of this repository). See
[../sounds/sounds.md](../sounds/sounds.md#rendering-a-sound-to-a-file).
