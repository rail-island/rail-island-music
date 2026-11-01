// The sound effects catalog (docs/music/sounds.md): train sounds for five
// kinds of train and the Czech tram bell, each in a few situations
// ("variants"). renderSound computes one as stereo samples, deterministically:
// the generator, the site and the game get the same sound from the same call.
// Sound ids are permanent once published, like piece ids.

import { type Stereo, curve, finish } from "./dsp.ts";
import { type Consist, type Motion, emptyStereo, motion, placeJoints, placePoint, placeRolling, trainLength } from "./scene.ts";
import {
  dieselEngine,
  dieselHorn,
  modernElectricEngine,
  oldElectricEngine,
  shinkansenEngine,
  steamEngine,
  steamWhistle,
  tramBell,
  twoToneHorn,
} from "./sources.ts";

export type VariantId = "depart" | "pass" | "horn" | "warning";

export interface SoundVariant {
  id: VariantId;
  title: string;
}

export interface SoundDef {
  id: string;
  title: string;
  description: string;
  variants: SoundVariant[];
}

/** One kind of train: what it is, how it moves and the parts that make its sound. */
interface Train {
  def: SoundDef;
  consist: Consist;
  /** m/s^2 pulling away, and the speed it passes at (m/s). */
  accel: number;
  passSpeed: number;
  /** Jointed track (the "ta-tam"); high-speed lines are welded. */
  joints: boolean;
  roll: { low: number; high: number; speedRef: number; gain: number };
  /** Where the engine sits behind the front (m) and how loud it is. */
  engineAt: number;
  engineGain: number;
  engine(m: Motion, throttle: (t: number) => number, startAt: number, rate: number): Float32Array;
  horn?: { seconds: number; gain: number; make(rate: number): Float32Array };
}

const DEPART: SoundVariant = { id: "depart", title: "Pulls away" };
const PASS: SoundVariant = { id: "pass", title: "Passes by" };
const HORN: SoundVariant = { id: "horn", title: "Horn" };

const TRAINS: Train[] = [
  {
    def: {
      id: "steam-locomotive",
      title: "Steam locomotive",
      description: "An express steam engine: whistle, cylinder cocks and the chuffs speeding up.",
      variants: [DEPART, PASS, { id: "horn", title: "Whistle" }],
    },
    consist: { front: 22, cars: 6, carLength: 20 },
    accel: 0.3,
    passSpeed: 24,
    joints: true,
    roll: { low: 60, high: 2500, speedRef: 25, gain: 0.18 },
    engineAt: -4,
    engineGain: 1,
    engine: (m, thr, startAt, rate) => steamEngine(m, thr, startAt, rate, 11),
    horn: { seconds: 1.8, gain: 0.5, make: (rate) => steamWhistle(1.8, rate, 12) },
  },
  {
    def: {
      id: "diesel-locomotive",
      title: "Diesel locomotive",
      description: "A diesel-electric locomotive: the engine revving up from idle, a turbocharger, an air horn.",
      variants: [DEPART, PASS, HORN],
    },
    consist: { front: 18, cars: 8, carLength: 24 },
    accel: 0.4,
    passSpeed: 28,
    joints: true,
    roll: { low: 50, high: 2500, speedRef: 28, gain: 0.2 },
    engineAt: -9,
    engineGain: 1,
    engine: (m, thr, _s, rate) => dieselEngine(m, thr, rate, 21),
    horn: { seconds: 1.6, gain: 0.55, make: (rate) => dieselHorn(1.6, rate, 22) },
  },
  {
    def: {
      id: "electric-locomotive",
      title: "Old electric locomotive",
      description: "A DC electric locomotive of the 1950s-1980s: blowers, a thumping compressor, the controller clacking notch by notch, gears whining.",
      variants: [DEPART, PASS, HORN],
    },
    consist: { front: 17, cars: 8, carLength: 24 },
    accel: 0.45,
    passSpeed: 30,
    joints: true,
    roll: { low: 50, high: 2800, speedRef: 30, gain: 0.2 },
    engineAt: -8,
    engineGain: 0.9,
    engine: (m, thr, startAt, rate) => oldElectricEngine(m, thr, startAt, rate, 31),
    horn: { seconds: 0.7, gain: 0.5, make: (rate) => twoToneHorn([311, 370], 0.7, rate, 32) },
  },
  {
    def: {
      id: "modern-electric",
      title: "Modern electric train",
      description: "A three-phase electric train like an ICE: the converters' cluster of high tones pulling out, quiet at speed.",
      variants: [DEPART, PASS, HORN],
    },
    consist: { front: 19, cars: 8, carLength: 26 },
    accel: 0.5,
    passSpeed: 40,
    joints: false,
    roll: { low: 60, high: 3000, speedRef: 40, gain: 0.2 },
    engineAt: -9,
    engineGain: 0.9,
    engine: (m, thr, _s, rate) => modernElectricEngine(m, thr, rate, 41),
    horn: { seconds: 0.6, gain: 0.5, make: (rate) => twoToneHorn([659, 554], 0.6, rate, 42) },
  },
  {
    def: {
      id: "shinkansen",
      title: "Shinkansen",
      description: "A Japanese high-speed train: a soft inverter whine pulling out, the roar of 400 metres of train at 270 km/h.",
      variants: [DEPART, PASS],
    },
    consist: { front: 27, cars: 15, carLength: 25 },
    accel: 0.7,
    passSpeed: 75,
    joints: false,
    roll: { low: 70, high: 3500, speedRef: 75, gain: 0.55 },
    engineAt: -12,
    engineGain: 0.6,
    engine: (m, _thr, _s, rate) => shinkansenEngine(m, rate, 51),
  },
];

const TRAM_BELL: SoundDef = {
  id: "tram-bell",
  title: "Tram bell",
  description: "The bell of a Czech Tatra tram: two short rings before it leaves the stop, or one long ring as a warning.",
  variants: [
    { id: "depart", title: "Before departure" },
    { id: "warning", title: "Warning" },
  ],
};

export const SOUNDS: SoundDef[] = [...TRAINS.map((t) => t.def), TRAM_BELL];

export const SAMPLE_RATE = 32000;

/** Compute a sound; throws on an unknown id or variant. */
export function renderSound(id: string, variant: string, rate = SAMPLE_RATE): Stereo {
  if (id === TRAM_BELL.id) return renderTramBell(variant, rate);
  const train = TRAINS.find((t) => t.def.id === id);
  if (!train) throw new Error(`No sound ${id}`);
  if (!train.def.variants.some((v) => v.id === variant)) throw new Error(`Sound ${id} has no variant ${variant}`);
  if (variant === "depart") return depart(train, rate);
  if (variant === "pass") return pass(train, rate);
  return horn(train, rate);
}

/** Zero-padded copy of `src` starting `at` seconds into a buffer of `n` samples. */
function delayed(src: Float32Array, at: number, n: number, rate: number): Float32Array {
  const out = new Float32Array(n);
  const s = Math.floor(at * rate);
  for (let i = 0; i < src.length && s + i < n; i++) out[s + i] = src[i]!;
  return out;
}

/** The train stands beside the platform, sounds its horn, and pulls away; the listener stays. */
function depart(t: Train, rate: number): Stereo {
  const duration = 24;
  const startAt = t.horn ? 3 : 1.5;
  const ramp = 1.2;
  const speed = (x: number) => {
    if (x < startAt) return 0;
    const e = x - startAt;
    const v = e < ramp ? (t.accel * e * e) / (2 * ramp) : t.accel * (e - ramp / 2);
    return Math.min(v, t.passSpeed);
  };
  const m = motion(6, speed, duration);
  const thr = curve([
    [0, 0.1],
    [startAt - 0.4, 0.1],
    [startAt, 1],
  ]);
  const out = emptyStereo(duration, rate);
  const distance = 5;
  placePoint(out, t.engine(m, thr, startAt, rate), m, t.engineAt, distance, t.engineGain);
  if (t.horn) placePoint(out, delayed(t.horn.make(rate), 0.6, Math.ceil(duration * rate), rate), m, -2, distance, t.horn.gain);
  placeRolling(out, m, t.consist, distance, t.roll.gain * 0.6, { ...t.roll, seed: 3 });
  if (t.joints) placeJoints(out, m, t.consist, distance, 0.35);
  return finish(out, -1, 0.05, 1.2);
}

/** The train comes from the left, sounds its horn, passes the listener at full speed and runs off to the right. */
function pass(t: Train, rate: number): Stereo {
  const v = t.passSpeed;
  const approach = 9;
  const len = trainLength(t.consist);
  const duration = approach + len / v + 6;
  const m = motion(-v * approach, () => v, duration);
  const out = emptyStereo(duration, rate);
  const distance = 12;
  placePoint(out, t.engine(m, () => 0.75, -10, rate), m, t.engineAt, distance, t.engineGain);
  if (t.horn) placePoint(out, delayed(t.horn.make(rate), approach - 4, Math.ceil(duration * rate), rate), m, -2, distance, t.horn.gain);
  placeRolling(out, m, t.consist, distance, t.roll.gain, { ...t.roll, seed: 4 });
  if (t.joints) placeJoints(out, m, t.consist, distance, 0.5);
  return finish(out, -1, 0.3, 1.5);
}

/** The train stands idling a little way off and sounds its horn. */
function horn(t: Train, rate: number): Stereo {
  const h = t.horn!;
  const duration = h.seconds * 2 + 0.6 + 2.5;
  const m = motion(14, () => 0, duration);
  const out = emptyStereo(duration, rate);
  const distance = 8;
  placePoint(out, t.engine(m, () => 0.1, duration, rate), m, t.engineAt, distance, t.engineGain * 0.5);
  placePoint(out, delayed(h.make(rate), 0.5, Math.ceil(duration * rate), rate), m, -2, distance, h.gain);
  return finish(out, -1, 0.2, 0.8);
}

function renderTramBell(variant: string, rate: number): Stereo {
  let presses: [number, number][];
  if (variant === "depart") presses = [
    [0.15, 0.42],
    [0.66, 0.95],
  ];
  else if (variant === "warning") presses = [[0.15, 2.95]];
  else throw new Error(`Sound tram-bell has no variant ${variant}`);
  const bell = tramBell(presses, 1.4, rate, 61);
  const n = bell.length;
  const out: Stereo = { left: new Float32Array(n), right: new Float32Array(n), rate };
  // The bell under the tram's front, a little to the left; two early reflections from the street.
  const refl = [
    { d: 0.017, gl: 0.0, gr: 0.32 },
    { d: 0.029, gl: 0.25, gr: 0.0 },
    { d: 0.047, gl: 0.12, gr: 0.16 },
  ];
  for (let i = 0; i < n; i++) {
    let l = bell[i]! * 0.85;
    let r = bell[i]! * 0.55;
    for (const e of refl) {
      const j = i - Math.floor(e.d * rate);
      if (j >= 0) {
        l += bell[j]! * e.gl;
        r += bell[j]! * e.gr;
      }
    }
    out.left[i] = l;
    out.right[i] = r;
  }
  return finish(out, -1, 0.002, 0.3);
}
