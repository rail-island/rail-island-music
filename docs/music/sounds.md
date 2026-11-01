# Sound effects

**Covers** - the train sounds and the tram bell: the catalog and its variants, how a sound is computed (sources, the listener's scene), the reference recordings each is tuned to, playing them, rendering them to files, adding a sound.
**Code** - `lib/sfx/dsp.ts`, `lib/sfx/scene.ts`, `lib/sfx/sources.ts`, `lib/sfx/sounds.ts`, `synth/sounds.ts`, `generator/renderSound.ts`, `sounds/`, `test/sounds.test.ts`
**See also** - [synth.md](synth.md), [export.md](export.md), [../site/catalog-site.md](../site/catalog-site.md)

The sounds are **computed, not recorded**: plain TypeScript in `lib/sfx/`
turns a few numbers into stereo samples, deterministically (seeded noise
only), so the generator, the tests, the site and the game get the same sound
from the same call and nothing has to be downloaded to play one. Each model
is tuned to real recordings kept in `sounds/<id>/` (below).

## Catalog

`SOUNDS` in `lib/sfx/sounds.ts`. Sound ids are permanent once published, like
piece ids.

| Id | What | Variants |
|---|---|---|
| `steam-locomotive` | express steam engine | `depart`, `pass`, `horn` (the whistle) |
| `diesel-locomotive` | diesel-electric locomotive | `depart`, `pass`, `horn` |
| `electric-locomotive` | old DC electric with resistor control | `depart`, `pass`, `horn` |
| `modern-electric` | three-phase electric train (ICE-like) | `depart`, `pass`, `horn` |
| `shinkansen` | Japanese high-speed train | `depart`, `pass` |
| `tram-bell` | the bell of a Czech Tatra tram | `depart` (two short rings, as before leaving a stop), `warning` (one long ring) |

- `depart` (24 s): the train stands beside the platform (the listener 5 m
  away), sounds its horn, and pulls away; its cars roll past the listener.
- `pass` (20-23 s): it comes from the left at full speed, sounds its horn
  four seconds out, passes 12 m away and runs off to the right.
- `horn`: it idles 14 m down the track and sounds its horn.

## How a sound is made

**Sources** (`sources.ts`) are what each train emits, as functions of its
motion and throttle:

| Train | Model |
|---|---|
| steam | four chuffs per turn of 1.75 m driving wheels, uneven by beat, bursts of filtered noise shortening with speed; cylinder-cock hiss on the first beats; whistle = the four measured partials |
| diesel | the engine's harmonic ladder at 9 rev/s idling to 19 at full power, with a formant at 11x the rotation; exhaust pulses at 6x; a turbocharger whine with the boost; a three-note air horn |
| old electric | blowers (noise and a 290 Hz blade tone), a compressor thumping while it stands, controller notches every 1.1-1.4 s while it accelerates, gear whine at the mesh frequency (79 teeth, 1.25 m wheels) and its octave, brush noise; a two-tone horn |
| modern electric | the measured cluster of converter tones (1180-3070 Hz) rising 8 % as it accelerates, the constant 620 Hz auxiliary converter, gear tone, fans |
| shinkansen | inverter whine rising with speed and fading at speed, pantograph hiss with the cube of speed |
| tram bell | a 50 Hz hammer striking five two-pole resonators at the measured partials |

**The scene** (`scene.ts`) is a straight track with the listener beside it.
A point source on the train (`placePoint`) is heard with its travel delay -
so with the Doppler shift - at 1/r, duller with distance, panned by where it
is. `placeRolling` is the rolling (and, fast, aerodynamic) noise of the whole
length of the train: the 1/r^2 integral over the train, times speed^1.3, so a
long fast train gives the flat roar of a pass-by. `placeJoints` adds a click
for every axle crossing a rail joint every 25 m ("ta-tam"); the modern
electric and the Shinkansen run on welded rail without them. `finish`
normalises to -1 dBFS and fades the ends.

## Reference recordings (`sounds/<id>/`)

Every sound's folder holds the recordings it was tuned to, cut to the part
used, and a `SOURCES.md` with the original's URL, author, licence and cut,
**what was measured** and what was modelled without a measurement. They are
references only: nothing from them is played or exported. All are CC0, Public
Domain Mark or CC BY, from archive.org (SSE Library, Red Library, radio aporee
field recordings).

| Sound | Reference | Measured |
|---|---|---|
| steam | SSE "starts and pulls away", SSE whistle | chuffs 3/s to 10/s; whistle partials 516, 1446, 2080, 2497 Hz |
| diesel | Red Library air horn; class 757 leaving Banska Bystrica | horn 296, 445, 740 Hz; engine ladder 9 Hz spaced, 100 Hz idle to 220-250 Hz pulling |
| old electric | Kosice station (an electric idling) | blower level only - the rest is not checked against a recording |
| modern electric | ICE leaving Berlin Hbf | converter tones 1180, 1830, 2420, 2750, 3070 Hz, +8 %; 620 Hz |
| shinkansen | Odawara, a train passing without stopping | a ~6 s flat block of broadband noise below 1.2 kHz |
| tram bell | Tatra KT4DM, Frankfurt (Oder) | partials 1565, 3647, 6230, 9295, 12452 Hz and their levels; 50 strikes/s; a 2.8 s steady ring |

## Playing

```ts
import { playSound, SOUNDS } from "/synth/synth.js";
const src = playSound(audioContext, "tram-bell", "depart", { volume: 0.8 });
src.stop(); // to cut it short
```

`soundBuffer(ctx, id, variant)` computes the AudioBuffer at the context's
rate the first time (0.1-0.5 s for a train at 48 kHz) and keeps it per
context. `renderSound(id, variant, rate)` gives the raw stereo samples. The
export writes the catalog to `sounds/sounds.json`; the samples themselves are
computed where they play.

## Rendering to files

```bash
pnpm exec tsx generator/renderSound.ts tram-bell depart /tmp/bell.mp3
```

```bash
pnpm exec tsx generator/renderSound.ts --all /tmp/sounds
```

No browser is needed; MP3 needs ffmpeg.

## Tests

`test/sounds.test.ts`: every sound has its `SOURCES.md` listing every file in
its folder; every variant renders (at 8 kHz for speed) finite, normalised and
2-40 s long; rendering is deterministic; the tram bell rings the measured
partials at the measured levels; the steam engine makes four chuffs per wheel
turn; the Shinkansen pass is loudest while the train is beside the listener.

## Adding a sound

1. Find recordings under CC0, a public-domain mark or CC BY (CC BY-SA is
   acceptable for a reference, since it is never shipped). Download them,
   cut the useful part into `sounds/<id>/` and write its `SOURCES.md`: URL,
   author, licence, cut, what you measured and what you did not.
2. Measure what the model needs (spectra, rates, envelopes) and write the
   source in `sources.ts`, citing the measurement in its comment.
3. Add it to `SOUNDS` in `sounds.ts` and to the table above; render it with
   `renderSound.ts` and compare its spectrogram with the reference.
