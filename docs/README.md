# Documentation

**Covers** - the index of this repository's documentation, one row per file.
**Code** - none
**See also** - [../README.md](../README.md), [../AGENTS.md](../AGENTS.md)

| File | What it covers |
|---|---|
| [guide/setup-and-build.md](guide/setup-and-build.md) | installing, the scripts, what `pnpm build` produces, the tests, rendering a sound headlessly |
| [guide/deploy.md](guide/deploy.md) | the Cloudflare Worker at sound.railisland.com, the GitHub Actions workflows, secrets |
| [sounds/sounds.md](sounds/sounds.md) | the game's sound designs: the contract, the designs, their categories and parameters, the `sounds/` export the game imports, auditioning them on the site |
| [sounds/diesel.md](sounds/diesel.md) | the diesel engines: one loop per engine, its `state` that starts and stops it, the six engine profiles and the recordings they were matched to |
| [sounds/animals.md](sounds/animals.md) | draft animals: the hoof beat (foot, size, stride, team, the gait's rhythm) and the animal call per species, and the recordings they were matched to |
| [sounds/references.md](sounds/references.md) | the reference recordings the designs were matched to: the excerpts in `references/`, their sources and licences, adding one, playing them on a sound's page |
| [site/catalog-site.md](site/catalog-site.md) | the sound.railisland.com site: one sortable table with each sound's metrics, its filters, a sound's page, stopping playback on leaving, the URL state |

`docs/specs/` and `docs/impl/` are planning records. The music generator they
describe was removed; it is in the git history.
