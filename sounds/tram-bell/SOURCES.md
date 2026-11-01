# Tram bell - sources

The bell is synthesised (`lib/sfx/sources.ts`, `tramBell`). Downloaded on
2026-11-01 and re-encoded (MP3 128 kbit/s).

| File | Original | Author | Licence | Cut |
|---|---|---|---|---|
| `aporee-frankfurt-oder-tatra-kt4dm.mp3` | [Tram station "Stadion", Frankfurt (Oder) - Old Tatra KT4DM tram at the station](https://archive.org/details/aporee_64341_74254) (radio aporee): a Czech-built Tatra KT4DM arrives and leaves; its bell rings as the doors close | Niklas Dahlmann | CC BY 3.0 | whole recording, re-encoded |

## What was measured

The bell rings from 49.7 to 52.5 s of the recording.

- Partials (spectrum above 1 kHz): 1565 Hz (-5 dB), 3647 Hz (-12), 6230 Hz
  (0, the loudest), 9295 Hz (-3), 12452 Hz (-18). The model uses these
  frequencies; its levels come out within 3 dB.
- The strike rate (autocorrelation of the 6230 Hz band's envelope): 50 a
  second - a mains-frequency electric bell. The model strikes 50 times a
  second while the button is held.
- The ring is steady (within 3 dB) for its whole 2.8 s; the "warning"
  variant is this ring.

## Not measured

The "depart" variant - two short rings, as Czech tram drivers ring before
leaving a stop - is timed from general knowledge; the decay times of the
partials are estimated, not measured. A Prague or Brno recording of a T3
ringing at a stop would be the reference to add.
