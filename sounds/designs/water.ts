// The water's sounds (docs/sounds/sounds.md): a river's rapids, a waterfall and
// a spring, which in the game is a fountain. All three are loops built from
// filtered noise whose filters and gains wander, plus scattered events -- the
// bubbles of a rapid, the droplets of a fountain -- drawn from a seeded random
// sequence, so a render sounds the same every time. A loop schedules only as far
// ahead as it is ticked, like every loop here.

import { LEVEL, filter, gain, loop, noiseSource, num, seeded, strike, voiceOf } from "../nodes.ts";
import type { LoopVoice, SoundValues } from "../types.ts";

export { seeded };

/**
 * How loud each water loop plays at `level` 1, as a factor on its output. The
 * water is ambient and plays for as long as it is in view, so it sits well below
 * the trains: about -31 LUFS for a rapid, a fall or a spring and -33 LUFS for the
 * surf at their defaults, under a running steam beat (about -30 LUFS) and far
 * under a horn (about -15 LUFS). Without it they played at -14 to -22 LUFS,
 * louder than any locomotive.
 */
export const WATER_TRIM = {
  "river-rapids": 0.12,
  waterfall: 0.14,
  "spring-fountain": 0.15,
  "sea-surf": 0.25,
} as const;


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

export const riverRapids = /* @__PURE__ */ loop({
  id: "river-rapids",
  title: "River rapids",
  category: "water",
  description: "A river running fast over rocks: a rushing bed of water with bubbles and gurgles on top, stronger the steeper and wider the rapid.",
  params: [
    { name: "strength", title: "Strength", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level") * WATER_TRIM["river-rapids"]);
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

export const waterfall = /* @__PURE__ */ loop({
  id: "waterfall",
  title: "Waterfall",
  category: "water",
  description: "Water falling over a lip into a pool: a steady roar, deeper and louder the bigger the fall, with a hiss of spray.",
  params: [
    { name: "size", title: "Size", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level") * WATER_TRIM["waterfall"]);
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

export const springFountain = /* @__PURE__ */ loop({
  id: "spring-fountain",
  title: "Spring fountain",
  category: "water",
  description: "A spring, which the game draws as a fountain: jets splashing back into a basin, a bright patter of droplets over a soft hiss.",
  params: [
    { name: "size", title: "Size", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level") * WATER_TRIM["spring-fountain"]);
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
 * The sea on a shore: a steady wash, its low rush and its hiss slowly swelling
 * and settling, with no single waves. `strength` is how loud and full it is.
 */
export const seaSurf = /* @__PURE__ */ loop({
  id: "sea-surf",
  title: "Sea surf",
  category: "water",
  description: "The sea on the shore: a steady wash that slowly swells and settles, fuller the stronger.",
  params: [
    { name: "strength", title: "Strength", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level") * WATER_TRIM["sea-surf"]);
    out.connect(dest);
    const sea = noiseSource(ctx, true);
    // The rush of the water and the hiss on top of it.
    const rush = filter(ctx, "lowpass", 700, 0.5);
    const rushGain = gain(ctx, 0.3);
    const hiss = filter(ctx, "bandpass", 2400, 0.6);
    const hissGain = gain(ctx, 0.05);
    sea.connect(rush).connect(rushGain).connect(out);
    sea.connect(hiss).connect(hissGain).connect(out);
    sea.start(t);
    return waterLoop(
      ctx, out, [sea], t, initial, 0x5e45, 0.7,
      (at, v, rnd) => {
        const s = num(v, "strength");
        // A slow swell: the filter and the level drift, never a break.
        rush.frequency.setTargetAtTime(500 + 300 * s + rnd() * 250, at, 0.9);
        rushGain.gain.setTargetAtTime((0.18 + 0.22 * s) * (0.8 + 0.4 * rnd()), at, 0.9);
        hissGain.gain.setTargetAtTime((0.03 + 0.04 * s) * (0.7 + 0.6 * rnd()), at, 0.7);
      },
      () => 1,
      () => {},
    );
  },
});
