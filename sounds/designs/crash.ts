// A train crash (docs/sounds/sounds.md, "The train crash"): the game plays it at
// the point where two trains collide. Modelled without a reference recording: the
// parts below are what a collision of steel rail vehicles is made of, not
// measurements.
//
//   * the impact: a deep thump (a sine falling 80 -> 28 Hz) and a broadband burst
//   * the steel: inharmonic partials of crumpling metal, struck at the impact and
//     again, softer, as the cars behind run into the ones in front (CRUMPLES)
//   * the scrape: band-passed noise sliding down as the cars grind off the rail
//   * the debris: short knocks and clanks scattered over the next second and a
//     half, thinning out, drawn from a seeded sequence so a render is the same
//     every time
//   * the rumble: low-passed noise dying away under it all
//
// `size` (0 a light railcar, 1 two heavy trains) makes it lower, longer and denser.

import { LEVEL, filter, gain, noiseSource, num, oneShot, seeded, strike, voiceOf } from "../nodes.ts";
import type { SoundParam, SoundValues, Voice } from "../types.ts";

/** Partials of the crumpling steel, as ratios to the base (`metalBase`). */
export const CRASH_METAL = [1, 1.57, 2.36, 3.62, 5.1, 7.13] as const;
/** The later, softer strikes of the steel: [seconds after the impact, strength]. */
export const CRASH_CRUMPLES = [[0, 1], [0.17, 0.55], [0.36, 0.35], [0.62, 0.2]] as const;

const SIZE: SoundParam = { name: "size", title: "Size", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 };

/** The steel's lowest partial (Hz): lower the heavier the trains. */
export function metalBase(size: number): number {
  return 340 - 150 * size;
}

/** How long the crash lasts (s), to its last debris and the rumble's end. */
export function crashLength(size: number): number {
  return 2.2 + 1.2 * size;
}

function play(ctx: BaseAudioContext, dest: AudioNode, t: number, v: SoundValues): Voice {
  const size = num(v, "size");
  const length = crashLength(size);
  const out = gain(ctx, 0.9 * num(v, "level"));
  out.connect(dest);
  const sources: AudioScheduledSourceNode[] = [];
  const stopAt = t + length + 0.05;

  // the impact's thump
  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(80 - 20 * size, t);
  thump.frequency.exponentialRampToValueAtTime(28, t + 0.45);
  const thumpGain = gain(ctx);
  thump.connect(thumpGain).connect(out);
  strike(thumpGain.gain, t, 0.9, 0.7 + 0.3 * size);
  sources.push(thump);

  // the burst, the scrape, the rumble and the debris share one noise buffer each
  const burst = noiseSource(ctx, false);
  const burstLp = filter(ctx, "lowpass", 3200 - 1200 * size);
  const burstGain = gain(ctx);
  burst.connect(burstLp).connect(burstGain).connect(out);
  strike(burstGain.gain, t, 0.85, 0.35 + 0.15 * size);
  sources.push(burst);

  const scrape = noiseSource(ctx, true);
  const scrapeBp = filter(ctx, "bandpass", 2600, 6);
  scrapeBp.frequency.setValueAtTime(3100, t + 0.1);
  scrapeBp.frequency.exponentialRampToValueAtTime(900, t + 1.3 + 0.4 * size);
  const scrapeGain = gain(ctx);
  scrape.connect(scrapeBp).connect(scrapeGain).connect(out);
  scrapeGain.gain.setValueAtTime(0.0001, t);
  scrapeGain.gain.exponentialRampToValueAtTime(0.32, t + 0.18);
  scrapeGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4 + 0.5 * size);
  sources.push(scrape);

  const rumble = noiseSource(ctx, true);
  const rumbleLp = filter(ctx, "lowpass", 220 - 80 * size);
  const rumbleGain = gain(ctx);
  rumble.connect(rumbleLp).connect(rumbleGain).connect(out);
  strike(rumbleGain.gain, t, 1.1, length);
  sources.push(rumble);

  // the steel: one oscillator per partial, re-struck at every crumple
  const base = metalBase(size);
  const metalOut = gain(ctx, 0.22);
  const metalHp = filter(ctx, "highpass", 160);
  metalOut.connect(metalHp).connect(out);
  CRASH_METAL.forEach((ratio, i) => {
    const osc = ctx.createOscillator();
    osc.type = i % 2 === 0 ? "triangle" : "sine";
    osc.frequency.value = base * ratio;
    // a crumpling sheet does not hold its pitch: each partial sags a little
    osc.frequency.setValueAtTime(base * ratio, t);
    osc.frequency.exponentialRampToValueAtTime(base * ratio * 0.93, t + 1.2);
    const g = gain(ctx);
    osc.connect(g).connect(metalOut);
    const level = 1 / (1 + i * 0.45);
    const decay = (1.6 - i * 0.18) * (0.8 + 0.4 * size);
    g.gain.setValueAtTime(0.0001, t);
    for (const [at, strength] of CRASH_CRUMPLES) {
      const s = t + at;
      g.gain.setTargetAtTime(Math.max(0.0001, level * strength), s, 0.003);
      g.gain.setTargetAtTime(0.0001, s + 0.01, decay / 5);
    }
    osc.start(t);
    osc.stop(stopAt);
    sources.push(osc);
  });

  // the debris: knocks scattered after the impact, thinning out
  const rand = seeded(0xc4a5);
  const debrisCount = Math.round(14 + 14 * size);
  for (let i = 0; i < debrisCount; i++) {
    const at = t + 0.12 + Math.pow(rand(), 1.8) * (length - 0.5);
    const knock = noiseSource(ctx, false);
    const bp = filter(ctx, "bandpass", 500 + rand() * 3500, 3 + rand() * 6);
    const kg = gain(ctx);
    knock.connect(bp).connect(kg).connect(out);
    strike(kg.gain, at, 0.15 + 0.35 * rand() * (1 - (at - t) / length), 0.04 + rand() * 0.12);
    knock.start(at);
    knock.stop(at + 0.25);
    sources.push(knock);
  }

  for (const s of [thump, burst, scrape, rumble]) {
    s.start(t);
    s.stop(stopAt);
  }
  return voiceOf(out, sources, t + length + 0.1);
}

export const trainCrash = /* @__PURE__ */ oneShot({
  id: "train-crash",
  title: "Train crash",
  category: "trains",
  description: "Two trains colliding: an impact, crumpling steel, a scrape off the rail and debris settling.",
  params: [SIZE, LEVEL],
  play,
});
