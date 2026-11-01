// Entry of the synth bundle the generator exports as export/synth/synth.js
// for the game (docs/music/synth.md, docs/music/sounds.md).
export { Player, type PlayerOptions, flatten, nearestSample } from "./player.ts";
export { INSTRUMENTS, type SampleManifest } from "./instruments.ts";
export { type Performance, type Track, barAt, secondsToTick, tickToSeconds } from "../lib/performance.ts";
export { playSound, soundBuffer } from "./sounds.ts";
export { SOUNDS, type SoundDef, type SoundVariant, renderSound } from "../lib/sfx/sounds.ts";
