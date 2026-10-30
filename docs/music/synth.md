# Synth

**Covers** - the WebAudio synth that plays note data on the site and, later, in the game: the instruments, the sample set, scheduling, the Player API and offline rendering.
**Code** - `synth/player.ts`, `synth/instruments.ts`, `synth/index.ts`, `samples/`, `generator/prepareSamples.ts`, `generator/renderAudio.ts`
**See also** - [export.md](export.md), [arrangement.md](arrangement.md)

## Instruments

`INSTRUMENTS` in `synth/instruments.ts` is the one place an instrument's sound
is tuned:

| Id | Kind | Notes |
|---|---|---|
| `piano`, `tuba`, `bass` | sampled | the sample plays out, faded on release |
| `clarinet`, `trumpet`, `trombone` | sampled, looping | a note longer than the sample loops its middle |
| `drums` | drum samples | bass drum, snare, ride, crash; the hi-hat is filtered noise |
| `square`, `pulse`, `triangle` | oscillator | chiptune voices; `pulse` is a 25 % pulse wave |
| `noise` | generated drums | a falling sine for the bass drum, filtered noise for the rest |

A pitched note plays the nearest recorded pitch re-pitched by playback rate
(at most a few semitones; every ensemble range lies within the recordings).
Velocity maps to gain as `(v / 127)^1.6`, times the instrument's level and the
track's gain; each track has its own stereo panner. The mix goes through a
compressor and a short generated reverb.

## Samples

`samples/<instrument>/<midi>.mp3` and `samples/drums/<name>.mp3`, about
1.4 MB, cut from **VS Chamber Orchestra: Community Edition** (CC0;
`samples/SOURCES.md` lists every file). `generator/prepareSamples.ts` rebuilds
them from a VSCO 2 CE checkout: trim to the onset, fixed length with a fade,
mono 32 kHz, peak -1 dBFS, MP3 80 kbit/s. VSCO names its files one octave lower
than scientific pitch; the script corrects it (checked by pitch detection).
The generator writes `samples.json`: `{ pitched: { <instrument>: [midi...] },
drums: { "<GM number>": "<name>" } }`.

## Player

```ts
const player = new Player({ samplesUrl: "/samples/" });
await player.play(perf, fromSeconds); // from a user gesture: browsers start audio only then
player.pause();                        // keeps the position
player.stop();                         // rewinds
player.position;                       // seconds
player.setVolume(0.8);
player.onEnded = () => {};
```

`prepare(perf)` loads only the samples the performance uses. Notes are
scheduled 250 ms ahead from a 40 ms timer, so a long piece never holds thousands
of nodes at once. With an `OfflineAudioContext`, `render(perf)` schedules every
note at once and returns the rendered buffer; `generator/renderAudio.ts` uses it
to write a piece to WAV or MP3 headlessly.
