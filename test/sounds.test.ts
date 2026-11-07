// The sound designs (sounds/, docs/sounds/sounds.md) over a stub Web Audio
// context: every design is well formed, plays at its defaults and at the ends of
// every range without throwing, loops schedule only as far ahead as they are
// asked and stop, and the export the game imports is what the designs say.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORIES, SOUNDS, SOUNDS_FORMAT, resolveValues, soundById, soundsIn } from "../sounds/index.ts";
import { BELL_PARTIALS, TRAM_BELL_PARTIALS, TRAM_BELL_STRIKES, WHISTLE_PIPES, bellGap, chuffLevel, hornPattern, tramBellPresses } from "../sounds/designs/trains.ts";
import { CONVERTER_RISE, CONVERTER_TONES, NOTCH_BELOW, gearMesh, rollingLevel } from "../sounds/designs/electric.ts";
import { WATER_TRIM, seeded } from "../sounds/designs/water.ts";
import { birdGap } from "../sounds/designs/nature.ts";
import { MIN_PASS, PULSE_ATTACK, bladePass, helicopterMix, rotorRev, tailPass } from "../sounds/designs/aircraft.ts";
import { EDIT_TRIM } from "../sounds/designs/editor.ts";
import { CALLS, FOOT_PROFILES, SPECIES, THUD_ATTACK, gaitOffsets, hoofRate, teamAnimals, teamShare } from "../sounds/designs/animals.ts";
import { hourChime, WESTMINSTER_CHANGES, bellTail, CHURCH_PARTIALS } from "../sounds/designs/bells.ts";
import {
  DIESEL_PROFILES,
  cycleSeries,
  cycleShape,
  dieselFiring,
  dieselLevel,
  dieselRpm,
  dieselRuns,
  dieselStartTimes,
  dieselStopTimes,
} from "../sounds/designs/diesel.ts";
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
    setPeriodicWave: () => {},
  });
  const ctx = {
    sampleRate: 48000,
    currentTime: 0,
    createGain: () => node("gain"),
    createBiquadFilter: () => node("filter"),
    createOscillator: () => node("osc"),
    createBufferSource: () => node("noise"),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createPeriodicWave: () => ({}),
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
      "woods",
      // the factory maps these on its diesel vehicles (game.sounds)
      "diesel-engine-railcar",
      "diesel-engine-shunter",
      "diesel-engine-mainline",
      "diesel-engine-two-stroke",
      "diesel-engine-bus",
      "diesel-engine-truck",
      // the factory maps this on its helicopters (game.sounds)
      "helicopter",
      // the factory maps these on its animal-drawn vehicles (game.sounds)
      "hoof-beat",
      "animal-call",
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
          // a loop runs on, unless it is an engine begun shut down
          if (values.state === "off" || values.state === "stop") expect(v.endsAt, d.id).toBe(1);
          else expect(v.endsAt, d.id).toBe(Infinity);
          v.tick(1, 0.5);
          v.stop(1.5);
        }
      }
    }
  });
});

describe("the editor sounds", () => {
  it("play well under the other designs: the build and demolish knocks were too loud", () => {
    expect(EDIT_TRIM).toBeLessThanOrEqual(0.35);
    for (const id of ["edit-build", "edit-demolish"]) {
      const { ctx, dest } = stubContext();
      const gains: Array<{ gain: { value: number } }> = [];
      const ctxSpy = ctx as unknown as { createGain: () => { gain: { value: number } } };
      const make = ctxSpy.createGain;
      ctxSpy.createGain = () => {
        const g = make();
        gains.push(g);
        return g;
      };
      const d = soundById(id)!;
      if (d.kind !== "oneShot") throw new Error(`${id} is a one-shot`);
      d.play(ctx, dest, 0, resolveValues(d.params, {}));
      // the output gain is the first node created; at the default level it is the trim
      expect(gains[0].gain.value, id).toBeCloseTo(EDIT_TRIM);
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

describe("the electric engines", () => {
  /** The times the resistor locomotive's controller clacks: its clack gain struck to 1.6. */
  function clacks(values: SoundValues, ticks: Array<[number, number]>): number[] {
    const { ctx, dest } = stubContext();
    const at: number[] = [];
    const spy = ctx as unknown as { createGain: () => { gain: Record<string, unknown> } };
    const make = spy.createGain;
    spy.createGain = () => {
      const g = make();
      g.gain.setTargetAtTime = (v: number, t: number) => {
        if (v === 1.6) at.push(t);
      };
      return g;
    };
    const d = soundById("electric-engine-resistor")!;
    if (d.kind !== "loop") throw new Error("a loop");
    const voice = d.start(ctx, dest, 0, values);
    for (const [now, horizon] of ticks) voice.tick(now, horizon);
    return at;
  }

  it("clack up a notch every 1.1-1.4 s only while pulling hard at low speed, and only as far ahead as asked", () => {
    const at = clacks({ speed: 0.2, load: 1 }, [[0, 5]]);
    expect(at.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < at.length; i++) {
      expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(1.1);
      expect(at[i]! - at[i - 1]!).toBeLessThanOrEqual(1.4);
    }
    expect(Math.max(...at)).toBeLessThan(5);
    // ticking again over time already scheduled adds nothing
    expect(clacks({ speed: 0.2, load: 1 }, [[0, 5], [1, 2]])).toEqual(at);
    expect(clacks({ speed: NOTCH_BELOW + 0.1, load: 1 }, [[0, 5]])).toEqual([]);
    expect(clacks({ speed: 0.2, load: 0.3 }, [[0, 5]])).toEqual([]);
    expect(clacks({ speed: 0, load: 1 }, [[0, 5]])).toEqual([]);
  });

  it("whine at the gears' mesh frequency, in step with the speed", () => {
    expect(gearMesh(0)).toBe(0);
    expect(gearMesh(20) / gearMesh(10)).toBeCloseTo(2, 9);
    // 79 teeth on 1.25 m wheels: about 400 Hz at 72 km/h
    expect(gearMesh(20)).toBeGreaterThan(390);
    expect(gearMesh(20)).toBeLessThan(410);
    expect(rollingLevel(0)).toBe(0);
    expect(rollingLevel(1)).toBe(1);
  });

  it("keep the measured converter tones of the ICE: 1180 Hz the strongest, rising 8 %", () => {
    expect(CONVERTER_TONES.map((c) => c.freq)).toEqual([1180, 1830, 2420, 2750, 3070]);
    expect([...CONVERTER_TONES].sort((a, b) => b.level - a.level)[0]!.freq).toBe(1180);
    expect(CONVERTER_RISE).toBeCloseTo(0.08, 6);
  });
});

describe("the helicopter", () => {
  const heli = () => {
    const d = soundById("helicopter")!;
    if (d.kind !== "loop") throw new Error("helicopter is a loop");
    return d;
  };

  /** Start it on a stub context whose gains record every blade pulse (a rise with PULSE_ATTACK) and every target. */
  function recording(values: SoundValues) {
    const { ctx, dest } = stubContext();
    const pulses: number[] = [];
    const calls: string[] = [];
    const spy = ctx as unknown as { createGain: () => { gain: Record<string, unknown> } };
    const make = spy.createGain;
    let n = 0;
    spy.createGain = () => {
      const g = make();
      const id = n++;
      g.gain.setTargetAtTime = (v: number, at: number, tau: number) => {
        calls.push(`${id} ${v.toFixed(6)} ${at.toFixed(6)} ${tau}`);
        // gain 2 is the thump pulse (after the output and the thump part): one rise per blade
        if (tau === PULSE_ATTACK && id === 2) pulses.push(at);
      };
      g.gain.setValueAtTime = (v: number, at: number) => calls.push(`${id} = ${v.toFixed(6)} ${at.toFixed(6)}`);
      return g;
    };
    const voice = heli().start(ctx, dest, 0, values);
    return { voice, pulses, calls };
  }

  it("is one loop in the aircraft category with the parameters the game and the factory name", () => {
    const d = heli();
    expect(d.category).toBe("aircraft");
    expect(d.title).toBe("Helicopter");
    const p = Object.fromEntries(d.params.map((x) => [x.name, x]));
    expect(d.params.map((x) => x.name)).toEqual(["spin", "load", "size", "blades", "level"]);
    expect(p.spin).toMatchObject({ kind: "number", min: 0, max: 1, default: 1 });
    expect(p.load).toMatchObject({ kind: "number", min: 0, max: 1, default: 0.5 });
    expect(p.size).toMatchObject({ kind: "number", min: 0, max: 1, default: 0.5 });
    expect(p.blades).toMatchObject({ kind: "number", min: 2, max: 6, step: 1, default: 4 });
    expect(soundsIn("aircraft").map((s) => s.id)).toEqual(["helicopter"]);
  });

  it("slaps at blades x the rotor's revolutions: a Bell 206 near 13 Hz, a Mil Mi-8 near 16 Hz", () => {
    // published main rotor speeds: Bell 206 394 rpm (10.2 m), Mi-8 192 rpm (21.3 m)
    expect(rotorRev(0) * 60).toBeGreaterThan(380);
    expect(rotorRev(0) * 60).toBeLessThan(410);
    expect(rotorRev(1) * 60).toBeGreaterThan(180);
    expect(rotorRev(1) * 60).toBeLessThan(200);
    expect(bladePass(0, 2)).toBeCloseTo(13.2, 0);
    expect(bladePass(1, 5)).toBeCloseTo(15.8, 0);
    expect(tailPass(0)).toBeGreaterThan(tailPass(1));
    expect(tailPass(1)).toBeGreaterThan(bladePass(1, 6));
    const { voice, pulses } = recording({ spin: 1, size: 0, blades: 2 });
    voice.tick(0, 2);
    expect(pulses.length).toBeGreaterThanOrEqual(26);
    expect(pulses.length).toBeLessThanOrEqual(27);
    expect(Math.max(...pulses)).toBeLessThan(2);
    // ticking again over time already scheduled adds nothing
    voice.tick(1, 1);
    expect(pulses.length).toBeLessThanOrEqual(27);
  });

  it("is silent while the rotor stands, yet runs on, and spins up gliding when the game sets spin", () => {
    for (const load of [0, 0.5, 1]) for (const size of [0, 1]) {
      for (const level of Object.values(helicopterMix(0, load, size))) expect(level).toBe(0);
    }
    const { voice, pulses } = recording({ spin: 0 });
    expect(voice.endsAt).toBe(Infinity);
    for (let now = 0; now < 2; now += 0.05) voice.tick(now, 0.2);
    expect(pulses).toEqual([]);
    voice.set({ spin: 1 });
    for (let now = 2; now < 6; now += 0.05) voice.tick(now, 0.2);
    expect(pulses.length).toBeGreaterThan(20);
    // the slap speeds up gradually: the gaps shrink towards the full rate's, never jumping to it
    const gaps = pulses.slice(1).map((p, i) => p - pulses[i]!);
    const full = 1 / bladePass(0.5, 4);
    expect(gaps[0]!).toBeGreaterThan(full * 1.5);
    expect(gaps[0]!).toBeLessThan(1 / MIN_PASS + 0.05);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeLessThanOrEqual(gaps[i - 1]! + 1e-9);
    expect(gaps[gaps.length - 1]!).toBeCloseTo(full, 3);
  });

  it("slaps harder the more it lifts, and the bigger the lower and heavier", () => {
    expect(helicopterMix(1, 1, 0.5).slap).toBeGreaterThan(helicopterMix(1, 0, 0.5).slap);
    expect(helicopterMix(1, 1, 0.5).thump).toBeGreaterThan(helicopterMix(1, 0, 0.5).thump);
    expect(helicopterMix(1, 0.5, 1).thump).toBeGreaterThan(helicopterMix(1, 0.5, 0).thump);
    expect(helicopterMix(0.5, 0.5, 0.5).wash).toBeLessThan(helicopterMix(1, 0.5, 0.5).wash);
  });

  it("plays the same every time", () => {
    const run = () => {
      const r = recording({ spin: 0.3, load: 0.8, size: 0.85, blades: 4 });
      r.voice.tick(0, 1);
      r.voice.set({ spin: 1, load: 0.2, size: 0.85, blades: 4 });
      for (let now = 1; now < 3; now += 0.05) r.voice.tick(now, 0.2);
      return r.calls;
    };
    const a = run();
    expect(a.length).toBeGreaterThan(100);
    expect(run()).toEqual(a);
  });
});

describe("the animals", () => {
  const hoof = () => {
    const d = soundById("hoof-beat")!;
    if (d.kind !== "loop") throw new Error("hoof-beat is a loop");
    return d;
  };

  /** Start the hoof beat on a stub context whose gains record every footfall (a thud rising with THUD_ATTACK) and every call. */
  function recording(values: SoundValues) {
    const { ctx, dest } = stubContext();
    const falls: number[] = [];
    const calls: string[] = [];
    const spy = ctx as unknown as { createGain: () => { gain: Record<string, unknown> } };
    const make = spy.createGain;
    let n = 0;
    spy.createGain = () => {
      const g = make();
      const id = n++;
      g.gain.setTargetAtTime = (v: number, at: number, tau: number) => {
        calls.push(`${id} ${v.toFixed(6)} ${at.toFixed(6)} ${tau}`);
        if (tau === THUD_ATTACK && v > 0) falls.push(at);
      };
      return g;
    };
    const voice = hoof().start(ctx, dest, 0, values);
    /** Tick it as the game does, every 50 ms with a 200 ms lookahead. */
    const run = (from: number, to: number) => {
      for (let now = from; now < to - 1e-9; now += 0.05) voice.tick(now, 0.2);
    };
    return { voice, falls, calls, run };
  }

  it("are a hoof beat loop and a call one-shot in the Animals category, with the parameter names the factory and the game use", () => {
    expect(soundsIn("animals").map((s) => s.id)).toEqual(["hoof-beat", "animal-call"]);
    expect(CATEGORIES.find((c) => c.id === "animals")?.title).toBe("Animals");
    const h = hoof();
    expect(h.params.map((p) => p.name)).toEqual(["rate", "foot", "size", "stride", "count", "level"]);
    const p = Object.fromEntries(h.params.map((x) => [x.name, x]));
    expect(p.rate).toMatchObject({ kind: "number", min: 0, max: 16, default: 3 });
    expect(p.foot).toMatchObject({ kind: "choice", default: "hoof" });
    if (p.foot!.kind !== "choice") throw new Error("foot is a choice");
    expect(p.foot!.values.map((x) => x.value)).toEqual(["hoof", "cloven", "padded"]);
    expect(p.size).toMatchObject({ kind: "number", min: 0, max: 1, default: 0.5 });
    expect(p.stride).toMatchObject({ kind: "number", min: 0.5, max: 3, default: 1.4, unit: "m" });
    expect(p.count).toMatchObject({ kind: "number", min: 1, max: 6, step: 1, default: 1 });
    const c = soundById("animal-call")!;
    expect(c.kind).toBe("oneShot");
    expect(c.params.map((x) => x.name)).toEqual(["species", "pitch", "level"]);
    const species = c.params[0]!;
    if (species.kind !== "choice") throw new Error("species is a choice");
    expect(species.values.map((x) => x.value)).toEqual([...SPECIES]);
    expect(species.default).toBe("horse");
    expect(c.params[1]).toMatchObject({ kind: "number", min: 0.7, max: 1.4, default: 1 });
  });

  it("take four footfalls per stride: the rate the game derives from speed and stride", () => {
    expect(hoofRate(1.4, 1.4)).toBeCloseTo(4);
    expect(hoofRate(0, 1.4)).toBe(0);
    expect(hoofRate(3, 1.5)).toBeCloseTo(8);
  });

  it("walk in four nearly even beats and trot in diagonal pairs that land together", () => {
    const walk = gaitOffsets(2);
    expect(walk).toEqual([0, 0.26, 0.5, 0.76]);
    const trot = gaitOffsets(8);
    expect(trot[1]! - trot[0]!).toBeCloseTo(0.07);
    expect(trot[3]! - trot[2]!).toBeCloseTo(0.07);
    const between = gaitOffsets(4.75);
    expect(between[1]!).toBeGreaterThan(trot[1]!);
    expect(between[1]!).toBeLessThan(walk[1]!);
  });

  it("is silent while the team stands, steps at the rate given, and stops again at rate 0", () => {
    const { voice, falls, run } = recording({ rate: 0 });
    expect(voice.endsAt).toBe(Infinity);
    run(0, 2);
    expect(falls).toEqual([]);
    voice.set({ rate: 4 });
    run(2, 6);
    // four footfalls a second, one animal
    expect(falls.length).toBeGreaterThanOrEqual(15);
    expect(falls.length).toBeLessThanOrEqual(17);
    expect(Math.min(...falls)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...falls)).toBeLessThan(6.2);
    // a walk's cycle: the four gaps add up to one second at 4 footfalls a second
    const gaps = falls.slice(1).map((f, i) => f - falls[i]!);
    expect(gaps[0]! + gaps[1]! + gaps[2]! + gaps[3]!).toBeCloseTo(1, 6);
    const before = falls.length;
    voice.set({ rate: 0 });
    run(6.2, 8);
    expect(falls.length).toBe(before);
  });

  it("schedules only as far ahead as asked", () => {
    const { voice, falls } = recording({ rate: 6, count: 3 });
    voice.tick(0, 0.5);
    expect(falls.length).toBeGreaterThan(0);
    expect(Math.max(...falls)).toBeLessThan(0.5);
    const n = falls.length;
    voice.tick(0.1, 0.3);
    expect(falls.length).toBe(n);
  });

  it("puts down more footfalls the bigger the team, out of step rather than as one louder beat", () => {
    const count = (team: number) => {
      const r = recording({ rate: 4, count: team });
      r.run(0, 10);
      return r.falls;
    };
    const one = count(1);
    const four = count(4);
    expect(four.length / one.length).toBeGreaterThan(3.6);
    expect(four.length / one.length).toBeLessThan(4.4);
    // the animals walk out of step: few footfalls land within 10 ms of another (all would, in step)
    const sorted = [...four].sort((a, b) => a - b);
    const close = sorted.slice(1).filter((f, i) => f - sorted[i]! < 0.01).length;
    expect(close / sorted.length).toBeLessThan(0.2);
    // each animal is a little quieter, the team louder than one
    expect(teamShare(4)).toBeLessThan(teamShare(1));
    expect(teamShare(4) * 4).toBeGreaterThan(teamShare(1));
    // the team's offsets are seeded: the lead at 0, the others spread, the same every time
    const a = teamAnimals(6);
    expect(a[0]!.phase).toBe(0);
    expect(new Set(a.map((x) => x.phase.toFixed(4))).size).toBe(6);
    expect(teamAnimals(6).map((x) => x.phase)).toEqual(a.map((x) => x.phase));
    // a team grown while it walks joins in
    const r = recording({ rate: 4, count: 1 });
    r.run(0, 2);
    const solo = r.falls.length;
    r.voice.set({ rate: 4, count: 3 });
    r.run(2, 4);
    expect(r.falls.length - solo).toBeGreaterThan(solo * 2.5);
  });

  it("strikes a cloven foot twice, a hoof and a padded foot once, the padded with hardly a click", () => {
    expect(FOOT_PROFILES.cloven.claws).toBeGreaterThan(0);
    expect(FOOT_PROFILES.hoof.claws).toBe(0);
    expect(FOOT_PROFILES.padded.claws).toBe(0);
    expect(FOOT_PROFILES.padded.click).toBeLessThan(FOOT_PROFILES.cloven.click);
    expect(FOOT_PROFILES.cloven.click).toBeLessThan(FOOT_PROFILES.hoof.click);
    expect(FOOT_PROFILES.padded.jingle).toBe(0);
    // the measured clop of a shod hoof: 540-770 Hz
    expect(FOOT_PROFILES.hoof.knockHz).toBeGreaterThanOrEqual(540);
    expect(FOOT_PROFILES.hoof.knockHz).toBeLessThanOrEqual(770);
  });

  it("plays the same every time", () => {
    const run = () => {
      const r = recording({ rate: 7, count: 5, foot: "cloven", size: 0.7 });
      r.run(0, 3);
      r.voice.set({ rate: 2, count: 5, foot: "cloven", size: 0.7 });
      r.run(3, 5);
      return r.calls;
    };
    const a = run();
    expect(a.length).toBeGreaterThan(200);
    expect(run()).toEqual(a);
  });

  it("call every species audibly, ending by itself", () => {
    const d = soundById("animal-call")!;
    if (d.kind !== "oneShot") throw new Error("animal-call is a one-shot");
    for (const species of SPECIES) {
      const { ctx, dest, starts } = stubContext();
      let peak = 0;
      const spy = ctx as unknown as { createGain: () => { gain: Record<string, unknown> } };
      const make = spy.createGain;
      spy.createGain = () => {
        const g = make();
        g.gain.linearRampToValueAtTime = (v: number) => {
          peak = Math.max(peak, v);
        };
        return g;
      };
      const v = d.play(ctx, dest, 1, { species });
      expect(peak, species).toBeGreaterThan(0.3);
      expect(starts.filter((s) => s.what === "osc").length, species).toBeGreaterThan(0);
      expect(v.endsAt, species).toBeCloseTo(1 + CALLS[species].seconds + 0.1);
      expect(CALLS[species].seconds, species).toBeGreaterThan(1);
      expect(CALLS[species].trim, species).toBeGreaterThan(0);
    }
  });
});

describe("the tram bell", () => {
  it("rings twice, short, before departure, and once long as a warning", () => {
    const dep = tramBellPresses("departure");
    expect(dep).toHaveLength(2);
    expect(dep[1]![0]).toBeGreaterThan(dep[0]![0] + dep[0]![1]);
    for (const [, length] of dep) expect(length).toBeLessThan(0.5);
    expect(tramBellPresses("warning")).toEqual([[0, 2.8]]);
  });

  it("keeps the measured bell of the KT4DM: 6230 Hz loudest, 9295 Hz next, struck 50 times a second", () => {
    const byLevel = [...TRAM_BELL_PARTIALS].sort((a, b) => b.level - a.level);
    expect(byLevel.map((p) => p.freq)).toEqual([6230, 9295, 1565, 3647, 12452]);
    expect(TRAM_BELL_STRIKES).toBe(50);
  });

  it("ends by itself once rung out, longer for the warning", () => {
    const d = soundById("tram-bell")!;
    if (d.kind !== "oneShot") throw new Error("a one-shot");
    const short = d.play(stubContext().ctx, stubContext().dest, 0, { call: "departure" }).endsAt;
    const long = d.play(stubContext().ctx, stubContext().dest, 0, { call: "warning" }).endsAt;
    expect(short).toBeGreaterThan(0.8);
    expect(long).toBeGreaterThan(short);
  });

  it("whistles in the chord shape measured in a steam whistle, the top pipe loudest", () => {
    expect(WHISTLE_PIPES.map(([r]) => r)).toEqual([0.357, 1, 1.438, 1.727]);
    expect([...WHISTLE_PIPES].sort((a, b) => b[1] - a[1])[0]![0]).toBe(1.727);
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
  const ENGINE_IDS = Object.keys(DIESEL_PROFILES).map((k) => `diesel-engine-${k}`);
  const engineLoop = (id: string) => {
    const d = soundById(id)!;
    if (d.kind !== "loop") throw new Error(`${id} is a loop`);
    return d;
  };

  /** A stub context whose engine-cycle oscillators record their frequency targets (the cycle rate), with the times. */
  function recordingContext() {
    const { ctx, dest } = stubContext();
    const targets: Array<{ at: number; v: number }> = [];
    const cancels: number[] = [];
    const spy = ctx as unknown as {
      createOscillator: () => {
        type: string;
        frequency: { setTargetAtTime: (v: number, at: number) => void; cancelScheduledValues: (at: number) => void };
      };
    };
    const make = spy.createOscillator;
    spy.createOscillator = () => {
      const o = make();
      // the engine cycle's oscillators only (the turbo is a sine): their frequency is the cycle rate
      o.frequency.setTargetAtTime = (v, at) => {
        if (o.type !== "sine") targets.push({ at, v });
      };
      o.frequency.cancelScheduledValues = (at) => cancels.push(at);
      return o;
    };
    return { ctx, dest, targets, cancels };
  }

  it("is one loop per profile, with no engine choice left", () => {
    expect(SOUNDS.filter((s) => s.id.startsWith("diesel")).map((s) => s.id)).toEqual(ENGINE_IDS);
    for (const id of ["diesel-engine", "diesel-start", "diesel-stop"]) expect(soundById(id), id).toBeUndefined();
    for (const id of ENGINE_IDS) {
      const d = engineLoop(id);
      expect(d.params.map((p) => p.name), id).toEqual(["rpm", "load", "size", "state", "level"]);
      const state = d.params.find((p) => p.name === "state")!;
      if (state.kind !== "choice") throw new Error("state is a choice");
      expect(state.values.map((v) => v.value)).toEqual(["run", "start", "stop", "off"]);
      expect(state.default).toBe("run");
    }
    expect(dieselRuns("run") && dieselRuns("start")).toBe(true);
    expect(dieselRuns("stop") || dieselRuns("off")).toBe(false);
  });

  it("fires faster as it revs, and a big engine lower than a small one", () => {
    expect(dieselFiring(0.5, 1)).toBeGreaterThan(dieselFiring(0.5, 0));
    expect(dieselFiring(1, 0.5)).toBeLessThan(dieselFiring(0, 0.5));
    // a mainline engine idles near 40 firings a second and runs up to about 110
    expect(dieselFiring(0.5, 0)).toBeCloseTo(40);
    expect(dieselFiring(0.5, 1)).toBeCloseTo(110);
  });

  it("runs louder the harder it works, and is never silent", () => {
    expect(dieselLevel(1, 1)).toBeGreaterThan(dieselLevel(0, 0));
    expect(dieselLevel(0, 0)).toBeGreaterThan(0);
    expect(dieselLevel(1, 1)).toBeLessThanOrEqual(1);
  });

  it("schedules only as far ahead as asked", () => {
    const { ctx, dest, targets } = recordingContext();
    const v = engineLoop("diesel-engine-mainline").start(ctx, dest, 0, {});
    v.tick(0, 1);
    expect(Math.max(...targets.map((x) => x.at))).toBeLessThan(1);
    v.stop(1);
    const n = targets.length;
    v.tick(1, 1);
    expect(targets).toHaveLength(n);
  });

  it("joins the state it is begun in: running at once, silent shut down, the start only at `start`", () => {
    for (const id of ENGINE_IDS) {
      const running = recordingContext();
      const r = engineLoop(id).start(running.ctx, running.dest, 2, { state: "run", rpm: 0 });
      expect(r.endsAt).toBe(Infinity);
      // at idle at once, no cough below it
      expect(Math.min(...running.targets.map((x) => x.v)), id).toBeGreaterThan(0);
      const off = recordingContext();
      const o = engineLoop(id).start(off.ctx, off.dest, 2, { state: "off" });
      o.tick(2, 1);
      expect(o.endsAt, id).toBe(2);
      // nothing turns: every frequency target is 0
      expect(off.targets.every((x) => x.v === 0), id).toBe(true);
      const starting = recordingContext();
      const s = engineLoop(id).start(starting.ctx, starting.dest, 2, { state: "start" });
      s.tick(2, 1);
      expect(s.endsAt).toBe(Infinity);
      // the coughs turn it slower than idle
      const idleRate = Math.min(...running.targets.map((x) => x.v));
      expect(Math.min(...starting.targets.map((x) => x.v)), id).toBeLessThan(idleRate);
    }
  });

  it("starts and shuts down inside the voice when the state changes, reporting when it is silent", () => {
    const { ctx, dest, targets, cancels } = recordingContext();
    const v = engineLoop("diesel-engine-shunter").start(ctx, dest, 0, { state: "off" });
    v.tick(0, 0.5);
    // started: the start's program from now, and running from when it idles
    v.set({ state: "start" });
    v.tick(1, 0.5);
    expect(cancels).toContain(1);
    expect(v.endsAt).toBe(Infinity);
    const { idles } = dieselStartTimes("shunter");
    for (let now = 1; now < 1 + idles + 1; now += 0.1) v.tick(now, 0.5);
    v.set({ state: "run", rpm: 1 });
    for (let now = 1 + idles + 1; now < 6; now += 0.1) v.tick(now, 0.5);
    expect(Math.max(...targets.map((x) => x.v))).toBeGreaterThan(dieselRpm("shunter", 0.5, 0.9) / 120);
    // shut down: it winds down and says when it is silent
    v.set({ state: "stop", rpm: 1 });
    v.tick(6, 0.5);
    expect(v.endsAt).toBeCloseTo(6 + dieselStopTimes("shunter").ends);
    const n = targets.length;
    for (let now = 6; now < 12; now += 0.1) v.tick(now, 0.5);
    // nothing more is scheduled once it is off, and it stays silent at `off`
    v.set({ state: "off" });
    v.tick(12, 0.5);
    expect(targets).toHaveLength(n);
    expect(v.endsAt).toBeCloseTo(6 + dieselStopTimes("shunter").ends);
    v.stop(12);
  });

  it("finishes a start the game asks to run before it idles, then glides to the revs", () => {
    const { ctx, dest, targets } = recordingContext();
    const v = engineLoop("diesel-engine-bus").start(ctx, dest, 0, { state: "start" });
    v.set({ state: "run", rpm: 1, load: 1 });
    v.tick(0.5, 0.5);
    const { idles } = dieselStartTimes("bus");
    // no running revs before the start has idled
    const full = dieselRpm("bus", 0.5, 1) / 120;
    expect(targets.filter((x) => x.at < idles).every((x) => x.v < full * 0.9)).toBe(true);
    for (let now = 0.5; now < idles + 1; now += 0.1) v.tick(now, 0.5);
    expect(targets.some((x) => x.at >= idles && x.v > full * 0.95)).toBe(true);
    v.stop(idles + 1);
  });

  it("can be started again while it runs down", () => {
    const { ctx, dest } = recordingContext();
    const v = engineLoop("diesel-engine-two-stroke").start(ctx, dest, 0, { state: "run" });
    v.tick(0, 0.5);
    v.set({ state: "stop" });
    v.tick(1, 0.5);
    expect(v.endsAt).toBeLessThan(Infinity);
    v.set({ state: "start" });
    v.tick(2, 0.5);
    expect(v.endsAt).toBe(Infinity);
    v.stop(3);
  });
});

describe("the diesel profiles", () => {
  const engines = Object.keys(DIESEL_PROFILES);

  it("idle and run at their engine's measured speeds, `size` 0.5 being the profile itself", () => {
    for (const e of engines) {
      const p = DIESEL_PROFILES[e as keyof typeof DIESEL_PROFILES];
      expect(dieselRpm(e, 0.5, 0), e).toBeCloseTo(p.idleRpm);
      expect(dieselRpm(e, 0.5, 1), e).toBeCloseTo(p.maxRpm);
      expect(dieselRpm(e, 0, 0.5)).toBeGreaterThan(dieselRpm(e, 1, 0.5));
    }
    // a four-stroke six fires three times a turn, a two-stroke V16 sixteen times
    expect(dieselFiring(0.5, 0, "bus")).toBeCloseTo((600 / 60) * 3);
    expect(dieselFiring(0.5, 0, "two-stroke")).toBeCloseTo((315 / 60) * 16);
    // an unknown engine is the mainline one
    expect(dieselFiring(0.5, 0.3, "steam")).toBe(dieselFiring(0.5, 0.3, "mainline"));
  });

  it("draw a cycle whose strongest line is the firing order, with the half orders of an uneven engine", () => {
    for (const e of engines) {
      const p = DIESEL_PROFILES[e as keyof typeof DIESEL_PROFILES];
      const { real, imag } = cycleSeries(cycleShape(p, 0.1, 1));
      const mag = (k: number) => Math.hypot(real[k]!, imag[k]!);
      let best = 1;
      for (let k = 2; k < real.length; k++) if (mag(k) > mag(best)) best = k;
      expect(best % p.cylinders, e).toBe(0);
      // the lope: lines between the firing order's, which an even engine would not have
      let between = 0;
      for (let k = 1; k < 4 * p.cylinders; k++) if (k % p.cylinders !== 0) between = Math.max(between, mag(k));
      expect(between / mag(p.cylinders), e).toBeGreaterThan(0.05);
    }
    // the same engine always lopes the same way
    expect(cycleShape(DIESEL_PROFILES.truck, 0.3, 1)).toEqual(cycleShape(DIESEL_PROFILES.truck, 0.3, 1));
  });

  it("start with the engine itself, no starter: silent until it coughs", () => {
    for (const e of engines) {
      const { catches, idles } = dieselStartTimes(e);
      expect(catches, e).toBeGreaterThan(0);
      expect(idles).toBeGreaterThan(catches);
      const { ctx, dest } = stubContext();
      const types: string[] = [];
      const spy = ctx as unknown as { createOscillator: () => { type: string } };
      const make = spy.createOscillator;
      spy.createOscillator = () => {
        const o = make();
        return new Proxy(o, {
          set(target, key, value) {
            if (key === "type") types.push(value as string);
            (target as Record<string | symbol, unknown>)[key] = value;
            return true;
          },
        });
      };
      const d = soundById(`diesel-engine-${e}`)!;
      if (d.kind !== "loop") throw new Error("an engine is a loop");
      d.start(ctx, dest, 2, { state: "start" }).tick(2, 1);
      // the starter motor was a sawtooth; the engine's own oscillators are periodic waves and a sine turbo
      expect(types, e).not.toContain("sawtooth");
    }
  });

  it("stop by running down after the fuel is cut, the turbo spinning on", () => {
    for (const e of engines) {
      const { cut, still, ends } = dieselStopTimes(e);
      expect(still, e).toBeGreaterThan(cut);
      expect(ends).toBeGreaterThan(still);
    }
    expect(dieselStopTimes("two-stroke").still).toBeGreaterThan(dieselStopTimes("truck").still);
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
