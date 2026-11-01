# Diesel locomotive - sources

The sound is synthesised (`lib/sfx/sources.ts`, `dieselEngine` and
`dieselHorn`); these recordings are the references it was tuned to.
Downloaded on 2026-11-01 and cut to the part that was used (MP3 128 kbit/s).

| File | Original | Author | Licence | Cut |
|---|---|---|---|---|
| `red-library-diesel-air-horn.mp3` | "R20-24-Diesel Train with Air Horn.wav" in [Red Library: Trains](https://archive.org/details/Red_Library_Trains) | Red Library (archive.org upload) | CC0 1.0 | 0-20 s of 67 s |
| `aporee-banska-bystrica-757-departure.mp3` | [Train Leaving the Station, Banska Bystrica](https://archive.org/details/aporee_64578_74527) (radio aporee) - the "Fatran" express behind a class 757 diesel | Rastislav Gulasa | CC BY 3.0 | whole recording, re-encoded |

## What was measured

- The horn (10.75-11.5 s of the Red Library file): three notes at 296, 445
  and 740 Hz; the model plays these.
- The class 757 departure (5 s windows of 15-400 Hz peaks): a harmonic ladder
  spaced about 9 Hz idling, strongest near 100 Hz; pulling away the
  strongest components move to 210-250 Hz. The model turns the engine at
  9 rev/s idling, 19 at full power, with a formant at 11 times the rotation.

## Not measured

The turbocharger whine and the exhaust pulse shape are modelled, not
measured.
