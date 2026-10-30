# Sample sources

Every file in this folder is cut from **VS Chamber Orchestra: Community Edition
(VSCO 2 CE)** by Versilian Studios: https://github.com/sgossner/VSCO-2-CE
(master branch), recorded by Sam Gossner and Simon Dalzell, sample cutting by
Elan Hickler / Soundemote; the upright piano was sampled by Simon Dalzell of Ivy
Audio. Licence: **CC0 1.0 Universal** (the repository's `LICENSE`). Credit to the
authors and Versilian Studios is encouraged, not required.

`generator/prepareSamples.ts` lists the exact source file of every sample and
does the processing: trim to the onset, cut to a fixed length with a fade, mono,
32 kHz, peak -1 dBFS, MP3 80 kbit/s. The pitched files are named after the MIDI
pitch they sound at (checked by pitch detection: VSCO's file names are one
octave lower than scientific pitch).

| Folder | VSCO source | Use |
|---|---|---|
| `piano/` | Keys/Upright Piano, dynamic 2 | piano, every 8 semitones from MIDI 29 to 93 |
| `bass/` | Strings/Solo Contrabass/Pizz, v1 | jazz band double bass |
| `trumpet/` | Brass/Trumpet/sus, v3 | trumpet lead |
| `trombone/` | Brass/Tenor Trombone/sus, v2 | trombone, brass band horns |
| `tuba/` | Brass/Tuba/stac, v2 | oom-pah bass |
| `clarinet/` | Woodwinds/Clarinet/susLong, v2 | clarinet |
| `drums/kick.mp3` | VSCO 1 Percussion/drums/bass/bdrum_f_1.wav | bass drum (GM 36) |
| `drums/snare.mp3` | VSCO 1 Percussion/drums/snare/drum1/snare1_f_1.wav | snare (GM 38) |
| `drums/ride.mp3` | VSCO 1 Percussion/varMetal/Cymbals/susp/susp_hit_metal_2_mf.wav | ride (GM 51) |
| `drums/crash.mp3` | VSCO 1 Percussion/varMetal/Cymbals/clash/crash_hit_mp_loose.wav | crash (GM 49) |

The closed hi-hat (GM 42) has no sample; the synth makes it from filtered noise.
