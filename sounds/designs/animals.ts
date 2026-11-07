// Draft animals (docs/sounds/animals.md): the hoof beat of a team pulling a tram,
// a coach or a wagon (`hoof-beat`, a loop the game drives from the vehicle's
// speed) and the animal's call (`animal-call`, a one-shot the player's Horn
// plays). The factory pins each team's character on its vehicles (game.sounds):
// the foot, the animal's size, its stride and the team's count; the game sets
// the footfall `rate` from the speed.
//
// Matched to CC0 recordings of the USC Cinema / Sunset Editorial collection on
// archive.org (src/references.ts). Measured from them:
// - a shod horse on hard ground (walking on pavement, trotting on stone, two
//   horses pulling a wagon): the knock of the hoof wall between 540 and 770 Hz
//   (the loudest band of a footfall), a sharp click above 2.5 kHz (a footfall's
//   centroid 2.6 kHz on pavement), a weight thud near 110-200 Hz, and a footfall
//   that falls 20 dB in about 90 ms on stone;
// - the walk's four nearly even footfalls about 0.3 s apart, and the trot's
//   diagonal pairs landing 45-60 ms apart;
// - the tack's jingle, a band near 3 kHz about 20 dB under the hooves, and a
//   harness bell near 5.3 kHz on an ox cart;
// - an ox's cloven feet: darker (centroid about 700 Hz, most of it under 400 Hz)
//   with many double knocks;
// - the calls' pitch and shape (see each species in CALLS).
// Modelled without a measurement: the padded feet of the camel and the
// elephant (no recording of either walking was found), the claws' spacing in a
// cloven footfall, how `size` scales a footfall, the creak of the traces, the
// donkey's and the mule's calls (the one CC0 bray found, on Wikimedia Commons,
// could not be downloaded) and the timing scatter of a team.

import { LEVEL, filter, gain, loop, noiseSource, num, choice, oneShot, seeded, voiceOf } from "../nodes.ts";
import type { LoopVoice, SoundParam, SoundValues } from "../types.ts";

// ---------------------------------------------------------------------------
// The hoof beat

/** The kinds of foot, as the factory pins them per species. */
export const FEET = ["hoof", "cloven", "padded"] as const;
export type Foot = (typeof FEET)[number];

/** How one kind of foot strikes the ground, at `size` 0.5. */
export interface FootProfile {
  /** The sharp click of a hard hoof on stone, band-passed noise. */
  click: number;
  clickHz: number;
  /** The knock of the hoof wall: narrow band-passed noise, the clop. */
  knock: number;
  knockHz: number;
  knockQ: number;
  /** The weight landing: a low sine falling from 1.5x to its pitch. */
  thud: number;
  thudHz: number;
  /** Seconds for a footfall to ring out (60 dB). */
  decay: number;
  /** Seconds between the two claws of a cloven foot; 0 for one strike. */
  claws: number;
  /** The harness: tack jingle and trace creak, relative to a footfall. */
  jingle: number;
  creak: number;
}

export const FOOT_PROFILES: Readonly<Record<Foot, FootProfile>> = {
  // A shod horse on hard ground, measured: knock 540-770 Hz, click above 2.5 kHz, -20 dB in 90 ms.
  hoof: { click: 0.8, clickHz: 3200, knock: 1, knockHz: 650, knockQ: 4, thud: 0.2, thudHz: 140, decay: 0.27, claws: 0, jingle: 0.1, creak: 0.04 },
  // Cloven feet, measured on an ox cart: darker, mostly under 400 Hz, a double knock.
  cloven: { click: 0.4, clickHz: 2200, knock: 1, knockHz: 480, knockQ: 2.5, thud: 0.45, thudHz: 115, decay: 0.3, claws: 0.022, jingle: 0.09, creak: 0.05 },
  // Padded feet, modelled: a soft thud and a shuffle, almost no click.
  padded: { click: 0.1, clickHz: 900, knock: 0.8, knockHz: 300, knockQ: 0.8, thud: 1, thudHz: 85, decay: 0.42, claws: 0, jingle: 0, creak: 0.035 },
};

/** A footfall's pitch factor at a `size`: a donkey (0) half an octave up, an elephant (1) most of an octave down. */
export function footPitch(size: number): number {
  return Math.pow(2, -(size - 0.5) * 1.6);
}

/** How long a footfall rings at a `size`: the heavier, the longer. */
export function footDecay(foot: Foot, size: number): number {
  return FOOT_PROFILES[foot].decay * (0.7 + 0.8 * size);
}

/**
 * Where in a gait cycle (0..1) each of the four feet lands, at `rate` footfalls
 * per second of one animal. A walk is four beats, the pairs a little uneven (the
 * hind foot follows the fore foot of its side sooner than the next fore foot
 * follows it); a trot is two beats of diagonal pairs that land nearly together
 * (45-60 ms apart, measured). Between 3.5 and 6 footfalls a second it blends.
 */
export function gaitOffsets(rate: number): [number, number, number, number] {
  const walk = [0, 0.26, 0.5, 0.76];
  const trot = [0, 0.07, 0.5, 0.57];
  const k = Math.max(0, Math.min(1, (rate - 3.5) / 2.5));
  return walk.map((w, i) => w + (trot[i]! - w) * k) as [number, number, number, number];
}

/** One animal of a team: where in the cycle it walks, and its own small differences. */
interface Animal {
  /** Its phase in the cycle, 0..1: the lead animal 0. */
  phase: number;
  /** Its pitch and level against the profile. */
  pitch: number;
  level: number;
  /** Its own seeded scatter of footfall timing. */
  rnd: () => number;
}

/** The team's animals: the first leads, the others walk out of step by seeded amounts. */
export function teamAnimals(count: number): Animal[] {
  const out: Animal[] = [];
  for (let k = 0; k < count; k++) {
    const r = seeded(0x686f6f66 + k * 7919);
    out.push({
      phase: k === 0 ? 0 : 0.12 + 0.76 * r(),
      pitch: k === 0 ? 1 : 0.93 + 0.14 * r(),
      level: k === 0 ? 1 : 0.8 + 0.2 * r(),
      rnd: seeded(0x7374657 + k * 104729),
    });
  }
  return out;
}

/** The attack every footfall's thud rises with, s: one rise per footfall (tests count them). */
export const THUD_ATTACK = 0.0012;
const STRIKE_ATTACK = 0.0006;
/** A team's footfalls scatter by up to this much of their gap, either way. */
export const TEAM_SCATTER = 0.06;
const MAX_COUNT = 6;
/** The hoof beat's loudness trim: a walking horse about as loud as a steam engine's beat. */
export const HOOF_TRIM = 0.14;

const RATE: SoundParam = { name: "rate", title: "Footfalls per second", kind: "number", min: 0, max: 16, step: 0.1, default: 3, unit: "/s" };
const FOOT: SoundParam = {
  name: "foot",
  title: "Foot",
  kind: "choice",
  values: [
    { value: "hoof", title: "Hooves (horse, donkey, mule)" },
    { value: "cloven", title: "Cloven hooves (cow, ox)" },
    { value: "padded", title: "Padded feet (camel, elephant)" },
  ],
  default: "hoof",
};
const SIZE: SoundParam = { name: "size", title: "Size", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 };
const STRIDE: SoundParam = { name: "stride", title: "Stride", kind: "number", min: 0.5, max: 3, step: 0.05, default: 1.4, unit: "m" };
const COUNT: SoundParam = { name: "count", title: "Team", kind: "number", min: 1, max: MAX_COUNT, step: 1, default: 1 };

/** The footfall rate the game sets for a speed: four footfalls per stride of one animal. */
export function hoofRate(speed: number, stride: number): number {
  return stride > 0 ? (4 * Math.max(0, speed)) / stride : 0;
}

/** Each animal's share of the team's level: more animals are louder, but not by their number. */
export function teamShare(count: number): number {
  return Math.pow(Math.max(1, count), -0.7);
}

/**
 * A draft team walking or trotting: every animal's four footfalls per cycle at
 * `rate` footfalls a second, each a knock, a click and a thud in the character
 * of its `foot` and `size`, the animals out of step with one another, the
 * harness jingling and creaking quietly. Silent at `rate` 0.
 */
export const hoofBeat = /* @__PURE__ */ loop({
  id: "hoof-beat",
  title: "Hoof beat",
  category: "animals",
  description: "A draft team's footfalls: hooves, cloven hooves or padded feet at the rate its speed gives, one to six animals out of step, with the harness jingling; silent while it stands.",
  params: [RATE, FOOT, SIZE, STRIDE, COUNT, LEVEL],
  start(ctx, dest, t, initial): LoopVoice {
    const out = gain(ctx, num(initial, "level") * HOOF_TRIM);
    out.connect(dest);
    const sources: AudioScheduledSourceNode[] = [];
    const noise = noiseSource(ctx, true);
    noise.start(t);
    sources.push(noise);

    // One lane per animal: its own click, knock and thud, so footfalls of
    // different animals never cut one another short.
    interface Lane {
      animal: Animal;
      clickBp: BiquadFilterNode;
      click: GainNode;
      knockBp: BiquadFilterNode;
      knock: GainNode;
      thudOsc: OscillatorNode;
      thud: GainNode;
      /** When its next footfall lands, and where it would land without the scatter. */
      next: number;
      grid: number;
      foot: number;
    }
    const lanes: Lane[] = [];
    const animals = teamAnimals(MAX_COUNT);
    const addLane = (at: number): void => {
      const animal = animals[lanes.length]!;
      const clickBp = filter(ctx, "bandpass", 3000, 1.2);
      const click = gain(ctx);
      noise.connect(clickBp).connect(click).connect(out);
      const knockBp = filter(ctx, "bandpass", 650, 4);
      const knock = gain(ctx);
      noise.connect(knockBp).connect(knock).connect(out);
      const thudOsc = ctx.createOscillator();
      thudOsc.type = "sine";
      const thud = gain(ctx);
      thudOsc.connect(thud).connect(out);
      thudOsc.start(at);
      sources.push(thudOsc);
      lanes.push({ animal, clickBp, click, knockBp, knock, thudOsc, thud, next: at, grid: at, foot: 0 });
    };

    // The harness, shared by the team: the tack's jingle (two resonant bands,
    // measured near 3.1 and 5.3 kHz) and the traces' creak (a slow stick-slip
    // buzz through a band).
    const jingle = gain(ctx);
    for (const [hz, level] of [[3100, 1], [5300, 0.6]] as const) {
      const bp = filter(ctx, "bandpass", hz, 18);
      const g = gain(ctx, level * 6);
      noise.connect(bp).connect(g).connect(jingle);
    }
    jingle.connect(out);
    const creakOsc = ctx.createOscillator();
    creakOsc.type = "sawtooth";
    creakOsc.frequency.value = 38;
    const creakBp = filter(ctx, "bandpass", 1100, 2.5);
    const creak = gain(ctx);
    creakOsc.connect(creakBp).connect(creak).connect(out);
    creakOsc.start(t);
    sources.push(creakOsc);
    const harness = seeded(0x6a696e67);

    let v: SoundValues = initial;
    let moving = false;
    for (let i = 0; i < Math.round(num(v, "count")); i++) addLane(t);
    const base = voiceOf(out, sources, Infinity);
    let stopped = false;

    /** Strike one lane's footfall at `at`. */
    const footfall = (lane: Lane, at: number, accent: number): void => {
      const foot = choice(v, "foot") as Foot;
      const p = FOOT_PROFILES[foot];
      const size = num(v, "size");
      const pitch = footPitch(size) * lane.animal.pitch;
      const decay = footDecay(foot, size);
      const share = teamShare(lanes.length) * lane.animal.level * accent;
      const weight = 0.6 + 0.8 * size;
      lane.clickBp.frequency.setValueAtTime(p.clickHz * Math.sqrt(pitch), at);
      lane.knockBp.frequency.setValueAtTime(p.knockHz * pitch, at);
      lane.knockBp.Q.setValueAtTime(p.knockQ, at);
      const strikes = p.claws > 0 ? [0, p.claws * (0.7 + 0.6 * size)] : [0];
      strikes.forEach((d, i) => {
        const s = at + d;
        const l = share * (i === 0 ? 1 : 0.65);
        lane.click.gain.setTargetAtTime(p.click * l * 2.2, s, STRIKE_ATTACK);
        lane.click.gain.setTargetAtTime(0, s + 0.002, 0.012);
        lane.knock.gain.setTargetAtTime(p.knock * l * 5, s, STRIKE_ATTACK);
        lane.knock.gain.setTargetAtTime(0, s + 0.003, decay / 6.9);
      });
      lane.thudOsc.frequency.setValueAtTime(p.thudHz * pitch * 1.5, at);
      lane.thudOsc.frequency.setTargetAtTime(p.thudHz * pitch, at + 0.001, 0.012);
      lane.thud.gain.setTargetAtTime(p.thud * share * weight * 0.8, at, THUD_ATTACK);
      lane.thud.gain.setTargetAtTime(0, at + 0.006, (decay * 0.8) / 6.9);
      // Now and then the tack jingles: a few rings shaken loose by the step.
      if (p.jingle > 0 && harness() < 0.35) {
        const n = 2 + Math.floor(harness() * 3);
        for (let i = 0; i < n; i++) {
          const s = at + 0.01 + i * (0.018 + 0.02 * harness());
          jingle.gain.setTargetAtTime(p.jingle * share * (1 - i * 0.2), s, 0.001);
          jingle.gain.setTargetAtTime(0, s + 0.003, 0.03);
        }
      }
    };

    return {
      endsAt: Infinity,
      stop(at) {
        stopped = true;
        base.stop(at);
      },
      set(values) {
        v = values;
      },
      tick(now, horizon) {
        if (stopped) return;
        const rate = num(v, "rate");
        const count = Math.round(num(v, "count"));
        if (rate <= 0) {
          moving = false;
          return;
        }
        while (lanes.length < count) addLane(now);
        const team = lanes.slice(0, count);
        const cycle = 4 / rate;
        if (!moving) {
          // Setting off: each animal enters the cycle at its own phase.
          moving = true;
          for (const lane of team) {
            lane.grid = now + lane.animal.phase * cycle;
            lane.next = lane.grid;
            lane.foot = 0;
          }
        }
        for (const lane of team) {
          if (lane.grid < now) lane.grid = now;
          if (lane.next < now) lane.next = now;
        }
        const offsets = gaitOffsets(rate);
        const p = FOOT_PROFILES[choice(v, "foot") as Foot];
        // The team's footfalls in time order, earliest first.
        for (;;) {
          let lane: Lane | undefined;
          for (const l of team) if (l.next < now + horizon && (!lane || l.next < lane.next)) lane = l;
          if (!lane) break;
          const at = lane.next;
          // The fore feet land a little harder than the hind feet.
          footfall(lane, at, lane.foot % 2 === 0 ? 1 : 0.8);
          if (lane === team[0] && lane.foot === 0 && p.creak > 0) {
            creak.gain.setTargetAtTime(p.creak * 0.6, at + 0.05, 0.06);
            creak.gain.setTargetAtTime(0, at + 0.2, 0.06);
          }
          const from = offsets[lane.foot]!;
          lane.foot = (lane.foot + 1) % 4;
          const to = lane.foot === 0 ? 1 : offsets[lane.foot]!;
          const gap = (to - from) * cycle;
          // Each footfall scatters around the animal's own beat, never drifting
          // off it: the team stays out of step rather than falling into one.
          const scatter = team.length > 1 ? (lane.animal.rnd() * 2 - 1) * TEAM_SCATTER : 0;
          lane.grid += gap;
          lane.next = Math.max(at + 0.005, lane.grid + gap * scatter);
        }
      },
    };
  },
});

// ---------------------------------------------------------------------------
// The animal call

/** The species the call can be, as the factory pins them. */
export const SPECIES = ["horse", "donkey", "mule", "cow", "camel", "elephant"] as const;
export type Species = (typeof SPECIES)[number];

/** A pitch contour or an envelope: [seconds from the start, value] points, ramped linearly. */
type Curve = ReadonlyArray<readonly [number, number]>;

/** One sounding part of a call: a source whose pitch follows `pitch`, through formants, under `amp`. */
export interface CallPart {
  wave: OscillatorType;
  pitch: Curve;
  amp: Curve;
  /** Band-pass formants: [Hz, Q, level]; none for the bare source through `lowpass`. */
  formants: ReadonlyArray<readonly [number, number, number]>;
  /** A low-pass over the part, Hz; a curve opens or closes it (a cow's mouth). */
  lowpass: Curve;
  /** Vibrato: rate in Hz and depth in cents. */
  vibrato?: readonly [number, number];
  /** Amplitude flutter: rate in Hz and depth 0..1 (a whinny's pulsing, a camel's gurgle). */
  flutter?: readonly [number, number];
}

/** A whole call: its parts, a breath of noise under it, and its length. */
export interface CallShape {
  parts: CallPart[];
  /** Breath noise: band centre Hz, Q, and its envelope. */
  breath: { hz: number; q: number; amp: Curve };
  seconds: number;
  /** Its loudness trim, so every species calls about as loud as a horn. */
  trim: number;
}

/** The donkey's bray: inhaled "hee" and exhaled "haw" in turn, each [start, length]. */
function bray(cycles: ReadonlyArray<readonly [number, number, number]>, hee: number, haw: number): CallPart[] {
  // cycles: [start, hee length, haw length]
  const heePitch: Array<[number, number]> = [];
  const heeAmp: Array<[number, number]> = [[0, 0]];
  const hawPitch: Array<[number, number]> = [];
  const hawAmp: Array<[number, number]> = [[0, 0]];
  for (const [s, h, w] of cycles) {
    heePitch.push([s, hee * 0.9], [s + h, hee * 1.08]);
    heeAmp.push([s, 0], [s + 0.04, 0.55], [s + h - 0.03, 0.5], [s + h, 0]);
    const e = s + h;
    hawPitch.push([e, haw * 1.12], [e + w * 0.3, haw], [e + w, haw * 0.85]);
    hawAmp.push([e, 0], [e + 0.03, 1], [e + w * 0.7, 0.85], [e + w, 0]);
  }
  return [
    { wave: "sawtooth", pitch: heePitch, amp: heeAmp, formants: [[1300, 5, 1], [2700, 6, 0.6]], lowpass: [[0, 4500]], vibrato: [9, 30] },
    { wave: "sawtooth", pitch: hawPitch, amp: hawAmp, formants: [[650, 3, 1], [1150, 4, 0.8], [2500, 5, 0.4]], lowpass: [[0, 3800]], flutter: [28, 0.35] },
  ];
}

/**
 * Each species' call at `pitch` 1. Measured where a recording was found: the
 * horse's whinny (a tone near 1.5 kHz opening it, dipping to 1.15 kHz, and a
 * second, lower voice near 500 falling to 360 Hz joining it, 1.4 s in all), the
 * cow's moo (210-220 Hz after a rise from 185 Hz, 2.3 s, its loudest harmonic
 * moving from the fundamental to near 850 Hz as the mouth opens), the camel's
 * grunt (about 130 Hz with a subharmonic near 66 Hz, its second harmonic the
 * strongest, dark) and the elephant's trumpet (600 rising to 735 Hz and falling
 * to 500 Hz, its energy centred near 3 kHz). The donkey's bray and the mule's
 * call are modelled from descriptions, not measured.
 */
export const CALLS: Readonly<Record<Species, CallShape>> = {
  horse: {
    seconds: 1.5,
    trim: 0.6,
    parts: [
      {
        wave: "triangle",
        pitch: [[0, 1470], [0.2, 1580], [0.5, 1500], [1.0, 1250], [1.4, 1150]],
        amp: [[0, 0], [0.05, 0.9], [0.5, 0.8], [1.2, 0.55], [1.45, 0]],
        formants: [],
        lowpass: [[0, 5000]],
        vibrato: [7, 40],
        flutter: [12, 0.45],
      },
      {
        wave: "sawtooth",
        pitch: [[0.45, 500], [0.9, 420], [1.4, 360]],
        amp: [[0.4, 0], [0.5, 0.45], [1.2, 0.4], [1.45, 0]],
        formants: [[700, 3, 1], [1250, 4, 0.6]],
        lowpass: [[0, 3000]],
        flutter: [14, 0.5],
      },
    ],
    breath: { hz: 1800, q: 0.8, amp: [[0, 0], [0.05, 0.08], [1.3, 0.06], [1.5, 0]] },
  },
  donkey: {
    seconds: 3,
    trim: 1.15,
    parts: bray(
      [
        [0, 0.28, 0.42],
        [0.72, 0.3, 0.45],
        [1.49, 0.3, 0.48],
        [2.29, 0.24, 0.42],
      ],
      820,
      190,
    ),
    breath: { hz: 2200, q: 0.9, amp: [[0, 0], [0.05, 0.25], [2.8, 0.2], [3, 0]] },
  },
  mule: {
    seconds: 2.1,
    trim: 1.05,
    parts: [
      {
        wave: "triangle",
        pitch: [[0, 1150], [0.15, 1250], [0.5, 1000]],
        amp: [[0, 0], [0.05, 0.8], [0.45, 0.6], [0.55, 0]],
        formants: [],
        lowpass: [[0, 5000]],
        vibrato: [8, 40],
        flutter: [12, 0.4],
      },
      ...bray(
        [
          [0.55, 0.25, 0.42],
          [1.25, 0.25, 0.5],
        ],
        900,
        250,
      ),
    ],
    breath: { hz: 2000, q: 0.9, amp: [[0, 0], [0.05, 0.12], [1.9, 0.12], [2.1, 0]] },
  },
  cow: {
    seconds: 2.5,
    trim: 0.8,
    parts: [
      {
        wave: "sawtooth",
        pitch: [[0, 185], [0.5, 215], [1.9, 218], [2.35, 190]],
        amp: [[0, 0], [0.12, 0.7], [1.1, 0.8], [1.3, 1], [2.1, 0.9], [2.4, 0]],
        formants: [[420, 2, 0.8], [850, 3.5, 1], [2300, 4, 0.15]],
        // closed ("mmm"), then open ("ooo"), then closing
        lowpass: [[0, 320], [1.1, 420], [1.35, 1500], [2.05, 1400], [2.4, 450]],
        vibrato: [5, 12],
      },
    ],
    breath: { hz: 500, q: 0.7, amp: [[0, 0], [0.1, 0.03], [2.3, 0.03], [2.5, 0]] },
  },
  camel: {
    seconds: 2.2,
    trim: 1,
    parts: [
      {
        wave: "sawtooth",
        pitch: [[0, 125], [0.5, 135], [1.2, 120], [1.5, 200], [2.0, 260]],
        amp: [[0, 0], [0.06, 0.9], [1.2, 0.8], [1.5, 0.6], [1.9, 0.55], [2.15, 0]],
        formants: [[260, 3, 1], [520, 3, 0.5], [1100, 4, 0.15]],
        lowpass: [[0, 900]],
        flutter: [22, 0.6],
      },
      {
        // the subharmonic gurgle, an octave under
        wave: "sawtooth",
        pitch: [[0, 63], [0.5, 68], [1.2, 60]],
        amp: [[0, 0], [0.08, 0.6], [1.2, 0.5], [1.4, 0]],
        formants: [],
        lowpass: [[0, 400]],
        flutter: [17, 0.8],
      },
    ],
    breath: { hz: 350, q: 0.8, amp: [[0, 0], [0.1, 0.12], [2, 0.1], [2.2, 0]] },
  },
  elephant: {
    seconds: 1.9,
    trim: 0.6,
    parts: [
      {
        wave: "sawtooth",
        pitch: [[0, 560], [0.12, 640], [0.75, 735], [1.4, 560], [1.8, 500]],
        amp: [[0, 0], [0.04, 1], [0.9, 0.9], [1.5, 0.6], [1.85, 0]],
        formants: [[2200, 3, 0.8], [3100, 4, 1], [3700, 5, 0.6]],
        lowpass: [[0, 7000]],
        vibrato: [11, 35],
      },
      {
        // a twin a little off: the trumpet's rasp
        wave: "square",
        pitch: [[0, 568], [0.12, 650], [0.75, 746], [1.4, 568], [1.8, 507]],
        amp: [[0, 0], [0.04, 0.5], [0.9, 0.45], [1.5, 0.3], [1.85, 0]],
        formants: [[1100, 2, 0.5], [2900, 3, 1]],
        lowpass: [[0, 6000]],
      },
    ],
    breath: { hz: 3000, q: 1.2, amp: [[0, 0], [0.04, 0.35], [1.4, 0.25], [1.9, 0]] },
  },
};

/** Ramp `param` through `curve` from `t`, its values times `scale`. */
function follow(param: AudioParam, curve: Curve, t: number, scale: number): void {
  const [first, ...rest] = curve;
  param.setValueAtTime(first![1] * scale, t + first![0]);
  for (const [s, value] of rest) param.linearRampToValueAtTime(value * scale, t + s);
}

/** The call's loudness trim: about a horn's level at `level` 1. */
export const CALL_TRIM = 0.35;

export const animalCall = /* @__PURE__ */ oneShot({
  id: "animal-call",
  title: "Animal call",
  category: "animals",
  description: "A draft animal's call, sounded by the player's horn: a horse's whinny, a donkey's bray, a mule between the two, a cow's moo, a camel's groan or an elephant's trumpet.",
  params: [
    {
      name: "species",
      title: "Species",
      kind: "choice",
      values: [
        { value: "horse", title: "Horse (whinny)" },
        { value: "donkey", title: "Donkey (bray)" },
        { value: "mule", title: "Mule" },
        { value: "cow", title: "Cow (moo)" },
        { value: "camel", title: "Camel (groan)" },
        { value: "elephant", title: "Elephant (trumpet)" },
      ],
      default: "horse",
    },
    { name: "pitch", title: "Pitch", kind: "number", min: 0.7, max: 1.4, step: 0.01, default: 1 },
    LEVEL,
  ],
  play(ctx, dest, t, v) {
    const shape = CALLS[choice(v, "species") as Species];
    const pitch = num(v, "pitch");
    // The vocal tract scales less than the voice: formants by the square root.
    const tract = Math.sqrt(pitch);
    const out = gain(ctx, num(v, "level") * CALL_TRIM * shape.trim);
    out.connect(dest);
    const end = t + shape.seconds + 0.1;
    const sources: AudioScheduledSourceNode[] = [];
    const run = <T extends AudioScheduledSourceNode>(s: T): T => {
      s.start(t);
      s.stop(end);
      sources.push(s);
      return s;
    };
    for (const part of shape.parts) {
      if (part.amp.length < 2 || part.pitch.length === 0) continue;
      const osc = run(ctx.createOscillator());
      osc.type = part.wave;
      follow(osc.frequency, part.pitch, t, pitch);
      if (part.vibrato) {
        const lfo = run(ctx.createOscillator());
        lfo.frequency.value = part.vibrato[0];
        const depth = gain(ctx, part.vibrato[1]);
        lfo.connect(depth).connect(osc.detune);
      }
      const env = gain(ctx);
      follow(env.gain, part.amp, t, 1);
      let last: AudioNode = env;
      if (part.flutter) {
        // The flutter swings the level around (1 - depth/2), never through silence.
        const [rate, depth] = part.flutter;
        const fl = gain(ctx, 1 - depth / 2);
        const lfo = run(ctx.createOscillator());
        lfo.frequency.value = rate;
        const d = gain(ctx, depth / 2);
        lfo.connect(d).connect(fl.gain);
        env.connect(fl);
        last = fl;
      }
      const lp = filter(ctx, "lowpass", part.lowpass[0]![1] * tract, 0.7);
      follow(lp.frequency, part.lowpass, t, tract);
      osc.connect(env);
      last.connect(lp);
      if (part.formants.length === 0) lp.connect(out);
      else {
        for (const [hz, q, level] of part.formants) {
          const bp = filter(ctx, "bandpass", hz * tract, q);
          const g = gain(ctx, level * 1.6);
          lp.connect(bp).connect(g).connect(out);
        }
      }
    }
    const breath = run(noiseSource(ctx, true));
    const bp = filter(ctx, "bandpass", shape.breath.hz * tract, shape.breath.q);
    const be = gain(ctx);
    follow(be.gain, shape.breath.amp, t, 1);
    breath.connect(bp).connect(be).connect(out);
    return voiceOf(out, sources, end);
  },
});
