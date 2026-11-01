// The listener's side of a train sound (docs/music/sounds.md): a straight
// track along x, the listener `distance` metres beside it at x = 0. A source
// on the train is heard with its travel delay (so with the Doppler shift),
// spread over the stereo field by where it is, quieter and duller with
// distance. The rolling noise of the whole train and the clicks of its axles
// over the rail joints are laid on top.

import { Biquad, OnePole, type Stereo, rng } from "./dsp.ts";

const SPEED_OF_SOUND = 343;
const CONTROL_RATE = 1000;

/** Where the front of the train is (metres along the track, listener at 0) and how fast it goes. */
export interface Motion {
  duration: number;
  x(t: number): number;
  v(t: number): number;
}

/** Integrate a speed profile (m/s over seconds) from a start position. */
export function motion(x0: number, speed: (t: number) => number, duration: number): Motion {
  const n = Math.ceil(duration * CONTROL_RATE) + 2;
  const xs = new Float64Array(n);
  let x = x0;
  for (let i = 0; i < n; i++) {
    xs[i] = x;
    x += speed(i / CONTROL_RATE) / CONTROL_RATE;
  }
  const at = (t: number) => {
    const p = Math.max(0, Math.min(n - 1.001, t * CONTROL_RATE));
    const i = Math.floor(p);
    return xs[i]! + (xs[i + 1]! - xs[i]!) * (p - i);
  };
  return { duration, x: at, v: speed };
}

/** What runs on the rails: lengths in metres. */
export interface Consist {
  /** The locomotive, or the first car of a unit. */
  front: number;
  cars: number;
  carLength: number;
}

export const trainLength = (c: Consist): number => c.front + c.cars * c.carLength;

/** Axle offsets behind the front (negative metres): two two-axle bogies per vehicle. */
export function axles(c: Consist): number[] {
  const out: number[] = [];
  const vehicle = (start: number, len: number) => {
    for (const b of [start - 0.12 * len, start - 0.88 * len]) out.push(b + 1.25, b - 1.25);
  };
  vehicle(0, c.front);
  for (let i = 0; i < c.cars; i++) vehicle(-c.front - i * c.carLength, c.carLength);
  return out;
}

export function emptyStereo(duration: number, rate: number): Stereo {
  const n = Math.ceil(duration * rate);
  return { left: new Float32Array(n), right: new Float32Array(n), rate };
}

/** Level of a point at distance r, relative to `ref` metres (1/r, capped near the source). */
const spread = (r: number, ref: number) => ref / Math.max(r, ref * 0.35);

/** Air and ground take the highs away with distance. */
const cutoff = (r: number) => Math.max(1200, Math.min(15000, 15000 * Math.pow(12 / Math.max(r, 1), 0.8)));

function addPanned(out: Stereo, i: number, v: number, pan: number): void {
  const a = ((pan + 1) * Math.PI) / 4;
  out.left[i]! += v * Math.cos(a);
  out.right[i]! += v * Math.sin(a);
}

/**
 * Mix a point source riding the train `offset` metres behind its front into
 * `out`. `src` is the sound as emitted, sample i at time i / rate.
 */
export function placePoint(out: Stereo, src: Float32Array, m: Motion, offset: number, distance: number, gain: number, ref = 10): void {
  const rate = out.rate;
  const lp = new OnePole(8000, rate);
  let te = 0;
  for (let i = 0; i < out.left.length; i++) {
    const t = i / rate;
    // Solve t = te + r(te) / c by a few fixed-point steps from the last answer.
    for (let k = 0; k < 3; k++) {
      const x = m.x(Math.max(0, te)) + offset;
      te = t - Math.hypot(x, distance) / SPEED_OF_SOUND;
    }
    if (te < 0) continue;
    const p = te * rate;
    const j = Math.floor(p);
    if (j + 1 >= src.length) break;
    const s = src[j]! + (src[j + 1]! - src[j]!) * (p - j);
    const x = m.x(te) + offset;
    const r = Math.hypot(x, distance);
    if ((i & 63) === 0) lp.set(cutoff(r));
    addPanned(out, i, lp.run(s) * gain * spread(r, ref), (0.85 * x) / r);
  }
}

/**
 * The rolling noise of the whole train: each metre of it rumbles with its
 * speed, the listener hears the sum over the length (so a long fast train
 * makes the flat roar of a pass-by). `colour` shapes the noise.
 */
export function placeRolling(
  out: Stereo,
  m: Motion,
  c: Consist,
  distance: number,
  gain: number,
  colour: { low: number; high: number; speedRef: number; seed: number },
): void {
  const rate = out.rate;
  const n = out.left.length;
  const len = trainLength(c);
  const r = rng(colour.seed);
  const bandL = new Biquad("bandpass", Math.sqrt(colour.low * colour.high), 0.5, rate);
  const bandR = new Biquad("bandpass", Math.sqrt(colour.low * colour.high), 0.5, rate);
  const hp1 = new Biquad("highpass", colour.low, 0.7, rate);
  const hp2 = new Biquad("highpass", colour.low, 0.7, rate);
  const lpL = new OnePole(colour.high, rate);
  const lpR = new OnePole(colour.high, rate);
  let env = 0;
  let pan = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    if ((i & 31) === 0) {
      const front = m.x(t);
      const rear = front - len;
      // Integral of 1/r^2 over the train's length, normalised to a listener at the train's middle.
      const geo = (Math.atan(front / distance) - Math.atan(rear / distance)) / Math.PI;
      const v = Math.max(0, m.v(t));
      env = Math.sqrt(geo) * Math.pow(v / colour.speedRef, 1.3);
      const mid = (front + rear) / 2;
      const nearest = Math.max(rear, Math.min(front, 0));
      pan = (0.7 * (nearest * 0.6 + mid * 0.4)) / Math.hypot(nearest * 0.6 + mid * 0.4, distance);
      const nearDist = Math.hypot(nearest, distance);
      lpL.set(Math.min(colour.high, cutoff(nearDist)));
      lpR.set(Math.min(colour.high, cutoff(nearDist)));
    }
    const a = lpL.run(bandL.run(hp1.run(r() * 2 - 1)));
    const b = lpR.run(bandR.run(hp2.run(r() * 2 - 1)));
    const g = env * gain;
    const p = ((pan + 1) * Math.PI) / 4;
    out.left[i]! += g * (a * 0.8 + b * 0.2) * Math.cos(p) * 1.4;
    out.right[i]! += g * (b * 0.8 + a * 0.2) * Math.sin(p) * 1.4;
  }
}

/**
 * The "ta-tam" of the axles over jointed rail: every `joint` metres a click,
 * one per axle crossing it, heard from where the joint lies.
 */
export function placeJoints(out: Stereo, m: Motion, c: Consist, distance: number, gain: number, joint = 25, seed = 5): void {
  const rate = out.rate;
  const r = rng(seed);
  const offs = axles(c);
  const step = 0.002;
  const events: { t: number; x: number; v: number }[] = [];
  for (const a of offs) {
    let prev = m.x(0) + a;
    for (let t = step; t < m.duration; t += step) {
      const x = m.x(t) + a;
      const jPrev = Math.floor(prev / joint);
      const jNow = Math.floor(x / joint);
      if (jNow > jPrev) {
        const xj = jNow * joint;
        if (Math.abs(xj) < 220) events.push({ t: t + Math.hypot(xj, distance) / SPEED_OF_SOUND, x: xj, v: m.v(t) });
      }
      prev = x;
    }
  }
  events.sort((a, b) => a.t - b.t || a.x - b.x);
  const clickLen = Math.floor(0.06 * rate);
  for (const e of events) {
    if (e.v < 0.5) continue;
    const dist = Math.hypot(e.x, distance);
    const amp = gain * spread(dist, 10) * Math.min(1, Math.pow(e.v / 20, 0.8)) * (0.8 + 0.4 * r());
    const start = Math.floor(e.t * rate);
    const bp = new Biquad("bandpass", 900 + 500 * r(), 1.2, rate);
    const thump = 110 + 30 * r();
    const pan = (0.85 * e.x) / dist;
    const lp = new OnePole(cutoff(dist), rate);
    for (let k = 0; k < clickLen && start + k < out.left.length; k++) {
      const tt = k / rate;
      const v = bp.run(r() * 2 - 1) * Math.exp(-tt * 90) * 1.6 + Math.sin(2 * Math.PI * thump * tt) * Math.exp(-tt * 45);
      if (start + k >= 0) addPanned(out, start + k, lp.run(v) * amp, pan);
    }
  }
}
