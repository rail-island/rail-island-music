// Diesel engines: the running engine of a locomotive, a railcar, a bus or a
// truck, and its start and stop (docs/sounds/diesel.md). Every engine is one
// profile of DIESEL_PROFILES, matched to recordings of real engines: how many
// cylinders fire per cycle and how unevenly, how fast it idles and runs, how
// bright its exhaust is, how hard its combustion knocks, its turbo and fan.
//
// One engine cycle is drawn as a waveform (one pressure pulse per cylinder, each
// a little different) and played as a PeriodicWave at the cycle's rate, so the
// spectrum has the firing order's lines and, from the unevenness, the half
// orders and the once-per-turn lope a real engine has. The same cycle as sharp
// spikes gates a band of noise (the diesel knock) and as soft lumps the
// exhaust's breath, in step with the tone.

import { LEVEL, choice, filter, gain, loop, noiseSource, num, oneShot, seeded, voiceOf } from "../nodes.ts";
import type { SoundParam, SoundValues } from "../types.ts";

/** One kind of diesel engine, as measured from recordings (docs/sounds/diesel.md). */
export interface DieselProfile {
  title: string;
  cylinders: number;
  /** 4: a cylinder fires every second turn; 2: every turn. */
  strokes: 2 | 4;
  /** Revolutions per minute at idle and at full revs (`rpm` 0 and 1). */
  idleRpm: number;
  maxRpm: number;
  /** How unevenly the cylinders fire, 0..1: the lope. */
  uneven: number;
  /** A firing pulse's decay as a fraction of the gap between firings: small is sharp and bright. */
  pulse: number;
  /** The low-pass over the tone, Hz, idling and working hard. */
  bright: [number, number];
  /** The exhaust's resonance: frequency Hz, Q, gain dB. */
  body: [number, number, number];
  /** The knock of the combustion: band centre Hz, level. */
  knock: [number, number];
  /** The exhaust's breath: low-passed noise level. */
  breath: number;
  /** The turbo's whine, Hz at idle and at full revs and effort, and its level (0: none). */
  turbo: [number, number, number];
  /** An air-cooled engine's fan: band-passed noise level (0: none). */
  fan: number;
  /** Seconds it takes to run down once the fuel is cut. */
  rundown: number;
  /** The output trim, so every profile runs at about the same loudness. */
  trim: number;
}

export const DIESEL_PROFILES = {
  railcar: {
    title: "Railcar (inline six)",
    cylinders: 6,
    strokes: 4,
    idleRpm: 600,
    maxRpm: 2000,
    uneven: 0.4,
    pulse: 0.5,
    bright: [2000, 3000],
    body: [190, 1.4, 6],
    knock: [2300, 0.5],
    breath: 0.8,
    turbo: [2400, 5200, 0.012],
    fan: 0,
    rundown: 1.6,
    trim: 1.24,
  },
  shunter: {
    title: "Shunter (medium-speed six)",
    cylinders: 6,
    strokes: 4,
    idleRpm: 420,
    maxRpm: 1250,
    uneven: 0.45,
    pulse: 0.55,
    bright: [1700, 2600],
    body: [120, 1.3, 7],
    knock: [1600, 0.45],
    breath: 0.9,
    turbo: [1800, 4200, 0.014],
    fan: 0,
    rundown: 2.6,
    trim: 1.26,
  },
  mainline: {
    title: "Mainline (V12, turbocharged)",
    cylinders: 12,
    strokes: 4,
    idleRpm: 400,
    maxRpm: 1100,
    uneven: 0.35,
    pulse: 0.55,
    bright: [1800, 2800],
    body: [140, 1.2, 6],
    knock: [1500, 0.35],
    breath: 1.0,
    turbo: [1500, 3800, 0.03],
    fan: 0,
    rundown: 3.4,
    trim: 1,
  },
  "two-stroke": {
    title: "Two-stroke (V16, turbocharged)",
    cylinders: 16,
    strokes: 2,
    idleRpm: 315,
    maxRpm: 904,
    uneven: 0.3,
    pulse: 0.6,
    bright: [2000, 3000],
    body: [170, 1.1, 5],
    knock: [1300, 0.25],
    breath: 1.1,
    turbo: [1200, 3400, 0.04],
    fan: 0,
    rundown: 4,
    trim: 0.84,
  },
  bus: {
    title: "Bus (inline six, turbocharged)",
    cylinders: 6,
    strokes: 4,
    idleRpm: 600,
    maxRpm: 2200,
    uneven: 0.3,
    pulse: 0.55,
    bright: [1400, 2400],
    body: [180, 1.2, 5],
    knock: [2000, 0.4],
    breath: 0.7,
    turbo: [2800, 6200, 0.01],
    fan: 0,
    rundown: 1.2,
    trim: 1.3,
  },
  truck: {
    title: "Truck (air-cooled V8)",
    cylinders: 8,
    strokes: 4,
    idleRpm: 650,
    maxRpm: 2300,
    uneven: 0.5,
    pulse: 0.45,
    bright: [2400, 3400],
    body: [210, 1.5, 6],
    knock: [2500, 0.65],
    breath: 0.7,
    turbo: [0, 0, 0],
    fan: 0.25,
    rundown: 1.1,
    trim: 1.33,
  },
} satisfies Record<string, DieselProfile>;

export type DieselEngineKind = keyof typeof DIESEL_PROFILES;

/** The profile a value names; an unknown one is the mainline engine. */
export function dieselProfile(engine: string): DieselProfile {
  return (DIESEL_PROFILES as Record<string, DieselProfile>)[engine] ?? DIESEL_PROFILES.mainline;
}

/** Which engine it is: the game picks it from the vehicle. */
const ENGINE: SoundParam = {
  name: "engine",
  title: "Engine",
  kind: "choice",
  values: Object.entries(DIESEL_PROFILES).map(([value, p]) => ({ value, title: p.title })),
  default: "mainline",
};

/** A finer size within the profile: 0 small and quick, 1 big and slow; 0.5 is the profile as measured. */
const SIZE: SoundParam = { name: "size", title: "Size", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 };

/** How much `size` scales a profile's revs: 1.2 at 0, 1 at 0.5, 0.8 at 1. */
function sizeScale(size: number): number {
  return 1.2 - 0.4 * size;
}

/** The engine's speed, revolutions per minute, at `rpm` 0..1 (idle..full revs). */
export function dieselRpm(engine: string, size: number, rpm: number): number {
  const p = dieselProfile(engine);
  return (p.idleRpm + (p.maxRpm - p.idleRpm) * rpm) * sizeScale(size);
}

/** Engine cycles per second: one cycle is every cylinder firing once. */
function cycleRate(p: DieselProfile, revs: number): number {
  return revs / 60 / (p.strokes === 4 ? 2 : 1);
}

/**
 * A diesel engine's firing rate, in combustions per second, from how big it is
 * and how fast it turns: its revs times the cylinders firing per turn.
 */
export function dieselFiring(size: number, rpm: number, engine = "mainline"): number {
  const p = dieselProfile(engine);
  return cycleRate(p, dieselRpm(engine, size, rpm)) * p.cylinders;
}

/** How loud a diesel engine runs, 0..1, from its revs and how hard it works. */
export function dieselLevel(rpm: number, load: number): number {
  return 0.35 + 0.3 * rpm + 0.35 * load;
}

/** Harmonics drawn per cycle: enough for the tone up to a few kHz at idle. */
const HARMONICS = 192;
const SAMPLES = 2048;

/**
 * One engine cycle sampled: a pulse per cylinder, each fired a little early or
 * late and a little stronger or weaker (seeded per profile, so an engine always
 * lopes the same way). `decay` is the pulse's decay as a fraction of the gap
 * between firings; `power` sharpens its peak.
 */
export function cycleShape(p: DieselProfile, decay: number, power: number): Float64Array {
  const rnd = seeded(p.cylinders * 977 + p.idleRpm);
  const n = p.cylinders;
  const gap = 1 / n;
  const out = new Float64Array(SAMPLES);
  for (let c = 0; c < n; c++) {
    const strength = 1 - p.uneven * rnd();
    const at = c * gap + (rnd() - 0.5) * p.uneven * 0.15 * gap;
    for (let i = 0; i < SAMPLES; i++) {
      // time since this cylinder fired, in cycles, wrapped round the cycle
      let dt = i / SAMPLES - at;
      dt -= Math.floor(dt);
      const rise = 1 - Math.exp(-dt / (0.04 * gap));
      out[i]! += strength * rise * Math.exp(-dt / (decay * gap)) ** power;
    }
  }
  return out;
}

/** The Fourier series of a sampled cycle, for a PeriodicWave; also its mean (the DC a PeriodicWave drops). */
export function cycleSeries(shape: Float64Array): { real: Float32Array; imag: Float32Array; mean: number; peak: number } {
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  let mean = 0;
  let peak = 0;
  for (const v of shape) {
    mean += v;
    peak = Math.max(peak, v);
  }
  mean /= shape.length;
  for (let k = 1; k <= HARMONICS; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const a = (2 * Math.PI * k * i) / SAMPLES;
      re += shape[i]! * Math.cos(a);
      im += shape[i]! * Math.sin(a);
    }
    real[k] = (2 * re) / SAMPLES;
    imag[k] = (2 * im) / SAMPLES;
  }
  return { real, imag, mean, peak };
}

type Waves = { tone: PeriodicWave; knock: PeriodicWave; breath: PeriodicWave; knockMean: number; breathMean: number };

const waveCache = new WeakMap<BaseAudioContext, Map<DieselProfile, Waves>>();

/** A profile's three cycle waves on one context, computed once. */
function wavesOf(ctx: BaseAudioContext, p: DieselProfile): Waves {
  let byProfile = waveCache.get(ctx);
  if (!byProfile) {
    byProfile = new Map();
    waveCache.set(ctx, byProfile);
  }
  let w = byProfile.get(p);
  if (!w) {
    const make = (decay: number, power: number) => {
      const s = cycleSeries(cycleShape(p, decay, power));
      // Scaled so the pulses peak near 1 over a mean the gain's base level adds back.
      const scale = 1 / Math.max(1e-6, s.peak - s.mean);
      const real = s.real.map((v) => v * scale);
      const imag = s.imag.map((v) => v * scale);
      return { wave: ctx.createPeriodicWave(real, imag, { disableNormalization: true }), mean: s.mean * scale };
    };
    const tone = make(p.pulse, 1);
    const knock = make(0.1, 1);
    const breath = make(0.8, 1);
    w = { tone: tone.wave, knock: knock.wave, breath: breath.wave, knockMean: knock.mean, breathMean: breath.mean };
    byProfile.set(p, w);
  }
  return w;
}

/** What an engine is doing at a moment: its speed, how hard it works, whether it burns fuel. */
interface EngineState {
  /** Revolutions per minute (0: stopped). */
  revs: number;
  /** 0..1. */
  load: number;
  /** 0: turned without fuel (between coughs, running down); 1: firing. */
  fire: number;
  /** The turbo's speed, 0..1 (it lags the engine). */
  turbo: number;
}

/** The nodes of one running engine, and how to drive them. */
interface Engine {
  sources: AudioScheduledSourceNode[];
  /** Glide every part to `s` from `at`, over about `tau` seconds. */
  drive(at: number, s: EngineState, tau: number): void;
  /** Switch to another profile's waves and colours from `at` on. */
  setProfile(at: number, p: DieselProfile): void;
}

/** How far the knock and the breath stay open between firings (the pulses peak at 1 above it). */
const KNOCK_FLOOR = 0.35;
const BREATH_FLOOR = 0.8;

function buildEngine(ctx: BaseAudioContext, into: AudioNode, t: number, first: DieselProfile): Engine {
  let p = first;
  let w = wavesOf(ctx, p);
  // Every part goes through the master, which rises with the revs and the effort.
  const master = gain(ctx);
  master.connect(into);
  const dest = master;
  // The tone: the cycle's pressure pulses through the exhaust's resonance and a low-pass.
  const tone = ctx.createOscillator();
  tone.setPeriodicWave(w.tone);
  const toneGain = gain(ctx);
  const lp = filter(ctx, "lowpass", p.bright[0], 0.8);
  const body = filter(ctx, "peaking", p.body[0], p.body[1]);
  body.gain.value = p.body[2];
  // Below the firing rate there is little: a microphone, or a listener, hears
  // the exhaust's bark, not the pressure's swell.
  const shelf = filter(ctx, "lowshelf", 160);
  shelf.gain.value = -12;
  tone.connect(toneGain).connect(shelf).connect(body).connect(lp).connect(dest);
  // The knock: noise in a band, gated by sharp spikes at every firing.
  const knockSrc = noiseSource(ctx, true);
  const knockBand = filter(ctx, "bandpass", p.knock[0], 0.9);
  const knockGate = gain(ctx);
  const knockLevel = gain(ctx);
  const knockOsc = ctx.createOscillator();
  knockOsc.setPeriodicWave(w.knock);
  const knockDepth = gain(ctx, 1);
  knockOsc.connect(knockDepth).connect(knockGate.gain);
  knockSrc.connect(knockBand).connect(knockGate).connect(knockLevel).connect(dest);
  // The breath: low-passed noise in soft lumps, the exhaust between the lines.
  const breathSrc = noiseSource(ctx, true);
  const breathLp = filter(ctx, "lowpass", 1200, 0.5);
  const breathGate = gain(ctx);
  const breathLevel = gain(ctx);
  const breathOsc = ctx.createOscillator();
  breathOsc.setPeriodicWave(w.breath);
  const breathDepth = gain(ctx, 1);
  breathOsc.connect(breathDepth).connect(breathGate.gain);
  breathSrc.connect(breathLp).connect(breathGate).connect(breathLevel).connect(dest);
  // The turbo: a whine with a little air around it.
  const turbo = ctx.createOscillator();
  turbo.type = "sine";
  const turboGain = gain(ctx);
  turbo.connect(turboGain).connect(dest);
  // An air-cooled engine's fan: a broad band of noise.
  const fanSrc = noiseSource(ctx, true);
  const fanBand = filter(ctx, "bandpass", 900, 0.6);
  const fanGain = gain(ctx);
  fanSrc.connect(fanBand).connect(fanGain).connect(dest);

  const cyclers = [tone, knockOsc, breathOsc];
  for (const o of cyclers) o.frequency.value = 0;
  tone.start(t);
  knockOsc.start(t);
  breathOsc.start(t);
  turbo.start(t);
  // The noises start at different points of the shared buffer, so they do not hiss in step.
  knockSrc.start(t, 0.0);
  breathSrc.start(t, 0.61);
  fanSrc.start(t, 1.27);

  const setProfile = (at: number, next: DieselProfile) => {
    p = next;
    w = wavesOf(ctx, p);
    tone.setPeriodicWave(w.tone);
    knockOsc.setPeriodicWave(w.knock);
    breathOsc.setPeriodicWave(w.breath);
    body.frequency.setValueAtTime(p.body[0], at);
    body.Q.setValueAtTime(p.body[1], at);
    body.gain.setValueAtTime(p.body[2], at);
    knockBand.frequency.setValueAtTime(p.knock[0], at);
  };

  return {
    sources: [tone, knockOsc, breathOsc, turbo, knockSrc, breathSrc, fanSrc],
    setProfile,
    drive(at, s, tau) {
      const idle = p.idleRpm;
      // 0 stopped, 1 idle, more when revving
      const turning = s.revs / idle;
      const speed = Math.min(1, turning);
      const rev01 = Math.max(0, Math.min(1, (s.revs - idle) / (p.maxRpm - idle)));
      const rate = cycleRate(p, s.revs);
      for (const o of cyclers) o.frequency.setTargetAtTime(rate, at, tau);
      // Turning without fuel is only the compression's dull thump.
      const work = s.fire * (0.55 + 0.45 * s.load);
      toneGain.gain.setTargetAtTime(speed * (0.35 + 0.65 * s.fire) * (0.7 + 0.3 * rev01) * 0.4, at, tau);
      lp.frequency.setTargetAtTime(
        (0.45 + 0.55 * s.fire) * (p.bright[0] + (p.bright[1] - p.bright[0]) * Math.min(1, 0.5 * s.load + 0.5 * rev01)),
        at,
        tau,
      );
      // A gate's gain is its mean plus the spikes: silence between firings.
      const k = p.knock[1] * s.fire * speed * (1 - 0.4 * s.load) * 0.5;
      knockGate.gain.setTargetAtTime(w.knockMean + KNOCK_FLOOR, at, tau);
      knockLevel.gain.setTargetAtTime(k, at, tau);
      knockBand.frequency.setTargetAtTime(p.knock[0] * (0.9 + 0.3 * rev01), at, tau);
      const b = p.breath * speed * (0.25 + 0.75 * work) * 0.6;
      breathGate.gain.setTargetAtTime(w.breathMean + BREATH_FLOOR, at, tau);
      breathLevel.gain.setTargetAtTime(b, at, tau);
      breathLp.frequency.setTargetAtTime(450 + 700 * rev01 + 350 * s.load, at, tau);
      master.gain.setTargetAtTime(dieselLevel(rev01, s.load) * p.trim, at, tau);
      const [tLo, tHi, tLevel] = p.turbo;
      turbo.frequency.setTargetAtTime(Math.max(1, tLo * 0.3 + (tHi - tLo * 0.3) * s.turbo), at, tau);
      turboGain.gain.setTargetAtTime(tLevel * Math.min(1, s.turbo * 1.6), at, tau);
      fanGain.gain.setTargetAtTime(p.fan * speed * (0.4 + 0.6 * rev01) * 0.3, at, tau);
    },
  };
}

/** How fast the turbo spins, 0..1, at `rpm` and `load` 0..1. */
function turboSpeed(rpm: number, load: number): number {
  return 0.25 + 0.45 * rpm + 0.3 * load * (0.4 + 0.6 * rpm);
}

/** Overall loudness of the engine sounds, against the other loops (docs/sounds/sounds.md, levels). */
const DIESEL_TRIM = 0.138;

export const dieselEngine = /* @__PURE__ */ loop({
  id: "diesel-engine",
  title: "Diesel engine",
  category: "trains",
  description:
    "A running diesel: a locomotive's, a railcar's, a bus's or a truck's engine (`engine`), idling and revving with the speed, growling and knocking harder as it works, with its turbo's whine.",
  params: [
    { name: "rpm", title: "Revs", kind: "number", min: 0, max: 1, step: 0.05, default: 0.4 },
    { name: "load", title: "Effort", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    SIZE,
    ENGINE,
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level") * DIESEL_TRIM);
    out.connect(dest);
    let engineName = choice(initial, "engine");
    const engine = buildEngine(ctx, out, t, dieselProfile(engineName));
    const base = voiceOf(out, engine.sources, Infinity);
    const rnd = seeded(0xd1e5);
    let v: SoundValues = initial;
    let next = t;
    let stopped = false;
    // An engine has inertia: every change glides over about half a second, the turbo slower.
    const apply = (at: number, wobble: number, tau: number) => {
      const rpm = num(v, "rpm");
      const load = num(v, "load");
      const name = choice(v, "engine");
      if (name !== engineName) {
        engineName = name;
        engine.setProfile(at, dieselProfile(name));
      }
      engine.drive(
        at,
        { revs: dieselRpm(name, num(v, "size"), rpm) * wobble, load, fire: 1, turbo: turboSpeed(rpm, load) },
        tau,
      );
    };
    // At once at the start, so a loop taking over from `diesel-start` is there at its level.
    apply(t, 1, 0.01);
    next = t + 0.3;
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
        if (next < now) next = now;
        // The revs never sit quite still: a small drift every 0.3 s (the governor hunting).
        while (next < now + horizon) {
          apply(next, 0.99 + 0.02 * rnd(), 0.35);
          next += 0.3;
        }
      },
    };
  },
});

/** How long the engine coughs before it catches: the start begins with the first cough. */
const COUGHING = 0.5;

/**
 * The start's moments, seconds after it begins: the engine catches, and the
 * sound has handed over to the loop. The same for every engine: there is no
 * starter and no cranking to hear, only the engine coming to life.
 */
export function dieselStartTimes(_engine: string): { catches: number; idles: number; ends: number } {
  const catches = COUGHING;
  const idles = catches + 1.8;
  return { catches, idles, ends: idles + 0.6 };
}

export const dieselStart = /* @__PURE__ */ oneShot({
  id: "diesel-start",
  title: "Diesel engine start",
  category: "trains",
  description:
    "A diesel being started: silent until it coughs, then it catches, flares and settles to idle. The game starts `diesel-engine` at idle as this one fades out.",
  params: [SIZE, ENGINE, LEVEL],
  play(ctx, dest, t, v) {
    const name = choice(v, "engine");
    const p = dieselProfile(name);
    const out = gain(ctx, num(v, "level") * DIESEL_TRIM);
    out.connect(dest);
    const engine = buildEngine(ctx, out, t, p);
    const idle = dieselRpm(name, num(v, "size"), 0);
    const coughRevs = Math.min(220, idle * 0.45);
    const { catches, idles, ends } = dieselStartTimes(name);
    const sources = [...engine.sources];
    // No starter and no cranking (silence until the first cough): a few
    // cylinders fire, then more, unevenly, as it catches.
    const rnd = seeded(p.cylinders * 31 + p.idleRpm);
    const coughs = 6;
    for (let i = 0; i < coughs; i++) {
      const at = t + (i * COUGHING) / coughs;
      const fire = i % 2 === 0 ? 0.3 + 0.5 * rnd() : 0.05;
      engine.drive(at, { revs: coughRevs * (1 + i * 0.12), load: 0.3, fire, turbo: 0 }, 0.03);
    }
    // It catches and flares past idle, then the governor pulls it back.
    engine.drive(t + catches, { revs: idle * 1.45, load: 0.6, fire: 1, turbo: 0.3 }, 0.22);
    engine.drive(t + catches + 0.8, { revs: idle, load: 0.1, fire: 1, turbo: turboSpeed(0, 0.1) }, 0.4);
    // The sound fades out at idle as the loop takes over.
    out.gain.setValueAtTime(num(v, "level") * DIESEL_TRIM, t + idles);
    out.gain.linearRampToValueAtTime(0, t + ends);
    for (const s of engine.sources) s.stop(t + ends + 0.05);
    return voiceOf(out, sources, t + ends);
  },
});

/** The stop's moments, seconds after it begins: the fuel is cut, the engine stands still, the sound ends. */
export function dieselStopTimes(engine: string): { cut: number; still: number; ends: number } {
  const p = dieselProfile(engine);
  const cut = 0.3;
  const still = cut + p.rundown;
  // The turbo spins on a while after the engine stops.
  return { cut, still, ends: still + Math.max(0.6, p.turbo[2] > 0 ? p.rundown * 0.8 : 0.6) };
}

export const dieselStop = /* @__PURE__ */ oneShot({
  id: "diesel-stop",
  title: "Diesel engine stop",
  category: "trains",
  description:
    "A diesel being shut down from idle: the fuel is cut, it runs down through its last compressions and rocks to a stop while the turbo spins down. The game stops `diesel-engine` as this one starts.",
  params: [SIZE, ENGINE, LEVEL],
  play(ctx, dest, t, v) {
    const name = choice(v, "engine");
    const p = dieselProfile(name);
    const level = num(v, "level") * DIESEL_TRIM;
    const out = gain(ctx);
    out.connect(dest);
    // Fade in over the loop's own fade out.
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(level, t + 0.06);
    const engine = buildEngine(ctx, out, t, p);
    const idle = dieselRpm(name, num(v, "size"), 0);
    const { cut, still, ends } = dieselStopTimes(name);
    engine.drive(t, { revs: idle, load: 0.1, fire: 1, turbo: turboSpeed(0, 0.1) }, 0.01);
    // Fuel cut: no more combustion; it coasts down through its compressions.
    engine.drive(t + cut, { revs: idle * 0.55, load: 0, fire: 0, turbo: turboSpeed(0, 0.1) }, p.rundown * 0.25);
    engine.drive(t + cut + p.rundown * 0.45, { revs: 0, load: 0, fire: 0, turbo: 0 }, p.rundown * 0.22);
    // The turbo spins down on its own, slower.
    engine.drive(t + still, { revs: 0, load: 0, fire: 0, turbo: 0 }, (ends - still) / 3);
    const sources = [...engine.sources];
    // It rocks back on the last compression: a dull knock.
    const thud = noiseSource(ctx, false);
    const lp = filter(ctx, "lowpass", 180, 1.5);
    const tg = gain(ctx);
    thud.connect(lp).connect(tg).connect(out);
    tg.gain.setValueAtTime(0, t + still - 0.1);
    tg.gain.linearRampToValueAtTime(0.9, t + still - 0.09);
    tg.gain.setTargetAtTime(0, t + still - 0.08, 0.06);
    thud.start(t + still - 0.1, 0.9);
    thud.stop(t + still + 0.4);
    sources.push(thud);
    out.gain.setValueAtTime(level, t + ends - 0.2);
    out.gain.linearRampToValueAtTime(0, t + ends);
    for (const s of engine.sources) s.stop(t + ends + 0.05);
    return voiceOf(out, sources, t + ends);
  },
});
