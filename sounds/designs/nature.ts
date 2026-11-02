// The sounds of the land (docs/sounds/sounds.md): a forest's ambience, the
// leaves stirring in the wind with birds calling now and then. A loop like the
// water's: continuous filtered noise whose level drifts in slow gusts, and bird
// calls drawn from a seeded random sequence, so a render sounds the same every
// time. It is meant to sit far under everything else: about -38 LUFS at its
// defaults.

import { LEVEL, filter, gain, loop, noiseSource, num, seeded, voiceOf } from "../nodes.ts";
import type { SoundValues } from "../types.ts";

/** The kinds of bird call, each its own shape (`birdCall`). */
export const BIRD_CALLS = ["chirps", "whistle", "trill"] as const;
export type BirdCall = (typeof BIRD_CALLS)[number];

/** Seconds to the next bird call: the denser and livelier the woods, the sooner. */
export function birdGap(density: number, birds: number, r: number): number {
  return (2 + 6 * r) / (0.15 + 1.2 * birds * (0.3 + 0.7 * density));
}

export const woods = /* @__PURE__ */ loop({
  id: "woods",
  title: "Woods",
  category: "nature",
  description: "A forest around the listener: leaves rustling softly in the wind, and now and then a bird chirping, whistling or trilling somewhere among the trees.",
  params: [
    { name: "density", title: "Density", kind: "number", min: 0, max: 1, step: 0.05, default: 0.6 },
    { name: "birds", title: "Birds", kind: "number", min: 0, max: 1, step: 0.05, default: 0.6 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level") * 0.24);
    out.connect(dest);
    // The leaves: noise through a high band-pass, softened, with a low breath of wind.
    const air = noiseSource(ctx, true);
    const leaves = filter(ctx, "bandpass", 3200, 0.5);
    const leavesSoft = filter(ctx, "lowpass", 6500, 0.5);
    const leavesGain = gain(ctx, 0.04);
    const wind = filter(ctx, "lowpass", 300, 0.6);
    const windGain = gain(ctx, 0.05);
    air.connect(leaves).connect(leavesSoft).connect(leavesGain).connect(out);
    air.connect(wind).connect(windGain).connect(out);
    air.start(t);
    const base = voiceOf(out, [air], Infinity);
    const rnd = seeded(0x00b1d5);
    let v: SoundValues = initial;
    let nextGust = t;
    let nextBird = t + 0.8;
    let stopped = false;
    // A bird, one of a few in the woods: each has its own pitch and loudness.
    const flock = Array.from({ length: 5 }, () => ({ pitch: 2200 + rnd() * 2800, level: 0.25 + 0.75 * rnd(), call: BIRD_CALLS[Math.floor(rnd() * BIRD_CALLS.length)]! }));
    const note = (at: number, from: number, to: number, length: number, peak: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(from, at);
      osc.frequency.exponentialRampToValueAtTime(to, at + length);
      const g = gain(ctx);
      osc.connect(g).connect(out);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peak, at + Math.min(0.015, length / 3));
      g.gain.linearRampToValueAtTime(0, at + length);
      osc.start(at);
      osc.stop(at + length + 0.02);
    };
    const call = (at: number, bird: (typeof flock)[number], loud: number) => {
      const p = bird.pitch * (0.95 + 0.1 * rnd());
      const peak = 0.05 * bird.level * loud;
      if (bird.call === "chirps") {
        // Two to five short falling chirps.
        const n = 2 + Math.floor(rnd() * 4);
        for (let i = 0; i < n; i++) note(at + i * (0.09 + 0.05 * rnd()), p * 1.25, p * 0.85, 0.05 + 0.03 * rnd(), peak);
      } else if (bird.call === "whistle") {
        // A fluty two-note phrase, the second note lower or higher.
        const len = 0.18 + 0.12 * rnd();
        const second = rnd() < 0.5 ? 0.84 : 1.19;
        note(at, p * 0.6, p * 0.62, len, peak * 0.8);
        note(at + len + 0.06, p * 0.6 * second, p * 0.6 * second * 0.98, len * 1.2, peak * 0.8);
      } else {
        // A quick trill: many tiny notes alternating between two pitches.
        const n = 8 + Math.floor(rnd() * 8);
        for (let i = 0; i < n; i++) {
          const f = p * (i % 2 === 0 ? 1 : 1.12);
          note(at + i * 0.045, f, f * 0.97, 0.035, peak * (0.6 + 0.4 * (1 - i / n)));
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
        if (nextGust < now) nextGust = now;
        if (nextBird < now) nextBird = now;
        const density = num(v, "density");
        while (nextGust < now + horizon) {
          // A gust: the leaves swell and settle over a second or two.
          const gust = 0.5 + rnd();
          leavesGain.gain.setTargetAtTime((0.02 + 0.05 * density) * gust, nextGust, 0.8);
          windGain.gain.setTargetAtTime((0.03 + 0.03 * density) * (0.6 + 0.8 * rnd()), nextGust, 1);
          leaves.frequency.setTargetAtTime(2600 + 1400 * rnd(), nextGust, 0.8);
          nextGust += 1.2;
        }
        while (nextBird < now + horizon) {
          const birds = num(v, "birds");
          if (birds > 0) call(nextBird, flock[Math.floor(rnd() * flock.length)]!, 0.5 + 0.5 * density);
          nextBird += birdGap(density, birds, rnd());
        }
      },
    };
  },
});
