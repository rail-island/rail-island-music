# Shinkansen - sources

The sound is synthesised (`lib/sfx/sources.ts`, `shinkansenEngine`, and the
rolling noise in `lib/sfx/scene.ts`). Downloaded on 2026-11-01 and cut to the
part that was used (MP3 128 kbit/s).

| File | Original | Author | Licence | Cut |
|---|---|---|---|---|
| `aporee-odawara-shinkansen.mp3` | [Odawara Station - Shinkansen train leaving for Nagoya](https://archive.org/details/aporee_70028_81566) (radio aporee, binaural) | Flavien Gillie | Public Domain Mark 1.0 | 36-96 s of 386 s |

## What was measured

At 10-16 s of the excerpt a train passes the platform without stopping: a
flat block of broadband noise, most of its energy below 1.2 kHz, rising and
falling within about a second at each end and lasting about six seconds -
what a 400 m train at 240-270 km/h gives. The model's pass is the noise of
the whole train's length (16 cars, 402 m) at 75 m/s heard from 12 m.

## Not measured

The inverter whine pulling away (420 Hz rising with speed) and the
pantograph hiss are modelled, not measured; this recording is of a train
leaving at the far platform, under station noise.
