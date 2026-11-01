// The sound designs (sounds/, docs/sounds/sounds.md) over a stub Web Audio
// context: every design is well formed, plays at its defaults and at the ends of
// every range without throwing, loops schedule only as far ahead as they are
// asked and stop, and the export the game imports is what the designs say.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORIES, SOUNDS, SOUNDS_FORMAT, resolveValues, soundById, soundsIn } from "../sounds/index.ts";
import { BELL_PARTIALS, bellGap, chuffLevel, hornPattern } from "../sounds/designs/trains.ts";
import { WATER_TRIM, seeded } from "../sounds/designs/water.ts";
import { birdGap } from "../sounds/designs/nature.ts";
import { hourChime, WESTMINSTER_CHANGES, bellTail, CHURCH_PARTIALS } from "../sounds/designs/bells.ts";
import { dieselFiring, dieselLevel } from "../sounds/designs/trains.ts";
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
      "diesel-engine",
      "woods",
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
          // The one silent call: a diesel's or an electric's horn as it leaves.
          if (d.id === "loco-horn" && values.call === "departure") {
            expect(starts, d.id).toHaveLength(0);
          } else {
            expect(v.endsAt, d.id).toBeGreaterThan(1);
            expect(starts.length, d.id).toBeGreaterThan(0);
          }
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

  it("wash the sea shore steadily, with no single waves", () => {
    const { ctx, dest, starts } = stubContext();
    const d = soundById("sea-surf")!;
    if (d.kind !== "loop") throw new Error("sea-surf is a loop");
    const v = d.start(ctx, dest, 0, { strength: 1 });
    for (let now = 0; now < 30; now += 1 / 60) v.tick(now, 0.2);
    // one noise source for the whole loop: nothing starts later, so no waves
    expect(starts.filter((s) => s.what === "noise")).toEqual([{ at: 0, what: "noise" }]);
    expect(starts.filter((s) => s.what === "osc")).toEqual([]);
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

describe("the levels", () => {
  /** The gain the design's output node is created with at `level` 1: the first gain made. */
  function outputGain(id: string): number {
    const { ctx, dest } = stubContext();
    const gains: Array<{ gain: { value: number } }> = [];
    const spy = ctx as unknown as { createGain: () => { gain: { value: number } } };
    const make = spy.createGain;
    spy.createGain = () => {
      const g = make();
      gains.push(g);
      return g;
    };
    const d = soundById(id)!;
    if (d.kind !== "loop") throw new Error(`${id} is a loop`);
    d.start(ctx, dest, 0, { level: 1 });
    return gains[0]!.gain.value;
  }

  it("keep the water well under a running locomotive", () => {
    // Regression: the water played at its full level, -14 to -22 LUFS, louder
    // than a horn and far louder than a running steam beat (-30 LUFS).
    for (const id of ["river-rapids", "waterfall", "spring-fountain", "sea-surf"] as const) {
      expect(outputGain(id), id).toBe(WATER_TRIM[id]);
      expect(WATER_TRIM[id], id).toBeLessThanOrEqual(0.25);
    }
  });

  it("keep the woods quieter than the water", () => {
    expect(outputGain("woods")).toBeLessThan(0.3);
  });
});

describe("the diesel engine", () => {
  it("fires faster as it revs, and a big engine lower than a small one", () => {
    expect(dieselFiring(0.5, 1)).toBeGreaterThan(dieselFiring(0.5, 0));
    expect(dieselFiring(1, 0.5)).toBeLessThan(dieselFiring(0, 0.5));
    expect(dieselFiring(1, 0)).toBeGreaterThanOrEqual(20);
    expect(dieselFiring(0, 1)).toBeLessThanOrEqual(110);
  });

  it("runs louder the harder it works, and is never silent", () => {
    expect(dieselLevel(1, 1)).toBeGreaterThan(dieselLevel(0, 0));
    expect(dieselLevel(0, 0)).toBeGreaterThan(0);
    expect(dieselLevel(1, 1)).toBeLessThanOrEqual(1);
  });

  it("schedules only as far ahead as asked", () => {
    const { ctx, dest } = stubContext();
    const targets: number[] = [];
    const spy = ctx as unknown as { createOscillator: () => { frequency: { setTargetAtTime: (v: number, at: number) => void } } };
    const make = spy.createOscillator;
    spy.createOscillator = () => {
      const o = make();
      o.frequency.setTargetAtTime = (_v, at) => targets.push(at);
      return o;
    };
    const d = soundById("diesel-engine")!;
    if (d.kind !== "loop") throw new Error("diesel-engine is a loop");
    const v = d.start(ctx, dest, 0, {});
    v.tick(0, 1);
    expect(Math.max(...targets)).toBeLessThan(1);
    v.stop(1);
    const n = targets.length;
    v.tick(1, 1);
    expect(targets).toHaveLength(n);
  });
});

describe("the woods", () => {
  function birdNotes(values: SoundValues, seconds: number): number[] {
    const { ctx, dest, starts } = stubContext();
    const d = soundById("woods")!;
    if (d.kind !== "loop") throw new Error("woods is a loop");
    const v = d.start(ctx, dest, 0, values);
    for (let now = 0; now < seconds; now += 1 / 60) v.tick(now, 0.2);
    return starts.filter((s) => s.what === "osc").map((s) => Number(s.at.toFixed(5)));
  }

  it("sing the same birds every time, more in a denser, livelier wood", () => {
    const calm = birdNotes({ density: 0.2, birds: 0.3 }, 60);
    expect(calm.length).toBeGreaterThan(0);
    expect(birdNotes({ density: 0.2, birds: 0.3 }, 60)).toEqual(calm);
    expect(birdNotes({ density: 1, birds: 1 }, 60).length).toBeGreaterThan(calm.length);
  });

  it("are only leaves without birds", () => {
    expect(birdNotes({ birds: 0 }, 30)).toEqual([]);
  });

  it("space the calls out: seconds apart, never a constant chatter", () => {
    expect(birdGap(1, 1, 0)).toBeGreaterThanOrEqual(1.4);
    expect(birdGap(0, 0.1, 0.5)).toBeGreaterThan(birdGap(1, 1, 0.5));
  });
});

describe("the bells", () => {
  it("ring the Westminster Quarters' four last changes before the hour", () => {
    const { notes } = hourChime();
    expect(notes).toHaveLength(16);
    expect(notes.map(([, b]) => b)).toEqual(WESTMINSTER_CHANGES.slice(1).flat());
    for (let i = 1; i < notes.length; i++) expect(notes[i]![0]).toBeGreaterThan(notes[i - 1]![0]);
  });

  it("ring out as long as their longest partial, the hum", () => {
    expect(bellTail(CHURCH_PARTIALS, 1)).toBe(CHURCH_PARTIALS.find((p) => p.ratio === 0.5)!.ring);
  });

  it("end by themselves after the last strike has rung out", () => {
    for (const id of ["church-bell", "big-ben", "notre-dame-bell"]) {
      const { ctx, dest } = stubContext();
      const d = soundById(id)!;
      if (d.kind !== "oneShot") throw new Error(`${id} is a one-shot`);
      const one = d.play(ctx, dest, 0, { strikes: 1, chime: "hour" });
      const three = d.play(ctx, dest, 0, { strikes: 3, chime: "hour" });
      expect(three.endsAt, id).toBeGreaterThan(one.endsAt);
      expect(Number.isFinite(three.endsAt), id).toBe(true);
    }
  });
});

describe("the parameters", () => {
  it("clamp a number and default an unknown choice", () => {
    const horn = soundById("loco-horn")!;
    expect(resolveValues(horn.params, { pitch: 9000, call: "nonsense" })).toEqual({ pitch: 500, call: "crossing", level: 1 });
    expect(resolveValues(horn.params, undefined)).toEqual({ pitch: 300, call: "crossing", level: 1 });
  });

  it("give a whistle's departure two blasts that never overlap, and every other call one", () => {
    const blasts = hornPattern("whistle", "departure");
    expect(blasts).toHaveLength(2);
    expect(blasts[1]![0]).toBeGreaterThanOrEqual(blasts[0]![0] + blasts[0]![1]);
    for (const kind of ["horn", "whistle"] as const) {
      for (const call of ["crossing", "tunnel", "player"]) expect(hornPattern(kind, call)).toHaveLength(1);
      expect(hornPattern(kind, "tunnel")[0]![1]).toBeGreaterThan(hornPattern(kind, "player")[0]![1]);
    }
  });

  it("leave a diesel's or an electric's departure silent: only steam whistles as it leaves", () => {
    expect(hornPattern("horn", "departure")).toEqual([]);
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
    expect(meta.categories.map((c) => c.id)).toEqual(CATEGORIES.map((c) => c.id));
  });

  it("puts every design in a known category, each category's designs together and in category order", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CATEGORIES) {
      expect(c.title).not.toBe("");
      expect(c.description).not.toBe("");
      expect(soundsIn(c.id).length).toBeGreaterThan(0);
    }
    expect(SOUNDS.map((s) => s.id)).toEqual(CATEGORIES.flatMap((c) => soundsIn(c.id).map((s) => s.id)));
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
    expect(dts).toContain("export declare const CATEGORIES: readonly SoundCategoryInfo[];");
  });
});
