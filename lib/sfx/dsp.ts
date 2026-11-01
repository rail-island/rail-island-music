// Small DSP building blocks for the sound effects (docs/music/sounds.md).
// Everything here is plain arithmetic on Float32Arrays, so the generator,
// the tests, the site and the game compute the same samples. Randomness comes
// from a seeded generator only: the same call gives the same sound.

export interface Stereo {
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
  rate: number;
}

/** A seeded PRNG (mulberry32), uniform in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** White noise in [-1, 1). */
export function noise(n: number, seed: number): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = r() * 2 - 1;
  return out;
}

const TABLE_BITS = 12;
const TABLE_SIZE = 1 << TABLE_BITS;
const SINE = new Float32Array(TABLE_SIZE + 1);
for (let i = 0; i <= TABLE_SIZE; i++) SINE[i] = Math.sin((2 * Math.PI * i) / TABLE_SIZE);

/** sin(2 pi phase) by table lookup; `phase` in cycles, any value >= 0. */
export function sin1(phase: number): number {
  const p = (phase - Math.floor(phase)) * TABLE_SIZE;
  const i = p | 0;
  const f = p - i;
  return SINE[i]! + (SINE[i + 1]! - SINE[i]!) * f;
}

export type FilterType = "lowpass" | "highpass" | "bandpass";

/** An RBJ biquad; `set` may be called per sample for moving filters. */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(
    private readonly type: FilterType,
    freq: number,
    q: number,
    private readonly rate: number,
  ) {
    this.set(freq, q);
  }

  set(freq: number, q: number): void {
    const w = (2 * Math.PI * Math.min(freq, this.rate * 0.45)) / this.rate;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    let b0: number, b1: number, b2: number;
    if (this.type === "lowpass") {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = b0;
    } else if (this.type === "highpass") {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = b0;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Filter a whole buffer in place. */
export function filter(buf: Float32Array, type: FilterType, freq: number, q: number, rate: number): Float32Array {
  const f = new Biquad(type, freq, q, rate);
  for (let i = 0; i < buf.length; i++) buf[i] = f.run(buf[i]!);
  return buf;
}

/** A one-pole lowpass with a settable cutoff. */
export class OnePole {
  private y = 0;
  private k = 0;
  constructor(
    freq: number,
    private readonly rate: number,
  ) {
    this.set(freq);
  }
  set(freq: number): void {
    this.k = 1 - Math.exp((-2 * Math.PI * freq) / this.rate);
  }
  run(x: number): number {
    this.y += this.k * (x - this.y);
    return this.y;
  }
}

/** Linear ramp through [time, value] points, held flat outside them. */
export function curve(points: [number, number][]): (t: number) => number {
  return (t) => {
    if (t <= points[0]![0]) return points[0]![1];
    for (let i = 1; i < points.length; i++) {
      const [t1, v1] = points[i]!;
      if (t <= t1) {
        const [t0, v0] = points[i - 1]!;
        return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
      }
    }
    return points[points.length - 1]![1];
  };
}

export const dbToGain = (db: number): number => Math.pow(10, db / 20);

/** Scale both channels so the louder peaks at `peakDb` dBFS, and fade the ends. */
export function finish(s: Stereo, peakDb = -1, fadeIn = 0.02, fadeOut = 0.3): Stereo {
  let peak = 0;
  for (const ch of [s.left, s.right]) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]!));
  const g = peak > 0 ? dbToGain(peakDb) / peak : 0;
  const n = s.left.length;
  const fi = Math.floor(fadeIn * s.rate);
  const fo = Math.floor(fadeOut * s.rate);
  for (const ch of [s.left, s.right]) {
    for (let i = 0; i < n; i++) {
      let e = g;
      if (i < fi) e *= i / fi;
      if (i > n - fo) e *= (n - i) / fo;
      ch[i] = ch[i]! * e;
    }
  }
  return s;
}
