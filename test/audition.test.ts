// What a sound's page plays (src/audition.ts). Regression: leaving a sound's
// page used to stop only a running loop, so a bell's strikes or a horn's call
// went on ringing over the list; now everything still sounding is stopped.

import { describe, expect, it } from "vitest";
import { createAudition, type Timers } from "../src/audition.ts";
import type { LoopDesign, LoopVoice, OneShotDesign, Voice } from "../sounds/types.ts";

function fakes() {
  const ctx = { currentTime: 0 } as { currentTime: number };
  const stopped: string[] = [];
  const ticks: number[] = [];
  const intervals = new Set<number>();
  let next = 1;
  const timers: Timers = {
    setInterval: () => {
      intervals.add(next);
      return next++;
    },
    clearInterval: (id) => intervals.delete(id as number),
  };
  const oneShot = (name: string, length: number): OneShotDesign =>
    ({
      kind: "oneShot",
      play: (_c: BaseAudioContext, _d: AudioNode, t: number): Voice => ({ endsAt: t + length, stop: () => stopped.push(name) }),
    }) as unknown as OneShotDesign;
  const loop = (name: string): LoopDesign =>
    ({
      kind: "loop",
      start: (): LoopVoice => ({ endsAt: Infinity, stop: () => stopped.push(name), tick: (now) => ticks.push(now), set: () => {} }),
    }) as unknown as LoopDesign;
  const audition = createAudition(ctx as unknown as BaseAudioContext, {} as AudioNode, timers);
  return { ctx, stopped, ticks, intervals, oneShot, loop, audition };
}

describe("the audition", () => {
  it("stops every one-shot still ringing, and the loop, when the page is left", () => {
    const f = fakes();
    f.audition.playOnce(f.oneShot("bell", 20), {});
    f.audition.playOnce(f.oneShot("horn", 2), {});
    f.audition.startLoop(f.loop("chuff"), {});
    expect(f.audition.endsAt()).toBe(Infinity);
    f.ctx.currentTime = 5; // the horn has ended by itself, the bell still rings
    f.audition.stopAll();
    expect(f.stopped.sort()).toEqual(["bell", "chuff"]);
    expect(f.intervals.size).toBe(0);
    expect(f.audition.endsAt()).toBe(0);
  });

  it("ticks a loop at once and on a timer, and stops the timer with the loop", () => {
    const f = fakes();
    f.audition.startLoop(f.loop("a"), {});
    expect(f.ticks).toEqual([0]);
    expect(f.intervals.size).toBe(1);
    f.audition.startLoop(f.loop("b"), {}); // a second start replaces the first
    expect(f.stopped).toEqual(["a"]);
    expect(f.intervals.size).toBe(1);
    f.audition.stopLoop();
    expect(f.stopped).toEqual(["a", "b"]);
    expect(f.intervals.size).toBe(0);
  });

  it("knows when the one-shots fall silent by themselves", () => {
    const f = fakes();
    f.audition.playOnce(f.oneShot("x", 3), {});
    f.audition.playOnce(f.oneShot("y", 1), {});
    expect(f.audition.endsAt()).toBeCloseTo(3.02);
    f.ctx.currentTime = 4;
    expect(f.audition.endsAt()).toBe(0);
  });
});
