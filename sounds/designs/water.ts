// The water's sounds (docs/sounds/sounds.md): a river's rapids, a waterfall and
// a spring, which in the game is a fountain. All three are loops built from
// filtered noise whose filters and gains wander, plus scattered events -- the
// bubbles of a rapid, the droplets of a fountain -- drawn from a seeded random
// sequence, so a render sounds the same every time. A loop schedules only as far
// ahead as it is ticked, like every loop here.

import { LEVEL, filter, gain, loop, noiseSource, num, strike, voiceOf } from "../nodes.ts";
import type { LoopVoice, SoundValues } from "../types.ts";

/** A small seeded random sequence (mulberry32): 0..1. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A loop of continuous parts plus events: `wander` moves the continuous parts
 * every `step` seconds, `event` fires at the gaps `gap` returns. Both get the
 * values in force and the seeded random sequence.
 */
function waterLoop(
  ctx: BaseAudioContext,
  out: GainNode,
  sources: AudioScheduledSourceNode[],
  t: number,
  initial: SoundValues,
  seed: number,
  step: number,
  wander: (at: number, v: SoundValues, rnd: () => number) => void,
  gap: (v: SoundValues, rnd: () => number) => number,
  event: (at: number, v: SoundValues, rnd: () => number) => void,
): LoopVoice {
  const base = voiceOf(out, sources, Infinity);
  const rnd = seeded(seed);
  let v = initial;
  let nextWander = t;
  let nextEvent = t;
  let stopped = false;
  void ctx;
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
      if (nextWander < now) nextWander = now;
      if (nextEvent < now) nextEvent = now;
      while (nextWander < now + horizon) {
        wander(nextWander, v, rnd);
        nextWander += step;
      }
      while (nextEvent < now + horizon) {
        event(nextEvent, v, rnd);
        nextEvent += gap(v, rnd);
      }
    },
  };
}

export const riverRapids = loop({
  id: "river-rapids",
  title: "River rapids",
  category: "water",
  description: "A river running fast over rocks: a rushing bed of water with bubbles and gurgles on top, stronger the steeper and wider the rapid.",
  params: [
    { name: "strength", title: "Strength", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level"));
    out.connect(dest);
    // The bed: noise through two wandering band-passes, a low rush and a
    // brighter splash.
    const bed = noiseSource(ctx, true);
    const low = filter(ctx, "bandpass", 500, 0.7);
    const high = filter(ctx, "bandpass", 1800, 1.1);
    const lowGain = gain(ctx, 0.5);
    const highGain = gain(ctx, 0.22);
    // white noise through a wide band-pass keeps too much hiss: round it off
    const soften = filter(ctx, "lowpass", 2600, 0.5);
    soften.connect(out);
    bed.connect(low).connect(lowGain).connect(soften);
    bed.connect(high).connect(highGain).connect(soften);
    bed.start(t);
    return waterLoop(
      ctx, out, [bed], t, initial, 0x51ab, 0.12,
      (at, v, rnd) => {
        const s = num(v, "strength");
        low.frequency.setTargetAtTime(380 + rnd() * 380, at, 0.08);
        high.frequency.setTargetAtTime(1300 + rnd() * 1300, at, 0.06);
        lowGain.gain.setTargetAtTime((0.35 + 0.35 * s) * (0.8 + 0.4 * rnd()), at, 0.1);
        highGain.gain.setTargetAtTime((0.12 + 0.2 * s) * (0.6 + 0.8 * rnd()), at, 0.05);
      },
      // more bubbles the stronger the rapid
      (v, rnd) => (0.03 + rnd() * 0.12) / (0.5 + num(v, "strength")),
      (at, v, rnd) => {
        // A bubble: a short sine rising in pitch as it bursts.
        const osc = ctx.createOscillator();
        osc.type = "sine";
        const f = 350 + rnd() * 900;
        osc.frequency.setValueAtTime(f, at);
        osc.frequency.exponentialRampToValueAtTime(f * (1.6 + rnd()), at + 0.04);
        const g = gain(ctx);
        osc.connect(g).connect(out);
        strike(g.gain, at, (0.04 + 0.08 * rnd()) * (0.5 + num(v, "strength")), 0.05 + rnd() * 0.04);
        osc.start(at);
        osc.stop(at + 0.12);
      },
    );
  },
});

export const waterfall = loop({
  id: "waterfall",
  title: "Waterfall",
  category: "water",
  description: "Water falling over a lip into a pool: a steady roar, deeper and louder the bigger the fall, with a hiss of spray.",
  params: [
    { name: "size", title: "Size", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level"));
    out.connect(dest);
    const roar = noiseSource(ctx, true);
    const body = filter(ctx, "lowpass", 900, 0.5);
    const bodyGain = gain(ctx, 0.6);
    const spray = filter(ctx, "bandpass", 3200, 0.8);
    const sprayGain = gain(ctx, 0.08);
    const spraySoft = filter(ctx, "lowpass", 5000, 0.5);
    const thunder = filter(ctx, "lowpass", 180, 0.7);
    const thunderGain = gain(ctx, 0.5);
    roar.connect(body).connect(bodyGain).connect(out);
    roar.connect(spray).connect(spraySoft).connect(sprayGain).connect(out);
    roar.connect(thunder).connect(thunderGain).connect(out);
    roar.start(t);
    return waterLoop(
      ctx, out, [roar], t, initial, 0xfa11, 0.25,
      (at, v, rnd) => {
        const s = num(v, "size");
        // The bigger the fall, the lower and heavier its roar.
        body.frequency.setTargetAtTime((1100 - 600 * s) * (0.9 + 0.2 * rnd()), at, 0.2);
        bodyGain.gain.setTargetAtTime((0.45 + 0.35 * s) * (0.9 + 0.2 * rnd()), at, 0.2);
        thunderGain.gain.setTargetAtTime((0.15 + 0.9 * s) * (0.85 + 0.3 * rnd()), at, 0.25);
        sprayGain.gain.setTargetAtTime((0.05 + 0.05 * s) * (0.8 + 0.4 * rnd()), at, 0.1);
      },
      () => 1,
      () => {},
    );
  },
});

export const springFountain = loop({
  id: "spring-fountain",
  title: "Spring fountain",
  category: "water",
  description: "A spring, which the game draws as a fountain: jets splashing back into a basin, a bright patter of droplets over a soft hiss.",
  params: [
    { name: "size", title: "Size", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level"));
    out.connect(dest);
    // The hiss of the jets and the basin's splash.
    const hiss = noiseSource(ctx, true);
    const jet = filter(ctx, "highpass", 2500, 0.6);
    const jetGain = gain(ctx, 0.08);
    const basin = filter(ctx, "bandpass", 1100, 0.9);
    const basinGain = gain(ctx, 0.25);
    hiss.connect(jet).connect(jetGain).connect(out);
    hiss.connect(basin).connect(basinGain).connect(out);
    hiss.start(t);
    // The droplets: one band-passed noise click each.
    const drops = noiseSource(ctx, true);
    const dropFilter = filter(ctx, "bandpass", 3000, 3);
    const dropGain = gain(ctx);
    drops.connect(dropFilter).connect(dropGain).connect(out);
    drops.start(t);
    return waterLoop(
      ctx, out, [hiss, drops], t, initial, 0xf0f0, 0.15,
      (at, v, rnd) => {
        const s = num(v, "size");
        basin.frequency.setTargetAtTime(900 + rnd() * 500, at, 0.1);
        basinGain.gain.setTargetAtTime((0.15 + 0.2 * s) * (0.8 + 0.4 * rnd()), at, 0.08);
        jetGain.gain.setTargetAtTime((0.05 + 0.06 * s) * (0.85 + 0.3 * rnd()), at, 0.1);
      },
      (v, rnd) => (0.012 + rnd() * 0.04) / (0.6 + num(v, "size")),
      (at, v, rnd) => {
        dropFilter.frequency.setValueAtTime(1800 + rnd() * 4200, at);
        strike(dropGain.gain, at, (0.15 + 0.35 * rnd()) * (0.6 + 0.6 * num(v, "size")), 0.012 + rnd() * 0.02);
      },
    );
  },
});

/**
 * The sea on a shore: a quiet steady wash under waves that come every 6-10 s,
 * unevenly. A wave rises as a swelling low rush, breaks bright at its peak,
 * and draws back with the hiss of shingle. `strength` is the size of the waves.
 */
export const seaSurf = loop({
  id: "sea-surf",
  title: "Sea surf",
  category: "water",
  description: "Waves on the sea shore: a quiet wash with waves rising, breaking and drawing back over shingle every 6-10 s, bigger the stronger.",
  params: [
    { name: "strength", title: "Strength", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level"));
    out.connect(dest);
    // The steady wash of the sea.
    const sea = noiseSource(ctx, true);
    const wash = filter(ctx, "lowpass", 600, 0.5);
    const washGain = gain(ctx, 0.12);
    sea.connect(wash).connect(washGain).connect(out);
    sea.start(t);
    return waterLoop(
      ctx, out, [sea], t, initial, 0x5e45, 0.5,
      (at, v, rnd) => {
        washGain.gain.setTargetAtTime((0.08 + 0.08 * num(v, "strength")) * (0.85 + 0.3 * rnd()), at, 0.6);
      },
      (_v, rnd) => 6 + rnd() * 4,
      (at, v, rnd) => {
        const s = num(v, "strength");
        const size = (0.35 + 0.65 * s) * (0.8 + 0.4 * rnd());
        const rise = 1.4 + rnd() * 0.8;
        const fall = 2.2 + rnd() * 1.2;
        const peak = at + rise;
        // The wave: a rush whose filter opens as it rises and closes as it ebbs.
        const body = noiseSource(ctx, true);
        const lp = filter(ctx, "lowpass", 300, 0.6);
        const bg = gain(ctx);
        body.connect(lp).connect(bg).connect(out);
        lp.frequency.setValueAtTime(300, at);
        lp.frequency.exponentialRampToValueAtTime(2200 + 1800 * s, peak);
        lp.frequency.exponentialRampToValueAtTime(400, peak + fall);
        bg.gain.setValueAtTime(0.0001, at);
        bg.gain.exponentialRampToValueAtTime(0.55 * size, peak);
        bg.gain.exponentialRampToValueAtTime(0.0001, peak + fall);
        body.start(at);
        body.stop(peak + fall + 0.05);
        // The break: a bright splash at the crest.
        const crash = noiseSource(ctx, false);
        const hp = filter(ctx, "bandpass", 2800, 0.7);
        const cg = gain(ctx);
        crash.connect(hp).connect(cg).connect(out);
        strike(cg.gain, peak - 0.1, 0.3 * size, 0.9);
        crash.start(peak - 0.1);
        crash.stop(peak + 1);
        // The draw-back: shingle hissing as the water runs back down.
        const shingle = noiseSource(ctx, true);
        const sh = filter(ctx, "highpass", 3500, 0.7);
        const sg = gain(ctx);
        shingle.connect(sh).connect(sg).connect(out);
        sg.gain.setValueAtTime(0.0001, peak + 0.3);
        sg.gain.exponentialRampToValueAtTime(0.12 * size, peak + 0.9);
        sg.gain.exponentialRampToValueAtTime(0.0001, peak + fall + 0.6);
        shingle.start(peak + 0.3);
        shingle.stop(peak + fall + 0.7);
      },
    );
  },
});
