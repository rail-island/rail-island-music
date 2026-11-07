# Animals

**Covers** - the sounds of draft animals: the hoof beat of a team pulling a
tram, a coach or a wagon (`hoof-beat`, a loop driven by the footfall rate) and
the animal's call (`animal-call`, a one-shot the player's Horn plays), their
parameters, how they are synthesized, and the recordings they were matched to.
**Code** - `sounds/designs/animals.ts`, `test/sounds.test.ts` (the animals)
**See also** - [sounds.md](sounds.md) (the contract, every design, the levels),
[references.md](references.md) (the excerpts); in the factory,
`docs/models/sounds.md` (which vehicle plays which team and call); in the game,
`docs/gameplay/sounds.md` (when they play)

Both designs are in the `animals` category. Their ids and parameter names are
permanent: the factory pins them on its animal-drawn vehicles (`game.sounds`)
and the game names them.

## The hoof beat (`hoof-beat`)

A loop, the animal counterpart of the steam beat. The game drives it at run
time with `rate`; the factory pins the rest per vehicle variant.

| Parameter | Range (default) | What |
|---|---|---|
| `rate` | 0-16 /s (3) | footfalls per second **of each animal**: four per stride. The game sets it from the vehicle's speed, `rate = 4 x speed / stride` (`hoofRate`); 0 is silent while the voice runs on |
| `foot` | `hoof`, `cloven`, `padded` (`hoof`) | shod hooves of a horse, donkey or mule on hard ground (a sharp clop); the cloven hooves of a cow or ox (a duller double knock); the padded feet of a camel or elephant (a soft thud, almost no click) |
| `size` | 0..1 (0.5) | the animal's weight: 0 a light donkey, 0.5 a horse, 1 an elephant; the heavier, the lower (`footPitch`: half an octave up at 0, most of an octave down at 1), longer (`footDecay`) and heavier the thud |
| `stride` | 0.5-3 m (1.4) | metres one animal covers per gait cycle (four footfalls). A character value the game reads to derive `rate`; the sound itself does not use it |
| `count` | 1-6 (1) | the team: each animal adds its own footfalls, out of step with the others, rather than one louder beat |
| `level` | 0..1 (1) | |

Because `rate` is per animal, a team of four at `rate` 8 puts down 32 footfalls
a second, and the game's rate does not depend on the team's size.

**A footfall** is three struck parts on one lane per animal, so footfalls of
different animals never cut one another short:

| Part | What | `hoof` | `cloven` | `padded` |
|---|---|---|---|---|
| click | band-passed noise, the hard edge on stone | 3.2 kHz, strong | 2.2 kHz, weaker | 900 Hz, a soft scuff |
| knock | narrow band-passed noise, the clop of the hoof wall | 650 Hz, Q 4 | 480 Hz, Q 2.5 | 300 Hz, Q 0.8 |
| thud | a sine falling from 1.5x to its pitch, the weight landing | 140 Hz, light | 115 Hz | 85 Hz, the main part |

All pitches are at `size` 0.5 and scale with `footPitch`. A cloven foot strikes
twice, its two claws 15-27 ms apart (heavier, wider). Every part is struck with
`setTargetAtTime`, so overlapping footfalls chain smoothly; each animal runs one
oscillator and two filters for the whole loop.

**The gait** (`gaitOffsets`): an animal's four feet land at fixed points of its
cycle. A walk is four nearly even beats, the pairs a little uneven (0, 0.26,
0.5, 0.76 of the cycle); a trot is two beats of diagonal pairs landing together
(0, 0.07, 0.5, 0.57). Between 3.5 and 6 footfalls a second the walk blends into
the trot. The fore feet land a little harder than the hind feet.

**The team** (`teamAnimals`): the first animal leads at phase 0; each other one
walks at a seeded phase of its cycle (0.12-0.88), with a seeded pitch
(x0.93-1.07) and level (0.8-1). Each of its footfalls scatters by up to 6 % of
its gap (`TEAM_SCATTER`) from a seeded sequence of its own, around its own beat,
so the team stays out of step rather than drifting into unison. Each animal
plays at `teamShare` = count^-0.7 of one, so a team is louder than one animal,
but not by its number. Nothing is random: a render is the same every time.

**The harness**: hooves and cloven feet shake the tack on about a third of
their footfalls, two to four tiny strikes of two resonant noise bands (3.1 and
5.3 kHz), about 20 dB under the footfall. The traces creak once a cycle of the
lead animal (a 38 Hz sawtooth through a 1.1 kHz band), quietly; padded feet
have the creak but no jingle.

**Levels** (EBU R128 of a render, see [sounds.md](sounds.md)): -30.1 LUFS at the
defaults (one horse walking, about the steam beat's level, `HOOF_TRIM`), -25.0
for four horses trotting at `rate` 8, -31.4 for two oxen (`cloven`, `size` 0.7)
and -27.9 for an elephant walking (`padded`, `size` 1, `rate` 1.2).

## The animal call (`animal-call`)

A one-shot. The game never plays it by itself: only the player's Horn sounds it
(the factory maps it to the vehicle's `call` slot).

| Parameter | Range (default) | What |
|---|---|---|
| `species` | `horse`, `donkey`, `mule`, `cow`, `camel`, `elephant` (`horse`) | which call |
| `pitch` | 0.7-1.4 (1) | scales the voice's pitch; the formants (the vocal tract) move by its square root |
| `level` | 0..1 (1) | |

Each call (`CALLS`) is one or two voiced parts and a breath of band-passed
noise. A part is an oscillator whose pitch follows a contour, with optional
vibrato (on `detune`) and amplitude flutter, under an envelope, through a
low-pass (a curve, for a cow opening its mouth) and band-pass formants. Every
species is trimmed (`trim`) so its call renders at -15 to -17.5 LUFS, about a
horn's blast.

| Species | Shape | Length |
|---|---|---|
| `horse` | a whinny: a near-pure tone at 1470 Hz rising to 1580 and falling to 1150 Hz with a 12 Hz flutter, joined after 0.45 s by a lower voice falling from 500 to 360 Hz | 1.5 s |
| `donkey` | a bray: four "hee" (inhaled, about 820 Hz, thin) and "haw" (exhaled, about 190 Hz, loud and rough) in turn | 3 s |
| `mule` | between the two: a short whinny near 1.15 kHz, then two brays at about 250 Hz | 2.1 s |
| `cow` | a moo at 185 rising to 218 Hz, closed ("mmm") for a second, then opening ("ooo") with its strongest band near 850 Hz, then closing | 2.5 s |
| `camel` | a groan near 130 Hz with a gurgling subharmonic an octave under, dark, rising at the end to a grumble near 260 Hz | 2.2 s |
| `elephant` | a trumpet: a sawtooth and a slightly detuned square (the rasp) at 560 rising to 735 and falling to 500 Hz, bright, formants near 2.2, 3.1 and 3.7 kHz, with a strong breath | 1.9 s |

## What was measured and what was modelled

The references are CC0 sound effects of the USC Cinema / Sunset Editorial
collection on archive.org ([references.md](references.md)).

| Design | Measured (reference) | Modelled without a measurement |
|---|---|---|
| `hoof-beat`, `hoof` | the knock at 540-770 Hz, the loudest band; the click (a footfall's centroid 2.6 kHz on pavement, 1.2 kHz on stone); the thud near 110-200 Hz; -20 dB in about 90 ms on stone; the walk's four nearly even footfalls about 0.3 s apart; the trot's diagonal pairs 45-60 ms apart; the tack's jingle near 3 kHz about 20 dB under (a horse walking on pavement, trotting on stone, steady with its tack jingling; two horses pulling a wagon) | how `size` scales a footfall; the trace creak |
| `hoof-beat`, `cloven` | a darker footfall (centroid about 700 Hz, most of it under 400 Hz) with frequent double knocks; a harness bell near 5.3 kHz (an ox cart) | the claws' spacing |
| `hoof-beat`, `padded` | - | everything: no recording of a camel or an elephant walking was found |
| `hoof-beat`, `count` | - | the team's phases and scatter |
| `animal-call`, `horse` | the whinny's two voices, their pitch and its 1.4 s length (a horse's whinny) | the flutter rate, the breath |
| `animal-call`, `cow` | the pitch (185 rising to 210-220 Hz), the 2.3 s length, the strongest band moving from the fundamental to near 850 Hz (cows mooing) | the formants' exact shape |
| `animal-call`, `camel` | about 130 Hz with a subharmonic near 66 Hz, the second harmonic strongest, dark (centroid about 350 Hz) (a camel grunting) | the gurgle's rate, the final rise |
| `animal-call`, `elephant` | 600 rising to 735 Hz and falling to 500 Hz, energy centred near 3 kHz (an elephant trumpeting) | the rasp, the breath |
| `animal-call`, `donkey`, `mule` | - | everything, from descriptions of the bray: the one CC0 bray found (on Wikimedia Commons) could not be downloaded, and no mule recording was found |

Rendered with `generator/renderSound.ts`, the default hoof beat matches the
walk on pavement's balance: a footfall's centroid 2.6 kHz, its loudest bands at
400-800 Hz and 3.2-6.4 kHz; two oxen's centroid is about 670 Hz.
