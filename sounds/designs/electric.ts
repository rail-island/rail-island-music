// Electric traction: the running sound of an old DC locomotive with resistor
// control, of a modern three-phase train and of a Shinkansen, one loop each
// (`electric-engine-<kind>`, docs/sounds/sounds.md). The game sets `speed`
// (0..1 of the train's top speed) and `load` (how hard it pulls); where the
// train is heard from is the game's business, as for every design.
//
// What was measured in the reference recordings (src/references.ts) and what
// was modelled without one is written beside each profile.

import { LEVEL, filter, gain, loop, noiseSource, num, seeded, voiceOf } from "../nodes.ts";
import type { LoopVoice, SoundParam, SoundValues } from "../types.ts";

const SPEED: SoundParam = { name: "speed", title: "Speed", kind: "number", min: 0, max: 1, step: 0.01, default: 0.5 };
const LOAD: SoundParam = { name: "load", title: "Pull", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 };

/** Wheel diameter (m) and gear teeth on the axle: the gear mesh whine's frequency. */
const WHEEL = 1.25;
const GEAR_TEETH = 79;

/** The gears' mesh frequency at `v` m/s. */
export function gearMesh(v: number): number {
  return (v / (Math.PI * WHEEL)) * GEAR_TEETH;
}

/** How quickly a running sound follows a new speed or pull, s (time constant). */
const GLIDE = 0.25;

/**
 * The resistor locomotive's controller steps up a notch every 1.1-1.4 s while it
 * pulls hard at low speed, until full field at about two thirds of its top speed.
 */
export const NOTCH_BELOW = 0.66;

/** The modern train's converter tones, Hz: measured in an ICE pulling out of Berlin Hbf. */
export const CONVERTER_TONES: ReadonlyArray<{ freq: number; level: number }> = [
  { freq: 1180, level: 1 },
  { freq: 1830, level: 0.7 },
  { freq: 2420, level: 0.8 },
  { freq: 2750, level: 0.5 },
  { freq: 3070, level: 0.4 },
];
/** Its auxiliary converter's steady tone, Hz (same recording). */
export const AUX_TONE = 620;
/** How far the converter tones rise from standstill to `CONVERTER_RISE_AT` of top speed: about 8 % (same recording). */
export const CONVERTER_RISE = 0.08;
const CONVERTER_RISE_AT = 0.35;

/** Top speeds, m/s: 120, 160 and 300 km/h. */
export const TOP_SPEED = { resistor: 33, converter: 44, shinkansen: 83 } as const;

/** A smooth change of `param` to `value` from `at`. */
function glide(param: AudioParam, value: number, at: number, tau = GLIDE): void {
  param.setTargetAtTime(value, at, tau);
}

/** The noise of the wheels and the air: louder and brighter with speed. */
function rolling(ctx: BaseAudioContext, out: AudioNode, t: number, cutoff: number) {
  const src = noiseSource(ctx, true);
  const lp = filter(ctx, "lowpass", cutoff);
  const hp = filter(ctx, "highpass", 45);
  const g = gain(ctx);
  src.connect(hp).connect(lp).connect(g).connect(out);
  src.start(t);
  return { src, g };
}

/** Its level at a fraction of top speed. */
export function rollingLevel(speed: number): number {
  return Math.pow(Math.max(0, speed), 1.3);
}

/** A loop voice over `out` whose `update` runs on every set and tick and whose `events` schedule ahead. */
function running(
  out: GainNode,
  sources: AudioScheduledSourceNode[],
  initial: SoundValues,
  update: (v: SoundValues, at: number) => void,
  events?: (v: SoundValues, from: number, to: number) => void,
): LoopVoice {
  const base = voiceOf(out, sources, Infinity);
  let v = initial;
  let scheduled = -Infinity;
  let stopped = false;
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
      update(v, now);
      const from = Math.max(now, scheduled);
      if (events && from < now + horizon) events(v, from, now + horizon);
      scheduled = Math.max(scheduled, now + horizon);
    },
  };
}

/**
 * An old DC electric locomotive with resistor control, the kind that hauled
 * Czechoslovak expresses from the 1950s to the 1990s. Its blowers roar as long
 * as it is switched on (the level against the rest: the Kosice recording of one
 * idling); a compressor thumps about 12 times a second while it stands; the
 * traction motors' gears whine at their mesh frequency with an octave and the
 * brushes' hiss, as loud as it pulls; and the controller clacks up a notch every
 * 1.1-1.4 s while it pulls hard at low speed, each notch a small jump in the
 * motors' pull. Gears, notches, compressor and horn are modelled from a general
 * description, not measured: no recording of one pulling away was found.
 */
export const electricEngineResistor = /* @__PURE__ */ loop({
  id: "electric-engine-resistor",
  title: "Electric locomotive, resistor control",
  category: "trains",
  description: "An old DC electric locomotive: blowers, a compressor while it stands, gears whining with its speed and the controller clacking notch by notch as it pulls away.",
  params: [SPEED, LOAD, LEVEL],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level") * 0.028);
    out.connect(dest);
    const sources: AudioScheduledSourceNode[] = [];
    // Blowers: broadband with the blade tone.
    const fan = noiseSource(ctx, true);
    const fanLp = filter(ctx, "lowpass", 1400);
    const fanBlade = filter(ctx, "bandpass", 290, 4);
    const fanG = gain(ctx, 0.18);
    const bladeG = gain(ctx, 0.5);
    fan.connect(fanLp).connect(fanG).connect(out);
    fan.connect(fanBlade).connect(bladeG).connect(out);
    fan.start(t);
    sources.push(fan);
    // The motors: the mesh tone, its octave, its half, and the brushes.
    const motor = gain(ctx);
    const notch = gain(ctx, 1);
    motor.connect(notch).connect(out);
    const tones = ([
      [1, 0.5],
      [2, 0.22],
      [0.5, 0.18],
    ] as const).map(([ratio, level]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const g = gain(ctx, level);
      osc.connect(g).connect(motor);
      osc.start(t);
      sources.push(osc);
      return { osc, ratio };
    });
    const brush = noiseSource(ctx, true);
    const brushBp = filter(ctx, "bandpass", 2400, 1.5);
    const brushG = gain(ctx, 0.25);
    brush.connect(brushBp).connect(brushG).connect(motor);
    brush.start(t);
    sources.push(brush);
    // The compressor and the controller's clacks: struck by events.
    const comp = noiseSource(ctx, true);
    const compLp = filter(ctx, "lowpass", 180, 0.9);
    const compG = gain(ctx);
    comp.connect(compLp).connect(compG).connect(out);
    comp.start(t);
    sources.push(comp);
    const clack = noiseSource(ctx, true);
    const clackBp = filter(ctx, "bandpass", 2600, 2);
    const clackG = gain(ctx);
    clack.connect(clackBp).connect(clackG).connect(out);
    clack.start(t);
    sources.push(clack);
    const roll = rolling(ctx, out, t, 1800);
    sources.push(roll.src);

    const random = seeded(31);
    let nextNotch = t;
    let nextStroke = t;
    return running(
      out,
      sources,
      initial,
      (v, at) => {
        const speed = num(v, "speed");
        const ms = speed * TOP_SPEED.resistor;
        for (const { osc, ratio } of tones) glide(osc.frequency, Math.max(1, gearMesh(ms) * ratio), at);
        glide(motor.gain, (0.25 + 0.75 * num(v, "load")) * Math.min(1, ms / 6) * 2.4, at);
        glide(roll.g.gain, rollingLevel(speed) * 0.9, at);
      },
      (v, from, to) => {
        const speed = num(v, "speed");
        if (speed <= 0) {
          // The compressor pumps while it stands.
          if (nextStroke < from) nextStroke = from;
          while (nextStroke < to) {
            compG.gain.setTargetAtTime(2.2, nextStroke, 0.004);
            compG.gain.setTargetAtTime(0, nextStroke + 0.015, 0.02);
            nextStroke += 1 / 12;
          }
        } else nextStroke = to;
        if (speed > 0 && speed < NOTCH_BELOW && num(v, "load") > 0.5) {
          if (nextNotch < from) nextNotch = from + 0.4;
          while (nextNotch < to) {
            clackG.gain.setTargetAtTime(1.6, nextNotch, 0.0008);
            clackG.gain.setTargetAtTime(0, nextNotch + 0.003, 0.008);
            // The motors' pull drops and builds up again.
            notch.gain.setTargetAtTime(0.55, nextNotch, 0.01);
            notch.gain.setTargetAtTime(1, nextNotch + 0.04, 0.3);
            nextNotch += 1.1 + 0.3 * random();
          }
        } else nextNotch = to;
      },
    );
  },
});

/**
 * A modern three-phase electric train. The converters sing a cluster of steady
 * tones near 1180, 1830, 2420, 2750 and 3070 Hz while they pull, rising by
 * about 8 % as it gathers speed, over the auxiliary converter's constant 620 Hz:
 * all measured in an ICE pulling out of Berlin Hauptbahnhof. The gears' tone and
 * the fans' hiss under them are modelled.
 */
export const electricEngineConverter = /* @__PURE__ */ loop({
  id: "electric-engine-converter",
  title: "Electric train, three-phase",
  category: "trains",
  description: "A modern electric train or locomotive: the converters' cluster of high tones while it pulls, rising a little with its speed, over a steady hum.",
  params: [SPEED, LOAD, LEVEL],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level") * 0.079);
    out.connect(dest);
    const sources: AudioScheduledSourceNode[] = [];
    const converter = gain(ctx);
    converter.connect(out);
    const tones = CONVERTER_TONES.map((c, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.detune.value = (i - 2) * 3;
      const g = gain(ctx, c.level * 0.12);
      osc.connect(g).connect(converter);
      osc.start(t);
      sources.push(osc);
      return { osc, freq: c.freq };
    });
    const aux = ctx.createOscillator();
    aux.type = "sine";
    aux.frequency.value = AUX_TONE;
    const auxG = gain(ctx, 0.05);
    aux.connect(auxG).connect(out);
    aux.start(t);
    sources.push(aux);
    const gear = ctx.createOscillator();
    gear.type = "sine";
    const gearG = gain(ctx);
    gear.connect(gearG).connect(out);
    gear.start(t);
    sources.push(gear);
    const fan = noiseSource(ctx, true);
    const fanBp = filter(ctx, "bandpass", 1800, 0.5);
    const fanG = gain(ctx, 0.12);
    fan.connect(fanBp).connect(fanG).connect(out);
    fan.start(t);
    sources.push(fan);
    const roll = rolling(ctx, out, t, 2200);
    sources.push(roll.src);
    return running(out, sources, initial, (v, at) => {
      const speed = num(v, "speed");
      const ms = speed * TOP_SPEED.converter;
      const rise = 1 + CONVERTER_RISE * Math.min(1, speed / CONVERTER_RISE_AT);
      for (const { osc, freq } of tones) glide(osc.frequency, freq * rise, at);
      const pulling = speed > 0 ? Math.min(1, num(v, "load") * 1.2) * Math.max(0.4, 1 - ms / 50) : 0;
      glide(converter.gain, pulling, at);
      glide(gear.frequency, Math.max(1, gearMesh(ms)), at);
      glide(gearG.gain, 0.25 * Math.min(1, ms / 10), at);
      glide(roll.g.gain, rollingLevel(speed) * 0.9, at);
    });
  },
});

/**
 * A Shinkansen set. At speed it is mostly wind: the roar of the whole train,
 * most of it below 1.2 kHz (what a set passing Odawara without stopping
 * sounds like: a flat block of broadband noise), and the pantograph's hiss
 * with the cube of speed. Pulling away, its inverters whine from 420 Hz up,
 * fading under the wind; whine and hiss are modelled, not measured.
 */
export const electricEngineShinkansen = /* @__PURE__ */ loop({
  id: "electric-engine-shinkansen",
  title: "Shinkansen",
  category: "trains",
  description: "A Japanese high-speed train: a soft inverter whine pulling out, the roar of the wind and the pantograph's hiss at speed.",
  params: [SPEED, LOAD, LEVEL],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level") * 0.112);
    out.connect(dest);
    const sources: AudioScheduledSourceNode[] = [];
    const whine = gain(ctx);
    whine.connect(out);
    const partials = ([
      [1, 0.5],
      [1.5, 0.18],
      [2, 0.15],
    ] as const).map(([ratio, level]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const g = gain(ctx, level);
      osc.connect(g).connect(whine);
      osc.start(t);
      sources.push(osc);
      return { osc, ratio };
    });
    const panto = noiseSource(ctx, true);
    const pantoHp = filter(ctx, "highpass", 2500);
    const pantoLp = filter(ctx, "lowpass", 9000);
    const pantoG = gain(ctx);
    panto.connect(pantoHp).connect(pantoLp).connect(pantoG).connect(out);
    panto.start(t);
    sources.push(panto);
    const roll = rolling(ctx, out, t, 1200);
    sources.push(roll.src);
    return running(out, sources, initial, (v, at) => {
      const speed = num(v, "speed");
      const ms = speed * TOP_SPEED.shinkansen;
      const f = 420 + 24 * Math.min(ms, 45);
      for (const { osc, ratio } of partials) glide(osc.frequency, f * ratio, at);
      const level = ms < 0.3 ? 0 : Math.min(1, ms / 3) * Math.max(0.15, 1 - ms / 70) * (0.5 + 0.5 * num(v, "load"));
      glide(whine.gain, level * 0.6, at);
      glide(pantoG.gain, Math.pow(speed, 3) * 0.5, at);
      glide(roll.g.gain, rollingLevel(speed) * 1.6, at);
    });
  },
});
