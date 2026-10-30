import { describe, expect, it } from "vitest";
import { barAt, secondsToTick, tickToSeconds } from "../lib/performance.ts";

describe("timing", () => {
  const perf = { ppq: 480, swing: 0.5, tempos: [[0, 120], [1920, 60]] as [number, number][], bars: [0, 1920, 3840] };

  it("follows the tempo map", () => {
    expect(tickToSeconds(perf, 480)).toBeCloseTo(0.5);
    expect(tickToSeconds(perf, 1920)).toBeCloseTo(2);
    expect(tickToSeconds(perf, 2400)).toBeCloseTo(3);
    expect(secondsToTick(perf, 3)).toBeCloseTo(2400);
  });

  it("swings the off-beat eighths only", () => {
    const swung = { ...perf, swing: 2 / 3 };
    expect(tickToSeconds(swung, 480)).toBeCloseTo(0.5);
    expect(tickToSeconds(swung, 240)).toBeCloseTo(1 / 3);
  });

  it("finds the bar at a tick", () => {
    expect(barAt(perf, 0)).toBe(0);
    expect(barAt(perf, 1919)).toBe(0);
    expect(barAt(perf, 1920)).toBe(1);
    expect(barAt(perf, 99999)).toBe(2);
  });
});
