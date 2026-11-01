# Diesel engines

**Covers** - the diesel engine sounds: the running engine (`diesel-engine`), its
start (`diesel-start`) and stop (`diesel-stop`), the six engine profiles and the
recordings they were matched to, how an engine is synthesized, and how the game
chains the three sounds.
**Code** - `sounds/designs/diesel.ts`, `test/sounds.test.ts` (the diesel engine,
the diesel profiles)
**See also** - [sounds.md](sounds.md) (the contract, every design, the levels),
[../guide/setup-and-build.md](../guide/setup-and-build.md)

## The sounds

| Id | Kind | Parameters | What it is |
|---|---|---|---|
| `diesel-engine` | loop | `rpm` 0..1 (0.4), `load` 0..1 (0.5), `size` 0..1 (0.5), `engine` (`mainline`), `level` | the engine running: idle at `rpm` 0, full revs at 1; `load` is how hard it works |
| `diesel-start` | one-shot | `size`, `engine`, `level` | silent until the engine coughs (no starter, no cranking), then it catches, flares past idle and settles |
| `diesel-stop` | one-shot | `size`, `engine`, `level` | from idle the fuel is cut: it runs down through its last compressions, rocks to a stop, the turbo spins down |

`size` scales a profile's revs: x1.2 at 0, x1 at 0.5 (the profile as
measured), x0.8 at 1. It was the only size control before the profiles and stays,
with its name, for the game.

**Chaining them in the game.** A start ends at idle and fades out over its last
0.6 s (`dieselStartTimes(engine).idles` to `.ends`). The game starts
`diesel-engine` at `rpm` 0 at `idles`, and the loop is at its level at once. To
shut down, the game stops the loop (its 0.06 s fade) and plays `diesel-stop` at
the same moment, which fades in over the same 0.06 s from idle. A stop's length
is `dieselStopTimes(engine).ends`, and its engine stands still at `.still`.

## The profiles (`DIESEL_PROFILES`)

| `engine` | What | Cylinders, strokes | Idle - full rpm | Firing /s at idle - full | Turbo | Runs down |
|---|---|---|---|---|---|---|
| `railcar` | a railcar's or DMU's underfloor inline six | 6, four-stroke | 600 - 2000 | 30 - 100 | light | 1.6 s |
| `shunter` | a shunting loco's medium-speed six | 6, four-stroke | 420 - 1250 | 21 - 63 | light | 2.6 s |
| `mainline` | a mainline loco's turbocharged V12 (the default) | 12, four-stroke | 400 - 1100 | 40 - 110 | strong | 3.4 s |
| `two-stroke` | a big two-stroke V16, the EMD kind | 16, two-stroke | 315 - 904 | 84 - 241 | strongest | 4 s |
| `bus` | a city bus's turbocharged inline six, muffled | 6, four-stroke | 600 - 2200 | 30 - 110 | high, thin | 1.2 s |
| `truck` | a truck's air-cooled V8, open and clattering, with its fan | 8, four-stroke | 650 - 2300 | 43 - 153 | none | 1.1 s |

Each profile also has its pulse sharpness, the low-pass over its tone (idling and
working), the exhaust's resonance, the knock's band and level, the breath's
level and a `trim`, which evens the profiles to the same
loudness. The values are in `sounds/designs/diesel.ts`.

## How an engine is synthesized

One engine cycle (every cylinder firing once) is drawn as a waveform:
- **Pulses** - one pressure pulse per cylinder, rising fast and decaying over a
  fraction (`pulse`) of the gap to the next.
- **Unevenness** - each cylinder fires a little stronger or weaker and a little
  early or late (`uneven`, seeded per profile, so an engine always lopes the
  same way).

The waveform's Fourier series (`cycleSeries`, 192 harmonics) is played as a
`PeriodicWave` at the cycle rate (rpm / 120 for a four-stroke, rpm / 60 for a
two-stroke). Its strongest line is therefore the firing order, and the
unevenness adds the lines between, the once-a-cycle lope a real engine has
(tested). The parts:

| Part | What | Changes with |
|---|---|---|
| tone | the cycle wave, a low shelf (-12 dB under 160 Hz), the exhaust's resonance (peaking), a low-pass | the low-pass opens with `load` and the revs |
| knock | noise in the profile's knock band (1.3-2.5 kHz), gated by the same cycle drawn as sharp spikes: the diesel clatter | it softens a little under load, drowned by the exhaust |
| breath | low-passed noise gated by the cycle drawn as soft lumps: the exhaust between the lines | louder and brighter with `load` and the revs |
| turbo | a sine whine | its speed lags the engine, from `rpm` and `load` |
| fan | band-passed noise (the `truck` only) | the revs |
| master | `dieselLevel(revs, load)`, times the profile's `trim` | the revs and `load` |

The three cycle oscillators share their frequency automation, so the knock and
the breath stay in step with the tone. The waves are computed once per context
and profile. Every change glides (about 0.35 s), and the revs drift by up to 1%
every 0.3 s (seeded): the governor hunting. A running loop changes `engine` in
place.

**Start.** There is no starter motor and no cranking to hear: the start is
silent until the engine itself sounds (a first version had a starter's
sawtooth whine, which droned like an electric buzz and was dropped). For half a
second it coughs (six uneven bursts, `COUGHING`), then catches and flares to
1.45x idle, and the governor pulls it back to idle over about a second. Every
engine starts the same way, so `dieselStartTimes` is the same for all.

**Stop.** At 0.3 s the fuel is cut: the knock and the breath stop, and the
engine coasts down through its compressions over `rundown`, then rocks back on
the last one (a low thud). The turbo spins down on its own, slower.

## The reference recordings

The engines were matched to these recordings: they were analysed, not copied,
and no audio is stored in this repository. The archive.org reels are CC0 sound
effects from the USC Cinema and Sunset Editorial collections.

| Recording | Source, licence | What it gave |
|---|---|---|
| `G49-10 Diesel Trolly` | archive.org `GOLD_TAPE_47_48_49_Trains`, CC0 | a small diesel railcar idling and revving: clean harmonic lines, the lope at the cycle rate |
| `R20-24 Diesel Train with Air Horn`, `R20-43 Diesel Train In and Stop` | archive.org `Red_Library_Trains`, CC0 | American road diesels passing and idling (the `two-stroke`) |
| `G48-12 Diesel Train In Brakes`, `G48-17 Diesel Train Approaches By` | archive.org `GOLD_TAPE_47_48_49_Trains`, CC0 | the same, passing |
| `WWS Bedia diesel locomotive idling` | Wikimedia Commons, Work With Sounds / Technical Museum of Slovenia, CC BY 4.0 | a small mine locomotive idling, recorded close and full range (the `shunter`) |
| `G14-25 Truck Idling and Stop`, `G14-22 Fire Truck Idle`, `G14-08 Diesel Truck`, `G14-03 Truck Accelerations` | archive.org `GOLD_TAPE_14_Trucks`, CC0 | trucks idling, revving and shutting down (the `truck`, the stop) |
| `R03-29 Large Truck Constant Engine`, `R03-32 Old Truck Engine Working Hard`, `R19-48 Old Large Truck Start Idle Out`, `R20-30 Truck Drives in Low Gear` | archive.org `Red_Library_Trucks`, CC0 | trucks working and starting |
| `G14-13 Old Bus Complete Sequence`, `R05-19 Bus Sounds` | archive.org `GOLD_TAPE_14_Trucks`, `Red_Library_Trucks`, CC0 | a bus cranking, catching, revving and stopping (the `bus`, the start) |

Found but not fetched (Wikimedia Commons rate-limited the downloads), worth a
later comparison: `WWS DiesellocomotiveBediamoving.ogg`, `WWS
Kleinlokomotive8211motor.ogg`, `Fr-Paris--locomotive diesel-electrique.ogg`,
`JNR DD51 759 ... kitakata.ogg` (a diesel-hydraulic), `Sound of SNCB NMBS Class 41
departing.ogg` (a DMU), `WWS City Bus MAN SG 220 - engine.oga`, `Solaris Urbino
18 10472, engine sounds, Szczecin, 2022.wav`.

**What was measured** (steady stretches, 16 kHz; the old reels are cut below
about 100 Hz, so their lowest band is not a reference):

| | Spectral centroid | Band levels, dB: 20-100, 100-250, 250-600, 600-1.5k, 1.5-4k, 4-8k | Tonality (line over floor) | Envelope modulation |
|---|---|---|---|---|
| recordings, idle and working | 170-1000 Hz | about -5, -4, -8, -10, -10, -25 | 3-5 dB | depth 0.4-0.6, at the cycle or turn rate (4-12 /s) |
| the old design (before the profiles) | 54 Hz | -2, -10, -16, -26, -30, -37 | 17 dB | depth 0.97, at the firing rate |
| the profiles, idling | 350-940 Hz | -7 to -11, -6 to -9, -4 to -6, -3 to -10, -9 to -21, -13 to -30 | 5.3 dB | depth 0.55-0.6 |

The old design was a buzz below 100 Hz: almost nothing above 250 Hz, no knock and
a pure, too-regular pulse. The profiles spread their energy the way the
recordings do, with the diesel knock in the 1.5-4 kHz band.

**Levels** (EBU R128 of `generator/renderSound.ts` renders): every profile runs
at -29.5 LUFS (within 0.6 dB) at the defaults, about -40 idling and -21 at full
revs and effort. That is beside a running steam beat and under a horn
([sounds.md](sounds.md), levels).

## What could be better

- The tone is still a little cleaner than the recordings (5.3 dB of line over
  floor against 3-5), and its pulses scale with the revs, where a real
  combustion's ring stays at a fixed frequency.
- The profiles were matched to mostly American and archive recordings. A
  recording of a Czech mainline diesel (a ČKD V12) or of an air-cooled V8
  truck would pin the `mainline` and `truck` profiles down.
- The exhaust has no pass-by (Doppler, distance): the game places the listener.
