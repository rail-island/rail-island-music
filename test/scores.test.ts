import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arrange } from "../lib/arrange.ts";
import { PARAMS } from "../lib/params.ts";
import { INSTRUMENTS } from "../synth/instruments.ts";
import { loadPieces } from "../generator/scores.ts";

const pieces = loadPieces();

/** Pitches each sampled instrument has a recording of (samples/<instrument>/<midi>.mp3). */
const samples: Record<string, number[]> = {};
for (const inst of Object.keys(INSTRUMENTS)) {
  if (INSTRUMENTS[inst]!.kind !== "sampled") continue;
  samples[inst] = readdirSync(join("samples", inst)).map((f) => Number(f.replace(".mp3", "")));
}

describe("scores", () => {
  it("has unique ids and its sources", () => {
    expect(pieces.length).toBeGreaterThanOrEqual(7);
    expect(new Set(pieces.map((p) => p.meta.id)).size).toBe(pieces.length);
    for (const p of pieces) expect(existsSync(join("scores", p.meta.id, "SOURCES.md")), p.meta.id).toBe(true);
  });

  for (const p of pieces) {
    it(`${p.meta.id}: the default arrangement lasts 2 to 5 minutes`, () => {
      const perf = arrange(p.meta, p.score, p.meta.defaults);
      expect(perf.duration).toBeGreaterThanOrEqual(120);
      expect(perf.duration).toBeLessThanOrEqual(300);
      expect(perf.chords.length).toBeGreaterThan(0);
    });

    it(`${p.meta.id}: every ensemble and key arranges within the samples`, () => {
      for (const ensemble of PARAMS[0]!.values.map((v) => v.value)) {
        for (const key of ["-3", "0", "+3"]) {
          const perf = arrange(p.meta, p.score, { ...p.meta.defaults, ensemble, key, length: "short" });
          expect(perf.tracks.find((t) => t.id === "melody")).toBeDefined();
          for (const t of perf.tracks) {
            const have = samples[t.instrument];
            if (!have) continue;
            for (let i = 2; i < t.notes.length; i += 4) {
              const p = t.notes[i]!;
              const nearest = Math.min(...have.map((s) => Math.abs(s - p)));
              expect(nearest, `${t.instrument} ${p}`).toBeLessThanOrEqual(7);
            }
          }
        }
      }
    });
  }
});

describe("samples", () => {
  it("covers every sampled instrument and lists its sources", () => {
    for (const [inst, list] of Object.entries(samples)) expect(list.length, inst).toBeGreaterThanOrEqual(5);
    for (const d of ["kick", "snare", "ride", "crash"]) expect(existsSync(join("samples", "drums", `${d}.mp3`))).toBe(true);
    expect(existsSync(join("samples", "SOURCES.md"))).toBe(true);
  });
});
