# Modern electric train - sources

The sound is synthesised (`lib/sfx/sources.ts`, `modernElectricEngine`).
Downloaded on 2026-11-01 and cut to the part that was used (MP3 128 kbit/s).

| File | Original | Author | Licence | Cut |
|---|---|---|---|---|
| `aporee-berlin-hbf-ice-departure.mp3` | [Berlin Hauptbahnhof - ICE am Gleis 7](https://archive.org/details/aporee_21357_24792) (radio aporee): an ICE arrives and departs | Fritz Schluter | CC BY 3.0 | 226-266 s of 329 s (the departure) |

## What was measured

From a spectrogram of the departure (236-255 s of the original): a cluster
of steady converter tones near 1180, 1830, 2420, 2750 and 3070 Hz, each
rising by roughly 8 % over the first seconds of acceleration, and a constant
tone at 620 Hz. The model plays these.

## Not measured

The two-tone horn (659 and 554 Hz) and the gear tone are not measured.
