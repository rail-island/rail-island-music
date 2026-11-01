// The railway's sounds: a locomotive's two-tone air horn, a steam locomotive's
// whistle and its exhaust beat, and a level crossing's bell
// (docs/sounds/sounds.md). The game derives the pitch from the locomotive's
// weight and the beat's rate from its speed; the call is why it sounds.

import { LEVEL, choice, envelope, filter, gain, loop, noiseSource, num, oneShot, seeded, strike, voiceOf } from "../nodes.ts";
import type { SoundParam, SoundValues } from "../types.ts";

/**
 * Why a train sounds; each call has its own pattern of blasts. The horn defaults
 * to a crossing, since its departure is silent; the whistle to a departure.
 */
function callParam(def: "departure" | "crossing"): SoundParam {
  return {
    name: "call",
    title: "Call",
    kind: "choice",
    values: [
      { value: "departure", title: "Departure (whistle: two blasts; horn: silent)" },
      { value: "crossing", title: "Level crossing (one long)" },
      { value: "tunnel", title: "Tunnel (one longer)" },
      { value: "player", title: "Player (one short)" },
    ],
    default: def,
  };
}

/** The blasts of one call: [start offset s, length s, pitch factor]. */
export function hornPattern(kind: "horn" | "whistle", call: string): Array<[number, number, number]> {
  if (kind === "whistle") {
    // A whistle has one note; the calls differ in length and count.
    if (call === "departure") return [[0, 0.35, 1], [0.5, 0.9, 1]];
    if (call === "crossing") return [[0, 1.1, 1]];
    if (call === "tunnel") return [[0, 1.4, 1]];
    return [[0, 0.8, 1]];
  }
  // The two-tone horn: one long low blast before a crossing or a tunnel. Only
  // steam whistles as it leaves a platform: a diesel or an electric departs
  // without a sound, so its departure call has no blast.
  if (call === "departure") return [];
  if (call === "crossing") return [[0, 1.0, 1]];
  if (call === "tunnel") return [[0, 1.3, 1]];
  return [[0, 0.6, 1]];
}

export const locoHorn = /* @__PURE__ */ oneShot({
  id: "loco-horn",
  title: "Locomotive horn",
  category: "trains",
  description: "A diesel's, an electric's or a multiple unit's two-tone air horn: before a crossing or a tunnel, or on the player's Horn. It leaves a platform without one.",
  params: [
    { name: "pitch", title: "Pitch", kind: "number", min: 150, max: 500, step: 5, default: 300, unit: "Hz" },
    callParam("crossing"),
    LEVEL,
  ],
  play(ctx, dest, t, v) {
    const out = gain(ctx, num(v, "level"));
    out.connect(dest);
    const sources: AudioScheduledSourceNode[] = [];
    let end = t;
    for (const [offset, length, factor] of hornPattern("horn", choice(v, "call"))) {
      const at = t + offset;
      const pitch = num(v, "pitch") * factor;
      // A chord of three reeds through a soft low-pass.
      const env = gain(ctx);
      const lp = filter(ctx, "lowpass", 2400);
      lp.connect(env).connect(out);
      [1, 1.25, 1.5].forEach((ratio, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = pitch * ratio;
        osc.detune.value = (i - 1) * 6;
        const g = gain(ctx, 0.11);
        osc.connect(g).connect(lp);
        osc.start(at);
        osc.stop(at + length + 0.2);
        sources.push(osc);
      });
      envelope(env.gain, at, 1, 0.03, length, 0.12);
      end = Math.max(end, at + length + 0.4);
    }
    return voiceOf(out, sources, end);
  },
});

export const steamWhistle = /* @__PURE__ */ oneShot({
  id: "steam-whistle",
  title: "Steam whistle",
  category: "trains",
  description: "A steam locomotive's whistle, played where another locomotive would sound its horn.",
  params: [
    { name: "pitch", title: "Pitch", kind: "number", min: 400, max: 1100, step: 10, default: 700, unit: "Hz" },
    callParam("departure"),
    LEVEL,
  ],
  play(ctx, dest, t, v) {
    const out = gain(ctx, num(v, "level"));
    out.connect(dest);
    const sources: AudioScheduledSourceNode[] = [];
    let end = t;
    for (const [offset, length, factor] of hornPattern("whistle", choice(v, "call"))) {
      const at = t + offset;
      const pitch = num(v, "pitch") * factor;
      // Three pipes over a breath of steam, sliding up onto the note.
      const env = gain(ctx);
      env.connect(out);
      const pipes: Array<[number, number]> = [
        [1, 0.16],
        [1.19, 0.11],
        [1.5, 0.07],
      ];
      for (const [ratio, level] of pipes) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(pitch * ratio * 0.92, at);
        osc.frequency.exponentialRampToValueAtTime(pitch * ratio, at + 0.12);
        const g = gain(ctx, level);
        osc.connect(g).connect(env);
        osc.start(at);
        osc.stop(at + length + 0.35);
        sources.push(osc);
      }
      const hiss = noiseSource(ctx, true);
      const bp = filter(ctx, "bandpass", pitch * 1.2, 5);
      const hg = gain(ctx, 0.35);
      hiss.connect(bp).connect(hg).connect(env);
      hiss.start(at);
      hiss.stop(at + length + 0.35);
      sources.push(hiss);
      envelope(env.gain, at, 1, 0.08, length, 0.25);
      end = Math.max(end, at + length + 0.4);
    }
    return voiceOf(out, sources, end);
  },
});

/** How loud one beat is, 0..1, from how hard the engine works. */
export function chuffLevel(intensity: number): number {
  return 0.3 + 0.7 * Math.min(1, Math.max(0, intensity));
}

export const steamChuff = /* @__PURE__ */ loop({
  id: "steam-chuff",
  title: "Steam exhaust beat",
  category: "trains",
  description: "A running steam locomotive's exhaust: one burst of steam per beat, at the rate its speed gives and as strong as it works.",
  params: [
    { name: "rate", title: "Beats per second", kind: "number", min: 0, max: 12, step: 0.1, default: 4, unit: "/s" },
    { name: "intensity", title: "Effort", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level"));
    out.connect(dest);
    const pulse = gain(ctx);
    const bp = filter(ctx, "bandpass", 650, 0.9);
    const lp = filter(ctx, "lowpass", 2600);
    const src = noiseSource(ctx, true);
    src.connect(bp).connect(lp).connect(pulse).connect(out);
    src.start(t);
    const base = voiceOf(out, [src], Infinity);
    let v: SoundValues = initial;
    let next = t;
    let beat = 0;
    return {
      endsAt: Infinity,
      stop: (at) => base.stop(at),
      set(values) {
        v = values;
      },
      tick(now, horizon) {
        const rate = num(v, "rate");
        if (rate <= 0) {
          next = now;
          return;
        }
        if (next < now) next = now;
        const level = chuffLevel(num(v, "intensity"));
        while (next < now + horizon) {
          // Every fourth beat is a little heavier: a real engine's four
          // exhausts are never quite even.
          const accent = beat % 4 === 0 ? 1 : 0.78;
          strike(pulse.gain, next, 0.9 * level * accent, Math.min(0.22, 0.75 / rate));
          next += 1 / rate;
          beat++;
        }
      },
    };
  },
});

/**
 * The electric bell of a level crossing, matched to a recording of a Czech
 * crossing warning bell (`zvonek vystrazniku`): a main tone near 1.59 kHz with a
 * strong partial at x1.51 and weak ones at x0.57, x2.08 and x3.08, and a twin of the main tone
 * a few hertz off so the ring beats about six times a second. A strike barely
 * decays before the next (about 12 dB in half a second), so the bell rings
 * continuously, re-struck every half second -- not quite evenly, the hammer's
 * two strokes alternate long and short. Each partial is one oscillator for the
 * whole loop, and a strike only re-excites its envelope.
 */
export const BELL_PARTIALS: ReadonlyArray<{ ratio: number; level: number; ring: number }> = [
  // ring: seconds to fall 60 dB
  { ratio: 0.566, level: 0.13, ring: 3.2 },
  { ratio: 1, level: 1, ring: 2.8 },
  { ratio: 1.0038, level: 0.45, ring: 2.8 },
  { ratio: 1.512, level: 0.6, ring: 2.2 },
  { ratio: 2.083, level: 0.06, ring: 1.2 },
  { ratio: 3.078, level: 0.03, ring: 0.9 },
];

/** Seconds from strike `n` to the next: the hammer's long and short strokes. */
export function bellGap(n: number, interval: number, uneven: number): number {
  return interval * (n % 2 === 0 ? 1 - uneven : 1 + uneven);
}

export const crossingBell = /* @__PURE__ */ loop({
  id: "crossing-bell",
  title: "Level crossing bell",
  category: "trains",
  description: "A level crossing's electric bell, ringing for as long as its lamps blink.",
  params: [
    { name: "pitch", title: "Pitch", kind: "number", min: 600, max: 2400, step: 10, default: 1590, unit: "Hz" },
    { name: "interval", title: "Strike every", kind: "number", min: 0.15, max: 1.2, step: 0.01, default: 0.49, unit: "s" },
    { name: "uneven", title: "Uneven strokes", kind: "number", min: 0, max: 0.3, step: 0.005, default: 0.085 },
    { name: "ring", title: "Ring", kind: "number", min: 0.2, max: 2, step: 0.05, default: 1 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    const out = gain(ctx, num(initial, "level") * 0.22);
    out.connect(dest);
    const sources: AudioScheduledSourceNode[] = [];
    const tones = BELL_PARTIALS.map((p) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = num(initial, "pitch") * p.ratio;
      const g = gain(ctx);
      osc.connect(g).connect(out);
      osc.start(t);
      sources.push(osc);
      return { osc, g, p };
    });
    // The hammer's click, under the ring.
    const click = noiseSource(ctx, true);
    const hp = filter(ctx, "highpass", 3000);
    const cg = gain(ctx);
    click.connect(hp).connect(cg).connect(out);
    click.start(t);
    sources.push(click);
    const base = voiceOf(out, sources, Infinity);
    let v: SoundValues = initial;
    let next = t;
    let n = 0;
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
        if (next < now) next = now;
        while (next < now + horizon) {
          const ring = num(v, "ring");
          for (const { osc, g, p } of tones) {
            osc.frequency.setValueAtTime(num(v, "pitch") * p.ratio, next);
            // From wherever it rings now: up to the strike's level, then decay.
            g.gain.setTargetAtTime(p.level, next, 0.0015);
            g.gain.setTargetAtTime(0, next + 0.006, (p.ring * ring) / 6.9);
          }
          cg.gain.setTargetAtTime(0.25, next, 0.0005);
          cg.gain.setTargetAtTime(0, next + 0.002, 0.006);
          next += bellGap(n, num(v, "interval"), num(v, "uneven"));
          n++;
        }
      },
    };
  },
});

/**
 * A diesel engine's firing rate, in combustions per second, from how big it is
 * and how fast it turns. A small railcar's engine idles near 30 a second and runs
 * up to about 110; a big mainline diesel turns slower and fires lower, from 20 to
 * about 70 (`size` 1).
 */
export function dieselFiring(size: number, rpm: number): number {
  const idle = 30 - 10 * size;
  const full = 110 - 40 * size;
  return idle + (full - idle) * rpm;
}

/** How loud a diesel engine runs, 0..1, from its revs and how hard it works. */
export function dieselLevel(rpm: number, load: number): number {
  return 0.35 + 0.3 * rpm + 0.35 * load;
}

export const dieselEngine = /* @__PURE__ */ loop({
  id: "diesel-engine",
  title: "Diesel engine",
  category: "trains",
  description: "A diesel locomotive's or railcar's engine: a low chugging drone that revs up with the speed and growls harder as it works, with a turbo's whine on top.",
  params: [
    { name: "rpm", title: "Revs", kind: "number", min: 0, max: 1, step: 0.05, default: 0.4 },
    { name: "load", title: "Effort", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    { name: "size", title: "Size", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    LEVEL,
  ],
  start(ctx, dest, t, initial) {
    // about -29 LUFS at the defaults: beside a running steam beat, under a horn
    const out = gain(ctx, num(initial, "level") * 0.12);
    out.connect(dest);
    const body = gain(ctx, 0);
    body.connect(out);
    const fire = dieselFiring(num(initial, "size"), num(initial, "rpm"));
    // The combustions: a sawtooth at the firing rate and a square at half of it
    // (a four-stroke's uneven pairs), through a low-pass that opens as it works.
    const tone = filter(ctx, "lowpass", 260, 1.2);
    tone.connect(body);
    const saw = ctx.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.value = fire;
    const sawGain = gain(ctx, 0.5);
    saw.connect(sawGain).connect(tone);
    const half = ctx.createOscillator();
    half.type = "square";
    half.frequency.value = fire / 2;
    const halfGain = gain(ctx, 0.22);
    half.connect(halfGain).connect(tone);
    // The exhaust: noise through a band-pass, chopped by the firing rate.
    const exhaust = noiseSource(ctx, true);
    const exBand = filter(ctx, "bandpass", 420, 0.8);
    const exGain = gain(ctx, 0.35);
    const chop = ctx.createOscillator();
    chop.type = "sine";
    chop.frequency.value = fire;
    const chopDepth = gain(ctx, 0.25);
    chop.connect(chopDepth).connect(exGain.gain);
    exhaust.connect(exBand).connect(exGain).connect(body);
    // The turbo: a thin sine high above, only when it works and revs.
    const turbo = ctx.createOscillator();
    turbo.type = "sine";
    turbo.frequency.value = 1800;
    const turboGain = gain(ctx, 0);
    turbo.connect(turboGain).connect(body);
    const sources = [saw, half, exhaust, chop, turbo];
    for (const s of sources) s.start(t);
    const base = voiceOf(out, sources, Infinity);
    const rnd = seeded(0xd1e5);
    let v: SoundValues = initial;
    let next = t;
    let stopped = false;
    // An engine has inertia: every change glides over about half a second.
    const apply = (at: number, wobble: number) => {
      const rpm = num(v, "rpm");
      const load = num(v, "load");
      const f = dieselFiring(num(v, "size"), rpm) * wobble;
      saw.frequency.setTargetAtTime(f, at, 0.35);
      half.frequency.setTargetAtTime(f / 2, at, 0.35);
      chop.frequency.setTargetAtTime(f, at, 0.35);
      tone.frequency.setTargetAtTime(200 + 500 * load + 300 * rpm, at, 0.3);
      exBand.frequency.setTargetAtTime(300 + 400 * rpm, at, 0.3);
      exGain.gain.setTargetAtTime(0.2 + 0.3 * load, at, 0.3);
      turbo.frequency.setTargetAtTime(1500 + 1600 * rpm, at, 0.8);
      turboGain.gain.setTargetAtTime(0.012 * rpm * (0.3 + load), at, 0.6);
      body.gain.setTargetAtTime(dieselLevel(rpm, load), at, 0.3);
    };
    apply(t, 1);
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
        // The revs never sit quite still: a small drift every 0.3 s.
        while (next < now + horizon) {
          apply(next, 0.985 + 0.03 * rnd());
          next += 0.3;
        }
      },
    };
  },
});

