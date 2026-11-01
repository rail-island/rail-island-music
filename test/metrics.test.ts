// The build's metrics of each sound design (generator/metrics.ts): its own JS
// size and the Web Audio nodes it creates at its defaults.

import { describe, expect, it } from "vitest";
import { SOUNDS, soundById } from "../sounds/index.ts";
import { audioMetrics, measureSounds } from "../generator/metrics.ts";
import { soundsMeta } from "../generator/sounds.ts";

describe("sound metrics", async () => {
  const metrics = await measureSounds(SOUNDS);

  it("measure every design, and the meta file carries them", () => {
    expect([...metrics.keys()]).toEqual(SOUNDS.map((s) => s.id));
    for (const s of soundsMeta(metrics).sounds) expect(s.metrics).toEqual(metrics.get(s.id));
    // without metrics (the site reading source) there are none
    expect(soundsMeta().sounds.every((s) => s.metrics === undefined)).toBe(true);
  });

  it("size each design alone, not the whole module it sits in", () => {
    const m = (id: string) => metrics.get(id)!;
    // locoHorn and dieselEngine share trains.ts; the engine is the bigger design
    expect(m("loco-horn").jsBytes).toBeLessThan(m("diesel-engine").jsBytes);
    for (const s of SOUNDS) expect(m(s.id).jsBytes).toBeGreaterThan(500);
  });

  it("give one-shots a length and loops a node rate", () => {
    for (const s of SOUNDS) {
      const x = metrics.get(s.id)!;
      expect(x.params).toBe(s.params.length);
      expect(x.nodesAtStart).toBeGreaterThan(0);
      if (s.kind === "oneShot") {
        expect(x.seconds).toBeGreaterThan(0);
        expect(x.nodesPerSecond).toBeNull();
      } else {
        expect(x.seconds).toBeNull();
        expect(x.nodesPerSecond).toBeGreaterThanOrEqual(0);
      }
    }
    // the rapids' bubbles are new nodes all the time
    expect(metrics.get("river-rapids")!.nodesPerSecond).toBeGreaterThan(0);
  });

  it("are deterministic", () => {
    expect(audioMetrics(soundById("big-ben")!)).toEqual(audioMetrics(soundById("big-ben")!));
  });
});
