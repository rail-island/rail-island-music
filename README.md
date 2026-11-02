# Rail Island Sound

The sound effects of [Rail Island](https://www.railisland.com), synthesized from
code, and the catalog site that plays them:
[sound.railisland.com](https://sound.railisland.com).

Every horn, whistle, engine, bell, water and woods the game plays is a design
here, with named, ranged parameters, grouped into categories. The generator
bundles them into one ES module the game imports; the site lists them by
category and auditions each with sliders and a spectrogram.

```bash
pnpm install
```

```bash
pnpm dev
```

Documentation: [docs/README.md](docs/README.md). Licence: MIT.

The repository once also generated music (public-domain scores, a synth and
jingles). That was removed; it is in the git history.
