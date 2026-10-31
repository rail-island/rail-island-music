// The sound designs (sounds/, docs/sounds/sounds.md) over a stub Web Audio
// context: every design is well formed, plays at its defaults and at the ends of
// every range without throwing, loops schedule only as far ahead as they are
// asked and stop, and the export the game imports is what the designs say.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SOUNDS, SOUNDS_FORMAT, resolveValues, soundById } from "../sounds/index.ts";
import { chuffLevel, hornPattern } from "../sounds/designs/trains.ts";
import { soundsDeclarations, soundsMeta } from "../generator/sounds.ts";
import type { SoundDesign, SoundValues } from "../sounds/types.ts";

type Event = { at: number; what: string };

/** A context whose nodes connect, schedule and start, recording when things start. */
function stubContext() {
  const starts: Event[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: (v: number) => {
      if (!(v > 0)) throw new RangeError("exponential ramp to a non-positive value");
    },
    cancelScheduledValues: () => {},
  });
  const node = (what: string) => ({
    connect: (to: unknown) => to,
    frequency: param(),
    detune: param(),
    gain: param(),
    Q: param(),
    type: "",
    buffer: null as unknown,
    loop: false,
    start: (at: number) => starts.push({ at, what }),
    stop: () => {},
  });
  const ctx = {
    sampleRate: 48000,
    currentTime: 0,
    createGain: () => node("gain"),
    createBiquadFilter: () => node("filter"),
    createOscillator: () => node("osc"),
    createBufferSource: () => node("noise"),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  } as unknown as BaseAudioContext;
  return { ctx, dest: node("dest") as unknown as AudioNode, starts };
}

function extremes(d: SoundDesign): SoundValues[] {
  const lo: SoundValues = {};
  const hi: SoundValues = {};
  for (const p of d.params) {
    lo[p.name] = p.kind === "number" ? p.min : p.values[0]!.value;
    hi[p.name] = p.kind === "number" ? p.max : p.values[p.values.length - 1]!.value;
  }
  return [{}, lo, hi];
}

describe("the designs", () => {
  it("have unique, kebab-case ids", () => {
    const ids = SOUNDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("include every sound the game plays", () => {
    // rail-island-webapp names these ids (src/render/sound/soundDesigns.ts):
    // a design the game plays is permanent.
    for (const id of ["loco-horn", "steam-whistle", "steam-chuff", "crossing-bell", "ship-horn", "edit-build", "edit-demolish"]) {
      expect(soundById(id), id).toBeDefined();
    }
  });

  it("declare parameters whose defaults are in range", () => {
    for (const d of SOUNDS) {
      expect(d.params.some((p) => p.name === "level"), d.id).toBe(true);
      for (const p of d.params) {
        if (p.kind === "number") {
          expect(p.min, `${d.id}.${p.name}`).toBeLessThan(p.max);
          expect(p.step).toBeGreaterThan(0);
          expect(p.default).toBeGreaterThanOrEqual(p.min);
          expect(p.default).toBeLessThanOrEqual(p.max);
        } else {
          expect(p.values.map((v) => v.value), `${d.id}.${p.name}`).toContain(p.default);
        }
      }
    }
  });

  it("play at their defaults and at the ends of every range", () => {
    for (const d of SOUNDS) {
      for (const values of extremes(d)) {
        const { ctx, dest, starts } = stubContext();
        if (d.kind === "oneShot") {
          const v = d.play(ctx, dest, 1, values);
          expect(v.endsAt, d.id).toBeGreaterThan(1);
          expect(starts.length, d.id).toBeGreaterThan(0);
          v.stop(1.1);
        } else {
          const v = d.start(ctx, dest, 1, values);
          expect(v.endsAt).toBe(Infinity);
          v.tick(1, 0.5);
          v.stop(1.5);
        }
      }
    }
  });
});

describe("the loops", () => {
  it("schedule a steam engine's beats only as far ahead as asked, at the rate given", () => {
    const { ctx, dest } = stubContext();
    const strikes: number[] = [];
    const ctxSpy = ctx as unknown as { createGain: () => { gain: { setValueAtTime: (v: number, at: number) => void } } };
    const make = ctxSpy.createGain;
    ctxSpy.createGain = () => {
      const g = make();
      g.gain.setValueAtTime = (v, at) => {
        if (v > 0 && v < 0.001) strikes.push(at);
      };
      return g;
    };
    const v = soundById("steam-chuff")!;
    if (v.kind !== "loop") throw new Error("steam-chuff is a loop");
    const voice = v.start(ctx, dest, 0, { rate: 4 });
    voice.tick(0, 1);
    expect(strikes).toEqual([0, 0.25, 0.5, 0.75]);
    voice.set({ rate: 0 });
    voice.tick(1, 1);
    expect(strikes).toHaveLength(4);
  });

  it("ring a crossing bell at its interval, and stop ringing once stopped", () => {
    const { ctx, dest, starts } = stubContext();
    const bell = soundById("crossing-bell")!;
    if (bell.kind !== "loop") throw new Error("crossing-bell is a loop");
    const voice = bell.start(ctx, dest, 0, { interval: 0.5 });
    voice.tick(0, 1);
    const strikes = [...new Set(starts.filter((s) => s.what === "osc").map((s) => s.at))];
    expect(strikes).toEqual([0, 0.5]);
    voice.stop(1);
    voice.tick(1, 1);
    expect(starts.filter((s) => s.what === "osc" && s.at >= 1)).toEqual([]);
  });
});

describe("the parameters", () => {
  it("clamp a number and default an unknown choice", () => {
    const horn = soundById("loco-horn")!;
    expect(resolveValues(horn.params, { pitch: 9000, call: "nonsense" })).toEqual({ pitch: 500, call: "departure", level: 1 });
    expect(resolveValues(horn.params, undefined)).toEqual({ pitch: 300, call: "departure", level: 1 });
  });

  it("give a departure two blasts that never overlap, and every other call one", () => {
    for (const kind of ["horn", "whistle"] as const) {
      const blasts = hornPattern(kind, "departure");
      expect(blasts).toHaveLength(2);
      expect(blasts[1]![0]).toBeGreaterThanOrEqual(blasts[0]![0] + blasts[0]![1]);
      for (const call of ["crossing", "tunnel", "player"]) expect(hornPattern(kind, call)).toHaveLength(1);
      expect(hornPattern(kind, "tunnel")[0]![1]).toBeGreaterThan(hornPattern(kind, "player")[0]![1]);
    }
  });

  it("make a harder-working engine louder", () => {
    expect(chuffLevel(1)).toBeGreaterThan(chuffLevel(0));
    expect(chuffLevel(0)).toBeGreaterThan(0);
    expect(chuffLevel(9)).toBe(1);
  });
});

describe("the export", () => {
  it("lists every design, without code, in order", () => {
    const meta = soundsMeta();
    expect(meta.format).toBe(SOUNDS_FORMAT);
    expect(meta.module).toBe("sounds.js");
    expect(meta.sounds.map((s) => s.id)).toEqual(SOUNDS.map((s) => s.id));
    expect(JSON.stringify(meta)).toBe(JSON.stringify(soundsMeta()));
    for (const s of meta.sounds) expect(Object.keys(s)).toEqual(["id", "title", "description", "kind", "params"]);
  });

  it("declares the bundle from a contract that is types only", () => {
    const types = readFileSync(new URL("../sounds/types.ts", import.meta.url), "utf8");
    // written as a .d.ts: no imports, nothing but types
    expect(types).not.toMatch(/^\s*import\b/m);
    const exported = types.match(/^export\s+(\w+)/gm) ?? [];
    for (const e of exported) expect(e).toMatch(/^export\s+(interface|type)$/);
    const dts = soundsDeclarations(types);
    expect(dts).toContain("export interface OneShotDesign");
    expect(dts).toContain("export declare const SOUNDS: readonly SoundDesign[];");
    expect(dts).toContain("export declare function resolveValues(");
  });
});
