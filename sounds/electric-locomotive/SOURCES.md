# Old electric locomotive - sources

The sound is synthesised (`lib/sfx/sources.ts`, `oldElectricEngine`,
`twoToneHorn`). Downloaded on 2026-11-01 and re-encoded (MP3 128 kbit/s).

| File | Original | Author | Licence | Cut |
|---|---|---|---|---|
| `aporee-kosice-departure.mp3` | [Trains at Kosice Station](https://archive.org/details/aporee_54418_62243) (radio aporee): a diesel-hauled train leaves, an electric locomotive idles at the same platform | Rastislav Gulasa | Public Domain Mark 1.0 | 0-90 s of 226 s |

## What was measured, and what was not

This model rests on the reference less than the others. The Kosice file has
the idling electric locomotive (blowers, a steady low hum) under the diesel,
which set the level of the blowers against the rest; it has no electric
locomotive pulling away. The gear whine (79 axle teeth, 1.25 m wheels), the
controller notches every 1.1-1.4 s, the 12 strokes/s compressor and the
two-tone horn (311 and 370 Hz) are modelled from a general description of
resistor-controlled DC locomotives and are **not checked against a
recording**. A recording of such a locomotive starting (e.g. a CD class 140
or 141) is the first thing to add here.
