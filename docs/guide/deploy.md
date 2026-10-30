# Deploy

**Covers** - how music.railisland.com is hosted, the GitHub Actions workflows that build and deploy it, and the Cloudflare credentials they need.
**Code** - `wrangler.jsonc`, `.github/workflows/deploy.yml`, `.github/workflows/test.yml`
**See also** - [setup-and-build.md](setup-and-build.md), [../site/catalog-site.md](../site/catalog-site.md)

## The Worker

`wrangler.jsonc` declares one **assets-only** Worker, `rail-island-music`: no
script, no bindings, no vars. It serves `dist/` - the site plus the generated
music - on the custom domain `music.railisland.com`, which wrangler provisions
on deploy, and on the account's `rail-island-music.<subdomain>.workers.dev`
address. `not_found_handling: single-page-application` sends any unknown path to
`index.html`; the site keeps its state in the query string.

## Workflows

| Workflow | Runs on | Does |
|---|---|---|
| `deploy.yml` | push to `master`, or by hand on any branch | `pnpm build`, then `wrangler deploy` |
| `test.yml` | push to `master`, or by hand on any branch | `pnpm typecheck`, then `pnpm test` (even if the typecheck failed) |

The two run in parallel; tests do not gate the deploy. A dispatch of
`deploy.yml` against a `claude/*` branch puts that branch on the site.

## Credentials

Two repository secrets, the same pair `rail-island-factory` and
`rail-island-webapp` use: `CLOUDFLARE_API_TOKEN` (with `Workers Scripts: Edit`
and zone-scoped `Workers Routes: Edit` over railisland.com, which the custom
domain needs) and `CLOUDFLARE_ACCOUNT_ID`. They must be added to this
repository's settings before the first deploy.
