// The sound each kind of train makes as emitted at the source (before the
// listener's distance, Doppler and stereo; scene.ts adds those), and the
// horns and the tram bell. Each model is tuned to what the reference
// recordings in sounds/<id>/ were measured to contain (sounds/<id>/SOURCES.md).

import { Biquad, OnePole, curve, rng, sin1 } from "./dsp.ts";
import type { Motion } from "./scene.ts";

/** A first-order lag: how fast an engine follows its throttle. */
function lagged(f: (t: number) => number, tau: number, rate: number, n: number): Float32Array {
  const out = new Float32Array(n);
  let y = f(0);
  const k = 1 - Math.exp(-1 / (tau * rate));
  for (let i = 0; i < n; i++) {
    y += k * (f(i / rate) - y);
    out[i] = y;
  }
  return out;
}

/** Band-limited sum of harmonics with amplitudes amp(k, f0). */
function additive(f0: Float32Array, rate: number, maxK: number, amp: (k: number, f: number, i: number) => number): Float32Array {
  const n = f0.length;
  const out = new Float32Array(n);
  const phases = new Float64Array(maxK + 1);
  const nyq = rate * 0.45;
  const amps = new Float32Array(maxK + 1);
  for (let i = 0; i < n; i++) {
    const f = f0[i]!;
    if ((i & 15) === 0) for (let k = 1; k <= maxK; k++) amps[k] = k * f < nyq ? amp(k, f, i) : 0;
    let s = 0;
    for (let k = 1; k <= maxK; k++) {
      phases[k] = phases[k]! + (k * f) / rate;
      const a = amps[k]!;
      if (a > 1e-4) s += a * sin1(phases[k]!);
    }
    out[i] = s;
  }
  return out;
}

// ---------------------------------------------------------------- steam

/** Driving wheel diameter (m); four exhaust beats per turn of the wheels. */
const STEAM_WHEEL = 1.75;

/**
 * A steam locomotive: four chuffs per turn of the driving wheels (the SSE
 * recording starts at about 3 a second and reaches 9-10 at speed), uneven in
 * strength like a real valve gear, with the cylinder cocks hissing for the
 * first beats of a start, and a steady hiss under it all.
 */
export function steamEngine(m: Motion, throttle: (t: number) => number, startAt: number, rate: number, seed: number): Float32Array {
  const n = Math.ceil(m.duration * rate);
  const out = new Float32Array(n);
  const r = rng(seed);
  const pattern = [1, 0.72, 0.9, 0.66];
  let phase = 0.85;
  let beat = 0;
  const hissHp = new Biquad("highpass", 2500, 0.7, rate);
  const hissLp = new OnePole(9000, rate);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const v = Math.max(0, m.v(t));
    const chuffRate = (4 * v) / (Math.PI * STEAM_WHEEL);
    phase += chuffRate / rate;
    if (phase >= 1) {
      phase -= 1;
      // One chuff: a burst of noise through a resonance, shorter as the beats come faster.
      const decay = Math.min(0.16, 0.55 / Math.max(chuffRate, 1));
      const amp = pattern[beat++ % 4]! * (0.35 + 0.65 * throttle(t)) * (0.85 + 0.3 * r());
      const cocks = t < startAt + 6 ? 1 - (t - startAt) / 6 : 0;
      const len = Math.floor(decay * 5 * rate);
      const body = new Biquad("bandpass", 380 + 260 * r(), 0.9, rate);
      const air = new Biquad("bandpass", 1400 + 600 * r(), 0.7, rate);
      const hi = new Biquad("highpass", 3000, 0.7, rate);
      for (let k = 0; k < len && i + k < n; k++) {
        const tt = k / rate;
        const env = (1 - Math.exp(-tt / 0.006)) * Math.exp(-tt / decay);
        const w = r() * 2 - 1;
        let s = body.run(w) * 2.2 + air.run(w) * 0.9;
        if (cocks > 0) s += hi.run(w) * 1.6 * cocks * Math.exp(-tt / (decay * 2.5));
        out[i + k] = out[i + k]! + s * env * amp;
      }
    }
    out[i] = out[i]! + hissLp.run(hissHp.run(r() * 2 - 1)) * 0.07;
  }
  return out;
}

/** The steam whistle: the partials measured in the SSE whistle (516, 1446, 2080, 2497 Hz). */
export function steamWhistle(seconds: number, rate: number, seed: number): Float32Array {
  return chord(
    [
      { f: 516, a: 0.55 },
      { f: 1446, a: 0.62 },
      { f: 2080, a: 0.62 },
      { f: 2497, a: 1 },
    ],
    seconds,
    rate,
    seed,
    { harmonics: 2, breath: 0.35, scoop: 0.04, attack: 0.12 },
  );
}

// ---------------------------------------------------------------- diesel

/**
 * A diesel-electric locomotive. The engine turns at about 9 rev/s idling and
 * twice that at full power (the class 757 departure: its harmonic ladder
 * spaced 9 Hz, strongest near 100 Hz idling and 220-250 Hz pulling); the
 * firing pulses sit in a formant that follows the speed, a turbocharger
 * whines above it once boost builds.
 */
export function dieselEngine(m: Motion, throttle: (t: number) => number, rate: number, seed: number): Float32Array {
  const n = Math.ceil(m.duration * rate);
  const thr = lagged(throttle, 1.2, rate, n);
  const boost = lagged(throttle, 3.5, rate, n);
  const f0 = new Float32Array(n);
  for (let i = 0; i < n; i++) f0[i] = 9 + 10 * thr[i]!;
  const r = rng(seed);
  const jitter = Array.from({ length: 41 }, () => 0.6 + 0.8 * r());
  const body = additive(f0, rate, 40, (k, f, i) => {
    const formant = 11 * f;
    const x = (k * f - formant) / (0.7 * formant);
    return (Math.exp(-x * x) + 0.25 / Math.sqrt(k)) * jitter[k]! * (0.45 + 0.55 * thr[i]!);
  });
  const out = new Float32Array(n);
  const exhaust = new Biquad("bandpass", 300, 0.6, rate);
  let firing = 0;
  let turbo = 0;
  for (let i = 0; i < n; i++) {
    firing += (6 * f0[i]!) / rate;
    const pulse = Math.pow(0.5 + 0.5 * sin1(firing), 6);
    const ex = exhaust.run(r() * 2 - 1) * pulse * (0.3 + 1.2 * thr[i]!);
    turbo += (1700 + 2600 * boost[i]!) / rate;
    const tw = sin1(turbo) * 0.025 * boost[i]! * boost[i]!;
    out[i] = body[i]! * 0.09 + ex * 0.9 + tw;
  }
  return out;
}

/** The diesel's air horn: the three notes measured in the Red Library recording (296, 445, 740 Hz). */
export function dieselHorn(seconds: number, rate: number, seed: number): Float32Array {
  return chord(
    [
      { f: 296, a: 0.8 },
      { f: 445, a: 1 },
      { f: 740, a: 0.7 },
    ],
    seconds,
    rate,
    seed,
    { harmonics: 14, breath: 0.08, scoop: 0.03, attack: 0.07 },
  );
}

// ---------------------------------------------------------------- electric

/** Wheel diameter (m) and gear teeth on the axle, for the gear mesh whine. */
const ELECTRIC_WHEEL = 1.25;
const GEAR_TEETH = 79;

const gearMesh = (v: number) => (v / (Math.PI * ELECTRIC_WHEEL)) * GEAR_TEETH;

/**
 * An old DC electric locomotive with resistor control (the kind that hauled
 * Czechoslovak expresses from the 1950s to the 1990s): big blowers roar from
 * the moment it is switched on, the traction motors and their gears whine with
 * the speed, and the controller clacks from notch to notch while it pulls away,
 * each notch a small jump in the motors' pull. A compressor thumps while it
 * stands.
 */
export function oldElectricEngine(m: Motion, throttle: (t: number) => number, startAt: number, rate: number, seed: number): Float32Array {
  const n = Math.ceil(m.duration * rate);
  const out = new Float32Array(n);
  const r = rng(seed);
  const thr = lagged(throttle, 0.25, rate, n);
  const fanLp = new Biquad("lowpass", 1400, 0.7, rate);
  const fanBp = new Biquad("bandpass", 290, 4, rate);
  const brush = new Biquad("bandpass", 2400, 1.5, rate);
  const comp = new Biquad("lowpass", 180, 0.9, rate);
  let gear = 0;
  let notchGain = 1;
  let nextNotch = startAt + 0.4;
  let notches = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const v = Math.max(0, m.v(t));
    const w = r() * 2 - 1;
    // Blowers: broadband with the blade tone.
    let s = fanLp.run(w) * 0.22 + fanBp.run(w) * 0.35;
    // Compressor: about 12 strokes a second while standing.
    if (t < startAt) s += comp.run(w) * Math.pow(0.5 + 0.5 * sin1(t * 12), 8) * 1.4;
    // Controller notches while accelerating at low speed.
    if (t >= nextNotch && v < 22 && throttle(t) > 0.5 && notches < 14) {
      notches++;
      nextNotch = t + 1.1 + 0.3 * r();
      notchGain = 0.55;
      const len = Math.floor(0.05 * rate);
      const bp = new Biquad("bandpass", 2600, 2, rate);
      for (let k = 0; k < len && i + k < n; k++) out[i + k] = out[i + k]! + bp.run(r() * 2 - 1) * Math.exp((-k / rate) * 120) * 1.8;
    }
    notchGain += (1 - notchGain) * (1 / (0.35 * rate));
    // Traction motors and gears: the mesh tone, its octave and the brushes.
    const f = gearMesh(v);
    gear += f / rate;
    const load = (0.25 + 0.75 * thr[i]!) * Math.min(1, v / 6) * notchGain;
    s += (sin1(gear) * 0.5 + sin1(gear * 2 + 0.3) * 0.22 + sin1(gear * 0.5) * 0.18) * load;
    s += brush.run(w) * 0.25 * load;
    out[i] = out[i]! + s;
  }
  return out;
}

/** Two-tone horn of the old electric: not measured, a classic minor third (311 and 370 Hz). */
export function twoToneHorn(notes: [number, number], each: number, rate: number, seed: number): Float32Array {
  const a = chord([{ f: notes[0], a: 1 }], each, rate, seed, { harmonics: 12, breath: 0.06, scoop: 0.02, attack: 0.05 });
  const b = chord([{ f: notes[1], a: 1 }], each, rate, seed + 1, { harmonics: 12, breath: 0.06, scoop: 0.02, attack: 0.05 });
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * A modern three-phase electric train (an ICE pulling out of Berlin
 * Hauptbahnhof in the reference): the traction converters sing a cluster of
 * steady tones that rise only a little while it accelerates (measured: about
 * 1180, 1830, 2420, 2750 and 3070 Hz, each rising some 8 %), over the constant
 * 620 Hz of the auxiliary converter; gears and fans underneath.
 */
export const CONVERTER_TONES = [
  { f: 1180, a: 1 },
  { f: 1830, a: 0.7 },
  { f: 2420, a: 0.8 },
  { f: 2750, a: 0.5 },
  { f: 3070, a: 0.4 },
];
export const AUX_CONVERTER = 620;

export function modernElectricEngine(m: Motion, throttle: (t: number) => number, rate: number, seed: number): Float32Array {
  const n = Math.ceil(m.duration * rate);
  const out = new Float32Array(n);
  const r = rng(seed);
  const thr = lagged(throttle, 0.4, rate, n);
  const fan = new Biquad("bandpass", 1800, 0.5, rate);
  const phases = new Float64Array(CONVERTER_TONES.length);
  let aux = 0;
  let gear = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const v = Math.max(0, m.v(t));
    gear += gearMesh(v) / rate;
    aux += AUX_CONVERTER / rate;
    const rise = 1 + 0.08 * Math.min(1, v / 15);
    const on = v > 0.05 ? Math.min(1, thr[i]! * 1.2) * Math.max(0.4, 1 - v / 50) : 0;
    let tone = 0;
    for (let k = 0; k < CONVERTER_TONES.length; k++) {
      const c = CONVERTER_TONES[k]!;
      phases[k] = phases[k]! + (c.f * rise * (1 + 0.002 * sin1(t * (0.7 + k * 0.31)))) / rate;
      tone += sin1(phases[k]!) * c.a;
    }
    const gearTone = sin1(gear) * 0.25 * Math.min(1, v / 10);
    out[i] = tone * 0.12 * on + sin1(aux) * 0.05 + gearTone + fan.run(r() * 2 - 1) * 0.12;
  }
  return out;
}

// ---------------------------------------------------------------- shinkansen

/**
 * A Shinkansen set at the front: its inverters whine up as it pulls away and
 * fade under the wind at speed; the pantograph hisses with the cube of speed.
 * The roar of the pass itself is the rolling/aerodynamic noise of the whole
 * 400 m train (scene.ts): the Odawara recording shows a flat block of broadband
 * noise of about six seconds as a set passes without stopping.
 */
export function shinkansenEngine(m: Motion, rate: number, seed: number): Float32Array {
  const n = Math.ceil(m.duration * rate);
  const out = new Float32Array(n);
  const r = rng(seed);
  const hp = new Biquad("highpass", 2500, 0.7, rate);
  const lp = new OnePole(9000, rate);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, m.v(i / rate));
    const f = v < 1 ? 0 : 420 + 24 * Math.min(v, 45);
    ph += f / rate;
    const whine = v < 1 ? 0 : (sin1(ph) * 0.5 + sin1(ph * 1.5) * 0.18 + sin1(ph * 2) * 0.15) * Math.min(1, v / 3) * Math.max(0.15, 1 - v / 70);
    const panto = lp.run(hp.run(r() * 2 - 1)) * Math.pow(v / 75, 3) * 0.35;
    out[i] = whine * 0.25 + panto;
  }
  return out;
}

// ---------------------------------------------------------------- tram bell

/**
 * The bell of a Tatra tram (T3, KT4): a hammer driven by the mains-frequency
 * buzzer strikes a gong 50 times a second while the driver holds the button.
 * The partials and the strike rate are measured from the KT4DM recording:
 * 1565, 3647, 6230 (the loudest), 9295 and 12452 Hz.
 */
export const TRAM_BELL_PARTIALS = [
  { f: 1565, db: -3, decay: 0.9 },
  { f: 3647, db: -15, decay: 0.45 },
  { f: 6230, db: 0, decay: 0.4 },
  { f: 9295, db: -3, decay: 0.28 },
  { f: 12452, db: -24, decay: 0.16 },
];
export const TRAM_BELL_STRIKES = 50;

/** Ring the bell for each [start, end] press (seconds); the result runs `tail` seconds past the last. */
export function tramBell(presses: [number, number][], tail: number, rate: number, seed: number): Float32Array {
  const end = presses[presses.length - 1]![1] + tail;
  const n = Math.ceil(end * rate);
  const exc = new Float32Array(n);
  const r = rng(seed);
  for (const [a, b] of presses) {
    // The hammer needs a few strikes to swing up to full strength.
    let k = 0;
    for (let t = a; t < b; t += 1 / TRAM_BELL_STRIKES, k++) {
      const i = Math.floor((t + (r() - 0.5) * 0.0015) * rate);
      if (i >= 0 && i < n) exc[i] = exc[i]! + (1 - Math.exp(-(k + 1) / 2.2)) * (0.85 + 0.3 * r());
    }
  }
  const out = new Float32Array(n);
  for (const p of TRAM_BELL_PARTIALS) {
    // A two-pole resonator per partial.
    const w = (2 * Math.PI * p.f) / rate;
    const rad = Math.exp(-1 / (p.decay * rate));
    const c1 = 2 * rad * Math.cos(w);
    const c2 = -rad * rad;
    const g = Math.pow(10, p.db / 20) * (1 - rad) * 4;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < n; i++) {
      const y = exc[i]! * g + c1 * y1 + c2 * y2;
      y2 = y1;
      y1 = y;
      out[i] = out[i]! + y;
    }
  }
  // The hammer's own tick.
  const hp = new Biquad("highpass", 4000, 0.7, rate);
  for (let i = 0; i < n; i++) {
    const tick = exc[i]! > 0 ? exc[i]! : 0;
    out[i] = out[i]! + hp.run(tick * (r() * 2 - 1)) * 0.05;
  }
  return out;
}

// ---------------------------------------------------------------- shared

interface ChordOptions {
  /** Harmonics per note (1 = pure tone). */
  harmonics: number;
  /** Share of breathy noise around each note. */
  breath: number;
  /** The pitch starts this fraction flat and rises into tune. */
  scoop: number;
  attack: number;
}

/** A held chord of reed or whistle tones with an attack, a pitch scoop, a slight waver and a release. */
export function chord(notes: { f: number; a: number }[], seconds: number, rate: number, seed: number, o: ChordOptions): Float32Array {
  const release = 0.18;
  const n = Math.ceil((seconds + release) * rate);
  const out = new Float32Array(n);
  const r = rng(seed);
  const env = curve([
    [0, 0],
    [o.attack, 1],
    [seconds, 0.92],
    [seconds + release, 0],
  ]);
  for (const note of notes) {
    const wav = 3 + 2 * r();
    const bp = new Biquad("bandpass", note.f, 6, rate);
    let ph = r();
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const scoop = 1 - o.scoop * Math.exp(-t / (o.attack * 1.2));
      const f = note.f * scoop * (1 + 0.003 * sin1(t * wav));
      ph += f / rate;
      let s = 0;
      for (let k = 1; k <= o.harmonics; k++) if (k * f < rate * 0.45) s += sin1(ph * k) / Math.pow(k, 1.1);
      s = s * (1 - o.breath) + bp.run(r() * 2 - 1) * o.breath * 4;
      out[i] = out[i]! + s * note.a * env(t);
    }
  }
  return out;
}
