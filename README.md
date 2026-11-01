# Rail Island Music

Music for [Rail Island](https://www.railisland.com), generated from code, and the
catalog site that plays it: [music.railisland.com](https://music.railisland.com).

Public-domain classical pieces, ragtime and early jazz are written once as
scores (ABC notation). A generator arranges each one for solo piano, a ragtime
band, a brass band, a jazz band or chiptune, at three tempos, three lengths and
seven keys, and exports note data plus a small WebAudio synth with CC0
instrument samples. The site plays any arrangement and shows its score,
following the playback. The synth also computes train sounds (steam, diesel,
old and modern electric, Shinkansen) and the Czech tram bell, tuned to real
recordings kept in `sounds/`.

```bash
pnpm install
```

```bash
pnpm dev
```

Documentation: [docs/README.md](docs/README.md). Licence: MIT (code); the
compositions are public domain, the samples CC0 (`samples/SOURCES.md`); the reference recordings in
`sounds/` keep their own licences (each folder's `SOURCES.md`).
