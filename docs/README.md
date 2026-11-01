# Documentation

**Covers** - the index of this repository's documentation, one row per file.
**Code** - none
**See also** - [../README.md](../README.md), [../AGENTS.md](../AGENTS.md)

| File | What it covers |
|---|---|
| [guide/setup-and-build.md](guide/setup-and-build.md) | installing, the scripts, what `pnpm build` produces, the tests, the headless audio and notation renders |
| [guide/deploy.md](guide/deploy.md) | the Cloudflare Worker at music.railisland.com, the GitHub Actions workflows, secrets |
| [music/scores.md](music/scores.md) | the score sources: one folder per piece, `piece.json`, the ABC subset the parser reads, sources and the public-domain rule, adding a piece |
| [music/arrangement.md](music/arrangement.md) | the four parameters, the form (repeats, endings, parts), the grooves and the generated bass, chords, drums and harmony, the ensembles, ranges, the arranged score written back as ABC |
| [music/export.md](music/export.md) | the export folder the game would import: `catalog.json`, the note data format, the arranged ABC, the synth bundle, the samples |
| [music/sounds.md](music/sounds.md) | the train sounds and the tram bell: the catalog, how a sound is computed, the reference recordings in `sounds/`, playing and rendering them |
| [music/synth.md](music/synth.md) | the WebAudio synth: instruments, the sample set from VSCO 2 CE, scheduling, the Player API, offline rendering |
| [site/catalog-site.md](site/catalog-site.md) | the music.railisland.com site: the list, the piece page, the score that follows the playback, the mini player, the URL state and the stored volume |
