// Aircraft: the running sound of a helicopter, one loop the game shares between
// all its helicopters (`helicopter`, docs/sounds/sounds.md). The factory pins
// each model's character (`size`, `blades`); the game sets `spin` (the rotor's
// speed, a fraction of full) and `load` (the collective: climbing or hovering
// heavy, descending light). Where it is heard from is the game's business.
//
// What it is made of: the main rotor's blade slap, one struck pulse per blade
// passing (a low thump and a band of noise, the harder the more it lifts); the
// gas turbine's whine, a few partials rising with the rotor; the tail rotor's
// buzz, faster and quieter; and the rotor wash, broadband noise. The blade-pass
// rate comes from published facts, not a recording: a main rotor's tips turn at
// about the same speed whatever its size (`TIP_SPEED`, 212 m/s: a Bell 206's
// 10.2 m rotor at 394 rpm, a Mil Mi-8's 21.3 m at 192 rpm), so its revolutions
// follow from its diameter, and the slap is blades x revolutions. The tail
// rotor turns about 6.2 times as fast as the main rotor with two to three
// blades (the Bell's 2,550 rpm, the Mi-8's 1,124 rpm).
//
// Matched to two CC0 recordings of the USC Cinema collection (src/references.ts):
// a light two-bladed helicopter hovering, and one starting and lifting off.
// Measured there: the slap's depth (about 11 dB between the blades) and its
// spectrum, broad from 125 Hz to 2 kHz and falling above; the tail rotor's
// second and third harmonics as the strongest lines; and a weak turbine line,
// about 20 dB under the rotor. Modelled without a measurement: the heavy end of
// `size` (no recording of a large helicopter was used), the turbine's exact
// pitch and its rise with the rotor, how `load` weighs the slap, and the spin-up.

import { LEVEL, filter, gain, loop, noiseSource, num, seeded, voiceOf } from "../nodes.ts";
import type { LoopVoice, SoundParam, SoundValues } from "../types.ts";

const SPIN: SoundParam = { name: "spin", title: "Rotor speed", kind: "number", min: 0, max: 1, step: 0.01, default: 1 };
const LOAD: SoundParam = { name: "load", title: "Collective", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 };
const SIZE: SoundParam = { name: "size", title: "Size", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 };
const BLADES: SoundParam = { name: "blades", title: "Main rotor blades", kind: "number", min: 2, max: 6, step: 1, default: 4 };

/** A main rotor's tip speed, m/s: about the same for every helicopter. */
export const TIP_SPEED = 212;
/** Main rotor diameter, m, at `size` 0 (a Bell 206) and 1 (a Mil Mi-8). */
export const ROTOR_DIAMETER = { light: 10.2, heavy: 21.3 } as const;
/** How many times faster than the main rotor the tail rotor turns. */
export const TAIL_RATIO = 6.2;

/** The main rotor's diameter, m, at a `size`. */
export function rotorDiameter(size: number): number {
  return ROTOR_DIAMETER.light + (ROTOR_DIAMETER.heavy - ROTOR_DIAMETER.light) * size;
}

/** The main rotor's revolutions per second at full speed. */
export function rotorRev(size: number): number {
  return TIP_SPEED / (Math.PI * rotorDiameter(size));
}

/** The blade-pass (slap) rate, Hz, at full rotor speed: blades x revolutions. */
export function bladePass(size: number, blades: number): number {
  return Math.round(blades) * rotorRev(size);
}

/** The tail rotor's blade-pass rate, Hz, at full speed: two blades small, three large. */
export function tailPass(size: number): number {
  return rotorRev(size) * TAIL_RATIO * (2 + size);
}

/** The gas turbine's whine at full speed, Hz: lower the bigger the engine. */
export function turbineTone(size: number): number {
  return 2600 - 1100 * size;
}

/** Below this blade-pass rate the slap stops: the rotor barely turns. */
export const MIN_PASS = 1.5;
/** How quickly the rotor follows a new `spin`, s (time constant). */
export const SPIN_GLIDE = 0.6;
/** How quickly the rest follows a new `load` or `size`, s. */
const GLIDE = 0.25;
/** A blade pulse's attack, s: the time constant every pulse rises with. */
export const PULSE_ATTACK = 0.0025;

/** The level of each part at a rotor speed, collective and size; all zero when the rotor stands. */
export function helicopterMix(spin: number, load: number, size: number) {
  const s = Math.max(0, Math.min(1, spin));
  return {
    thump: Math.pow(s, 1.5) * (0.55 + 0.6 * load) * (0.8 + 0.4 * size),
    slap: Math.pow(s, 2) * (0.25 + 1.0 * load) * (0.85 + 0.3 * size),
    turbine: s * (0.7 + 0.3 * load) * (1.1 - 0.3 * size),
    tail: Math.pow(s, 2) * (0.8 + 0.3 * load) * (1 - 0.4 * size),
    wash: Math.pow(s, 2) * (0.7 + 0.5 * load) * (0.8 + 0.4 * size),
  };
}

/** The turbine's pitch at a rotor speed: from about a third at light-off up to full, a little higher under load. */
function turbinePitch(spin: number, load: number, size: number): number {
  return turbineTone(size) * (0.3 + 0.7 * spin) * (1 + 0.03 * (load - 0.5));
}

/** A smooth change of `param` to `value` from `at`; with `tau` 0, a jump (the first values a voice starts with). */
function glide(param: AudioParam, value: number, at: number, tau = GLIDE): void {
  if (tau > 0) param.setTargetAtTime(value, at, tau);
  else param.setValueAtTime(value, at);
}

/**
 * A helicopter: blade slap at blades x the rotor's revolutions, a turbine whine
 * with the rotor's speed, the tail rotor's buzz and the rotor wash. Silent while
 * the rotor stands (`spin` 0), and gliding up and down with it. The rates follow
 * published rotor figures; the balance of the parts was matched to a recording
 * of a light helicopter hovering (see the head of this file).
 */
export const helicopter = /* @__PURE__ */ loop({
  id: "helicopter",
  title: "Helicopter",
  category: "aircraft",
  description: "A helicopter's rotor and turbine: the blade slap at the rotor's rate, heavier as it climbs, a turbine whine, the tail rotor's buzz and the wash; silent while the rotor stands.",
  params: [SPIN, LOAD, SIZE, BLADES, LEVEL],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level") * 0.12);
    out.connect(dest);
    const sources: AudioScheduledSourceNode[] = [];
    const start = <T extends AudioScheduledSourceNode>(s: T): T => {
      s.start(t);
      sources.push(s);
      return s;
    };

    // The blade pulses: a thump (a low sine and low-passed noise) and a slap
    // (band-passed noise), each through a pulse gain struck once per blade, then
    // a part gain that follows the rotor's speed and the collective.
    const thumpPart = gain(ctx);
    const thumpPulse = gain(ctx);
    thumpPulse.connect(thumpPart).connect(out);
    const thumpOsc = start(ctx.createOscillator());
    thumpOsc.type = "sine";
    const thumpOscG = gain(ctx, 0.2);
    thumpOsc.connect(thumpOscG).connect(thumpPulse);
    const thumpNoise = start(noiseSource(ctx, true));
    const thumpLp = filter(ctx, "lowpass", 400, 0.9);
    const thumpNoiseG = gain(ctx, 1.4);
    thumpNoise.connect(thumpLp).connect(thumpNoiseG).connect(thumpPulse);

    const slapPart = gain(ctx);
    const slapPulse = gain(ctx);
    slapPulse.connect(slapPart).connect(out);
    const slapNoise = start(noiseSource(ctx, true));
    const slapBp = filter(ctx, "bandpass", 700, 0.8);
    const slapHp = filter(ctx, "highpass", 180);
    const slapG = gain(ctx, 1.6);
    slapNoise.connect(slapHp).connect(slapBp).connect(slapG).connect(slapPulse);

    // The turbine: three partials, softened by a low-pass.
    const turbinePart = gain(ctx);
    const turbineLp = filter(ctx, "lowpass", 3200, 0.5);
    turbinePart.connect(turbineLp).connect(out);
    const whine = ([
      [1, 0.02],
      [1.5, 0.007],
      [0.25, 0.012],
    ] as const).map(([ratio, level], i) => {
      const osc = start(ctx.createOscillator());
      osc.type = "sine";
      osc.detune.value = (i - 1) * 4;
      const g = gain(ctx, level);
      osc.connect(g).connect(turbinePart);
      return { osc, ratio };
    });
    // The turbine's exhaust roar: a band of noise near 1.2 kHz.
    const roar = start(noiseSource(ctx, true));
    const roarBp = filter(ctx, "bandpass", 1200, 0.8);
    const roarG = gain(ctx, 0.12);
    roar.connect(roarBp).connect(roarG).connect(turbinePart);

    // The tail rotor: a sawtooth buzz whose second and third harmonics carry it
    // (the strongest lines of the hovering recording, 159 and 233 Hz).
    const tailPart = gain(ctx);
    const tail = start(ctx.createOscillator());
    tail.type = "sawtooth";
    const tailHp = filter(ctx, "highpass", 140, 0.7);
    const tailLp = filter(ctx, "lowpass", 380, 0.8);
    const tailG = gain(ctx, 0.3);
    tail.connect(tailHp).connect(tailLp).connect(tailG).connect(tailPart).connect(out);

    // The rotor wash: broadband noise, lower the bigger the rotor.
    const washPart = gain(ctx);
    const wash = start(noiseSource(ctx, true));
    const washHp = filter(ctx, "highpass", 90);
    const washLp = filter(ctx, "lowpass", 1800, 0.5);
    const washG = gain(ctx, 0.26);
    wash.connect(washHp).connect(washLp).connect(washG).connect(washPart).connect(out);

    const base = voiceOf(out, sources, Infinity);
    let v: SoundValues = initial;
    let stopped = false;
    // The rotor's speed as the pulses hear it: it follows `spin` with SPIN_GLIDE,
    // the way the continuous parts glide, so the slap speeds up and slows down.
    let spinNow = num(initial, "spin");
    let spinAt = t;
    let nextPulse = t;
    let blade = 0;
    let scheduled = -Infinity;
    // Each blade strikes a little differently (tracking): the rotor's once-a-turn lope.
    const random = seeded(17);
    const bladeLevel = Array.from({ length: 6 }, (_, i) => (i === 0 ? 1 : 0.78 + 0.14 * random()));

    // The first update sets the values the voice starts with: a helicopter
    // begun at full speed is heard at full speed at once, one begun at 0 is silent.
    let first = true;
    const update = (at: number) => {
      const tau = first ? 0 : SPIN_GLIDE;
      const quick = first ? 0 : GLIDE;
      first = false;
      const spin = num(v, "spin");
      const load = num(v, "load");
      const size = num(v, "size");
      const mix = helicopterMix(spin, load, size);
      glide(thumpPart.gain, mix.thump, at, tau);
      glide(slapPart.gain, mix.slap, at, tau);
      glide(turbinePart.gain, mix.turbine, at, tau);
      glide(tailPart.gain, mix.tail, at, tau);
      glide(washPart.gain, mix.wash, at, tau);
      const f = turbinePitch(spin, load, size);
      for (const { osc, ratio } of whine) glide(osc.frequency, f * ratio, at, tau);
      glide(tail.frequency, Math.max(1, tailPass(size) * spin), at, tau);
      glide(thumpOsc.frequency, 110 - 50 * size, at, quick);
      glide(thumpLp.frequency, 400 - 180 * size, at, quick);
      glide(slapBp.frequency, 820 - 380 * size, at, quick);
      glide(washLp.frequency, 1800 - 700 * size, at, quick);
      glide(roarBp.frequency, 1300 - 500 * size, at, quick);
    };

    update(t);

    const pulses = (from: number, to: number) => {
      const target = num(v, "spin");
      const load = num(v, "load");
      const size = num(v, "size");
      const blades = Math.round(num(v, "blades"));
      const full = bladePass(size, blades);
      if (nextPulse < from) nextPulse = from;
      while (nextPulse < to) {
        spinNow = target + (spinNow - target) * Math.exp(-(nextPulse - spinAt) / SPIN_GLIDE);
        spinAt = nextPulse;
        const rate = full * spinNow;
        if (rate < MIN_PASS) {
          // the rotor barely turns: no slap, look again a little later
          nextPulse += 0.05;
          continue;
        }
        const period = 1 / rate;
        const k = blade % blades;
        blade = k + 1;
        const peak = bladeLevel[k]!;
        const sharp = 0.7 + 0.6 * load;
        thumpPulse.gain.setTargetAtTime(peak, nextPulse, PULSE_ATTACK);
        thumpPulse.gain.setTargetAtTime(0.08, nextPulse + 0.012, period * 0.3);
        slapPulse.gain.setTargetAtTime(peak * sharp, nextPulse + 0.002, PULSE_ATTACK);
        slapPulse.gain.setTargetAtTime(0.04, nextPulse + 0.01, period * 0.18);
        nextPulse += period;
      }
    };

    const voice: LoopVoice = {
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
        update(now);
        const from = Math.max(now, scheduled);
        if (from < now + horizon) pulses(from, now + horizon);
        scheduled = Math.max(scheduled, now + horizon);
      },
    };
    return voice;
  },
});
