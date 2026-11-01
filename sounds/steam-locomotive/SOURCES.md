# Steam locomotive - sources

The sound is synthesised (`lib/sfx/sources.ts`, `steamEngine` and
`steamWhistle`); these recordings are the references it was tuned to.
Downloaded on 2026-11-01 and cut to the part that was used (MP3 128 kbit/s).

| File | Original | Author | Licence | Cut |
|---|---|---|---|---|
| `sse-steam-starts-and-pulls-away.mp3` | "STEAM/TRNSteam_Steam engine train starts and pulls away_CS_USC.wav" in [SSE Library: TRAINS](https://archive.org/details/SSE_Library_TRAINS) | Sound Search Engine library (archive.org upload) | CC0 1.0 | 10-80 s of 110 s |
| `sse-steam-whistle.mp3` | "STEAM/TRNSteam_Steam train whistles then pulls out_CS_USC.wav", same collection | same | CC0 1.0 | 38-52 s of 60 s |

## What was measured

- Chuff rate (periodicity of the 150-2000 Hz envelope
  in 4 s windows): about 3 chuffs/s once it moves, 5/s after 15 s, 7/s after
  30 s, 9-10/s at speed. The model makes four chuffs per turn of 1.75 m
  driving wheels, so 3/s is about 4 m/s.
- The whistle (45-46.5 s of the original): partials at 516, 1446, 2080 and
  2497 Hz (-5, -4, -4, 0 dB); the model plays exactly these.

## Not measured

The uneven strength of the four beats, the cylinder-cock hiss of the first
beats and the burst shape are modelled from a general description of steam
engines, not checked against these files.
