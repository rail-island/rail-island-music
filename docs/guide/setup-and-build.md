# Setup and build

**Covers** - installing, the package scripts, what a build produces, the tests and the headless render tools.
**Code** - `package.json`, `generator/generate.ts`, `generator/renderAudio.ts`, `generator/renderNotation.ts`, `generator/headless.ts`, `generator/prepareSamples.ts`, `vite.config.ts`, `test/`
**See also** - [deploy.md](deploy.md), [../music/export.md](../music/export.md)

## Install

Node 22 and the pnpm that `packageManager` in `package.json` pins:

```bash
pnpm install
```

## Scripts

| Script | Does |
|---|---|
| `pnpm build:music` | `generator/generate.ts`: reads `scores/`, writes `export/` ([../music/export.md](../music/export.md)) |
| `pnpm dev` | `build:music`, then the Vite dev server with `export/` as its public folder |
| `pnpm build` | `build:music`, `tsc --noEmit`, `vite build` into `dist/` (the site plus `export/`) |
| `pnpm preview` | serves `dist/` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest, all of `test/` |
| `pnpm deploy` | `build`, then `wrangler deploy` (CI does this; [deploy.md](deploy.md)) |

`export/` and `dist/` are generated and gitignored. The build is deterministic:
the same sources give the same files.

## Tests

`pnpm test` runs in a few seconds:

- `theory`, `abcParse`, `performance` - keys, spelling, chord symbols, the ABC
  subset (lengths, accidentals, ties, tuplets, broken rhythm, repeats and
  endings, voices and parts, the errors it raises), tempo maps and swing;
- `arrange` - determinism, repeats and the silent opening pickup, transposition,
  tempo and length, the generated harmony line, instruments and ranges;
- `abcWrite` - every piece written as ABC and read back gives the same bars and
  note onsets (three ensembles each);
- `scores` - every piece loads, has its `SOURCES.md`, lasts 2 to 5 minutes in its
  default arrangement and stays within the recorded samples in every ensemble
  and in keys -3, 0 and +3; the sample set is complete;
- `query` - the site's URL state and search.

## Hearing and seeing a piece headlessly

Two tools render through headless Chromium (Playwright's, pre-installed in the
cloud sessions; it is not a dependency of this repository), after
`pnpm build:music`:

```bash
pnpm exec tsx generator/renderAudio.ts rondo-alla-turca /tmp/turca.mp3 ensemble=chiptune --seconds=60
```

```bash
pnpm exec tsx generator/renderNotation.ts rondo-alla-turca /tmp/turca.png --bars=16
```

`renderAudio` plays the arrangement through the real synth in an
OfflineAudioContext and writes WAV or MP3 (ffmpeg). `renderNotation` draws the
arranged score with abcjs, as the site does. Parameters are `name=value`; any
not given take the piece's defaults.

## The sample set

`samples/` is committed. `generator/prepareSamples.ts` rebuilds it from a
VSCO 2 CE checkout and ffmpeg ([../music/synth.md](../music/synth.md)).
