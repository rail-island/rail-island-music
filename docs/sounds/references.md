# Reference recordings

**Covers** - the recordings the sound designs were matched to: the excerpts kept
in git under `references/`, the list that ties them to sounds with their source
and licence, the rules for adding one, and how the site plays them.
**Code** - `references/`, `src/references.ts`, `src/ReferenceList.tsx`,
`src/EffectPage.tsx`, `test/references.test.ts`
**See also** - [diesel.md](diesel.md) and [animals.md](animals.md) (what was measured in them),
[../site/catalog-site.md](../site/catalog-site.md) (the sound's page),
[sounds.md](sounds.md)

The site shows each sound's inspiration beside it, the way the factory's catalog
shows a model's photos: on a sound's page, below the spectrogram, every
recording it was matched to, with a player. The game never sees them: they are
site-only and not part of `export/sounds/`.

## The files (`references/`)

Each reference is an **excerpt** of a recording, not the whole of it:
- MP3, mono, 44.1 kHz, 64 kbit/s;
- at most about 40 s, cut where the engine does what the design imitates;
- loudness-normalised to -23 LUFS (EBU R128), so recordings compare with one
  another, with a 20 Hz high-pass and short fades at both ends;
- a kebab-case name: `<what>-<doing>.mp3`.

A file stays under 400 kB and all of them under 6 MB (tested). They are 30
files, about 5.4 MB.

## The list (`src/references.ts`)

`REFERENCES` maps a sound id to its references, in the order the page lists
them. A reference has:

| Field | What |
|---|---|
| `file` | the excerpt's name in `references/` |
| `title` | what it is, in a few words |
| `note` | what the design took from it, and how long the excerpt is of how long the recording |
| `source` | the recording's `title`, `url`, `author` and `licence` (`CC0 1.0`, `CC BY 4.0`, `CC BY 3.0` or `Public Domain Mark 1.0`) |

One excerpt may serve several sounds (a passing diesel is a reference for the
mainline and the two-stroke engine). Vite imports each file as an asset
(`import.meta.glob`), so the build copies it, fingerprinted, into
`dist/assets/`; `referenceUrl` gives its URL.

| Sound | References |
|---|---|
| `diesel-engine-railcar` | a diesel trolley idling and revving |
| `diesel-engine-shunter` | a mine diesel locomotive idling (Wikimedia Commons, CC BY 4.0) |
| `diesel-engine-mainline` | a diesel train passing; a diesel train with its air horn (no V12 recording was found) |
| `diesel-engine-two-stroke` | a diesel train arriving and idling; passing; with its air horn |
| `diesel-engine-bus` | an old bus starting; revving and stopping; a bus in the street |
| `diesel-engine-truck` | a truck idling and stopping; a fire truck idling; a diesel truck revving; an old truck working hard; a large truck starting |
| `steam-chuff` | a steam engine starting and pulling away (SSE library, CC0) |
| `steam-whistle` | a steam train's whistle (SSE library, CC0) |
| `electric-engine-resistor` | an electric locomotive idling at Kosice (radio aporee, Public Domain Mark) |
| `electric-engine-converter` | an ICE pulling out of Berlin Hbf (radio aporee, CC BY 3.0) |
| `electric-engine-shinkansen` | a Shinkansen passing Odawara (radio aporee, Public Domain Mark) |
| `tram-bell` | a Tatra KT4DM's bell at Frankfurt (Oder) (radio aporee, CC BY 3.0) |
| `helicopter` | a light helicopter hovering; one starting and lifting off (USC Gold Tape 36, CC0) |
| `hoof-beat` | a horse walking on pavement; trotting on stone; steady with its tack jingling; two horses pulling a wagon; an ox cart (USC Gold Tapes 38 and 52, Red Library, CC0) |
| `animal-call` | a horse's whinny; cows mooing; a camel grunting; an elephant trumpeting (USC Gold Tapes 12 and 38, CC0); no donkey or mule |

The diesel references but the mine locomotive are CC0 sound effects of the
USC Cinema and Sunset Editorial collections on archive.org, and so are the
helicopter and the animal ones; the steam ones come
from the SSE library there, and the electric, Shinkansen and tram ones are radio
aporee field recordings, also on archive.org. The crossing bell was matched to a
recording of a Czech crossing bell that is not in the repository.

## Adding a reference

1. **The licence.** Only a recording free to keep in git and to play publicly:
   CC0, the Public Domain Mark, or CC BY (then credit the author, as
   `source.author`). Not a recording
   of unknown licence, and not one from a commercial library.
2. **The excerpt.** Cut and encode it as above, for example:

   ```bash
   ffmpeg -ss 13 -t 30 -i source.wav -af "highpass=f=20,loudnorm=I=-23:TP=-2:LRA=15,afade=t=in:d=0.15,afade=t=out:st=29.6:d=0.4" -ac 1 -ar 44100 -c:a libmp3lame -b:a 64k references/train-idle.mp3
   ```

3. **The entry.** Add it to `src/references.ts` and list it under its sounds.
   The tests check that every file is listed and every listed file exists.

## On the page

`ReferenceList` shows each reference's title and note, a native audio player
(`preload="none"`, so nothing loads until it is played) and a source line:
the recording's title (linked), its author and its licence (linked), and that
it is an excerpt, loudness-normalised.

A recording plays through the page's own audio chain
(`createMediaElementSource`, once per player): the same gain, compressor and
analyser as the design. The spectrogram therefore draws it the same way, for a
like-for-like comparison. The design and the recordings take turns: playing a
recording pauses any other and stops a running loop; pressing Play or Start
pauses the recordings; leaving the page pauses them too.
