// The building blocks every sound design shares: white noise, filters, gains,
// envelopes and the Voice that stops a design's nodes, plus the helpers that
// turn a design's parameter list into resolved values. Everything is scheduled
// at an explicit time, never "now", so a design plays the same into a live
// AudioContext and into an OfflineAudioContext (docs/sounds/sounds.md).

import type { LoopDesign, LoopVoice, OneShotDesign, SoundParam, SoundValues, Voice } from "./types.ts";

const FADE = 0.06;
export const SILENT = 0.0001;

// Two seconds of white noise per context, shared by every design that hisses.
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

export function noise(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // A fixed seed (xorshift32): a render hisses the same every time.
    let s = 0x2545f491;
    for (let i = 0; i < data.length; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      data[i] = ((s >>> 0) / 0xffffffff) * 2 - 1;
    }
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

export function noiseSource(ctx: BaseAudioContext, loop: boolean): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = loop;
  return src;
}

export function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** A gain node held at `level` (0 by default, for an envelope to shape). */
export function gain(ctx: BaseAudioContext, level = 0): GainNode {
  const g = ctx.createGain();
  g.gain.value = level;
  return g;
}

/** An attack-hold-release envelope on `param`. */
export function envelope(param: AudioParam, t: number, peak: number, attack: number, hold: number, release: number): void {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.setValueAtTime(peak, t + attack + hold);
  param.linearRampToValueAtTime(0, t + attack + hold + release);
}

/** A struck envelope: a near-instant attack, then an exponential decay. */
export function strike(param: AudioParam, t: number, peak: number, decay: number): void {
  param.setValueAtTime(SILENT, t);
  param.exponentialRampToValueAtTime(Math.max(SILENT, peak), t + 0.005);
  param.exponentialRampToValueAtTime(SILENT, t + decay);
}

/** A Voice over `out`: stopping it fades `out` and stops `sources` just after. */
export function voiceOf(out: GainNode, sources: AudioScheduledSourceNode[], endsAt: number): Voice {
  let stopped = false;
  return {
    endsAt,
    stop(at: number): void {
      if (stopped) return;
      stopped = true;
      out.gain.cancelScheduledValues(at);
      out.gain.setValueAtTime(out.gain.value, at);
      out.gain.linearRampToValueAtTime(0, at + FADE);
      for (const s of sources) {
        try {
          s.stop(at + FADE + 0.01);
        } catch {
          // already stopped
        }
      }
    },
  };
}

/** A design's values with every missing or out-of-range one replaced: numbers clamped, unknown choices defaulted. */
export function resolve(params: readonly SoundParam[], values: SoundValues | undefined): SoundValues {
  const out: SoundValues = {};
  for (const p of params) {
    const v = values?.[p.name];
    if (p.kind === "number") {
      const n = typeof v === "number" && Number.isFinite(v) ? v : p.default;
      out[p.name] = Math.min(p.max, Math.max(p.min, n));
    } else {
      out[p.name] = typeof v === "string" && p.values.some((x) => x.value === v) ? v : p.default;
    }
  }
  return out;
}

export function num(values: SoundValues, name: string): number {
  return values[name] as number;
}

export function choice(values: SoundValues, name: string): string {
  return values[name] as string;
}

type Base = Omit<OneShotDesign, "kind" | "play">;

/** A one-shot design whose `play` always sees resolved values. */
export function oneShot(def: Base & { play(ctx: BaseAudioContext, dest: AudioNode, t: number, v: SoundValues): Voice }): OneShotDesign {
  return {
    id: def.id,
    title: def.title,
    category: def.category,
    description: def.description,
    params: def.params,
    kind: "oneShot",
    play: (ctx, dest, t, values) => def.play(ctx, dest, t, resolve(def.params, values)),
  };
}

/** A loop design whose `start` and `set` always see resolved values. */
export function loop(def: Base & { start(ctx: BaseAudioContext, dest: AudioNode, t: number, v: SoundValues): LoopVoice }): LoopDesign {
  return {
    id: def.id,
    title: def.title,
    category: def.category,
    description: def.description,
    params: def.params,
    kind: "loop",
    start: (ctx, dest, t, values) => {
      const voice = def.start(ctx, dest, t, resolve(def.params, values));
      return {
        get endsAt() {
          return voice.endsAt;
        },
        stop: (at) => voice.stop(at),
        tick: (now, horizon) => voice.tick(now, horizon),
        set: (next) => voice.set(resolve(def.params, next)),
      };
    },
  };
}

/** The `level` every design has: how loud it plays, 0..1. */
export const LEVEL: SoundParam = { name: "level", title: "Level", kind: "number", min: 0, max: 1, step: 0.05, default: 1 };
