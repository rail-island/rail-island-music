// The sound designs (sounds/, docs/sounds/sounds.md) over a stub Web Audio
// context: every design is well formed, plays at its defaults and at the ends of
// every range without throwing, loops schedule only as far ahead as they are
// asked and stop, and the export the game imports is what the designs say.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SOUNDS, SOUNDS_FORMAT, resolveValues, soundById } from "../sounds/index.ts";
import { BELL_PARTIALS, bellGap, chuffLevel, hornPattern } from "../sounds/designs/trains.ts";
import { seeded } from "../sounds/designs/water.ts";
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
    setTargetAtTime: () => {},
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
    for (const id of [
      "loco-horn",
      "steam-whistle",
      "steam-chuff",
      "crossing-bell",
      "ship-horn",
      "river-rapids",
      "waterfall",
      "spring-fountain",
      "sea-surf",
      "edit-build",
      "edit-demolish",
    ]) {
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

  it("ring a crossing bell on its uneven strokes, from oscillators that run for the whole loop", () => {
    const { ctx, dest, starts } = stubContext();
    const strikes: number[] = [];
    const spy = ctx as unknown as { createGain: () => { gain: Record<string, unknown> } };
    const make = spy.createGain;
    spy.createGain = () => {
      const g = make();
      g.gain.setTargetAtTime = (v: number, at: number) => {
        if (v === BELL_PARTIALS[1]!.level) strikes.push(Number(at.toFixed(4)));
      };
      return g;
    };
    const bell = soundById("crossing-bell")!;
    if (bell.kind !== "loop") throw new Error("crossing-bell is a loop");
    const voice = bell.start(ctx, dest, 0, { interval: 0.5, uneven: 0.1 });
    const oscillators = starts.filter((s) => s.what === "osc").length;
    expect(oscillators).toBe(BELL_PARTIALS.length);
    voice.tick(0, 1.2);
    // the main partial is re-struck on the hammer's short and long strokes
    expect(strikes).toEqual([0, 0.45, 1.0]);
    voice.stop(1.5);
    voice.tick(1.5, 1);
    expect(strikes).toHaveLength(3);
    // a strike re-excites the running partials: no new oscillator per strike
    expect(starts.filter((s) => s.what === "osc")).toHaveLength(oscillators);
  });

  it("match the recorded bell: a main tone near 1.59 kHz, its x1.51 partial next, and a beating twin", () => {
    const pitch = soundById("crossing-bell")!.params.find((p) => p.name === "pitch")!;
    expect(pitch.default).toBe(1590);
    const byLevel = [...BELL_PARTIALS].sort((a, b) => b.level - a.level);
    expect(byLevel[0]!.ratio).toBe(1);
    expect(byLevel.find((p) => p.ratio > 1.4)!.ratio).toBeCloseTo(1.51, 2);
    const twin = BELL_PARTIALS.find((p) => p.ratio > 1 && p.ratio < 1.01)!;
    expect(1590 * (twin.ratio - 1)).toBeGreaterThan(3);
    expect(1590 * (twin.ratio - 1)).toBeLessThan(10);
    expect(bellGap(0, 0.49, 0.085) + bellGap(1, 0.49, 0.085)).toBeCloseTo(0.98, 6);
    expect(bellGap(0, 0.49, 0.085)).toBeLessThan(bellGap(1, 0.49, 0.085));
  });
});

describe("the water", () => {
  /** When each event of a loop starts over `seconds`, ticked the way the game ticks it. */
  function events(id: string, values: SoundValues, seconds: number): number[] {
    const { ctx, dest, starts } = stubContext();
    const d = soundById(id)!;
    if (d.kind !== "loop") throw new Error(`${id} is a loop`);
    const v = d.start(ctx, dest, 0, values);
    for (let now = 0; now < seconds; now += 1 / 60) v.tick(now, 0.2);
    return starts.filter((s) => s.what === "osc").map((s) => Number(s.at.toFixed(5)));
  }

  it("are loops, as the game plays them", () => {
    for (const id of ["river-rapids", "waterfall", "spring-fountain", "sea-surf"]) expect(soundById(id)!.kind, id).toBe("loop");
  });

  it("bubble a rapid the same way every time, and more the stronger it is", () => {
    const calm = events("river-rapids", { strength: 0 }, 4);
    expect(calm.length).toBeGreaterThan(10);
    expect(events("river-rapids", { strength: 0 }, 4)).toEqual(calm);
    expect(events("river-rapids", { strength: 1 }, 4).length).toBeGreaterThan(calm.length);
  });

  it("break a wave on the shore every 6-10 s, unevenly, the same way every time", () => {
    const waves = (seconds: number) => {
      const { ctx, dest, starts } = stubContext();
      const d = soundById("sea-surf")!;
      if (d.kind !== "loop") throw new Error("sea-surf is a loop");
      const v = d.start(ctx, dest, 0, {});
      for (let now = 0; now < seconds; now += 1 / 60) v.tick(now, 0.2);
      // after the steady wash, each wave starts three noise sources in order:
      // its rush, its break and its shingle -- the rush is when the wave comes
      return starts
        .filter((s) => s.what === "noise")
        .slice(1)
        .filter((_, i) => i % 3 === 0)
        .map((s) => s.at);
    };
    const at = waves(40);
    const gaps = at.slice(1).map((t, i) => t - at[i]!);
    expect(gaps.length).toBeGreaterThanOrEqual(3);
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(6);
      expect(g).toBeLessThanOrEqual(10);
    }
    expect(new Set(gaps.map((g) => g.toFixed(2))).size).toBeGreaterThan(1);
    expect(waves(40)).toEqual(at);
  });

  it("schedule nothing past what they were ticked for", () => {
    const at = events("river-rapids", {}, 1);
    expect(Math.max(...at)).toBeLessThan(1.2);
  });

  it("draw their random sequence from a seed", () => {
    const a = seeded(7);
    const b = seeded(7);
    const xs = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(xs);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
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
    for (const s of meta.sounds) expect(Object.keys(s)).toEqual(["id", "title", "category", "description", "kind", "params"]);
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
