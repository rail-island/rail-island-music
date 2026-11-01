// The jingles (jingles/<id>/, docs/music/jingles.md): every one has both
// versions, its recording and its sources; both versions arrange in every
// ensemble, tempo and key within the samples; a jingle stays a jingle (a few
// seconds, a few bars, never repeated); and the site's copy carries them while
// the game-facing catalog does not.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arrange } from "../lib/arrange.ts";
import { JINGLE_PARAMS, JINGLE_VERSIONS, type JingleParams, type JingleVersion, jingleAsPiece, resolveJingleParams } from "../lib/jingles.ts";
import { INSTRUMENTS } from "../synth/instruments.ts";
import { jingleEntry, loadJingles } from "../generator/jingles.ts";

const jingles = loadJingles();

const samples: Record<string, number[]> = {};
for (const inst of Object.keys(INSTRUMENTS)) {
  if (INSTRUMENTS[inst]!.kind !== "sampled") continue;
  samples[inst] = readdirSync(join("samples", inst)).map((f) => Number(f.replace(".mp3", "")));
}

function arrangeJingle(j: (typeof jingles)[number], params: JingleParams) {
  const { piece, params: p } = jingleAsPiece(j.meta, params);
  return arrange(piece, j.scores[params.version as JingleVersion], p);
}

describe("jingles", () => {
  it("are the five recordings, in order, each with its recording and sources", () => {
    expect(jingles.map((j) => j.meta.id)).toEqual(["jingle-1", "jingle-2", "jingle-3", "jingle-4", "jingle-5"]);
    for (const j of jingles) {
      expect(existsSync(join("jingles", j.meta.id, "recording.mid")), j.meta.id).toBe(true);
      expect(existsSync(join("jingles", j.meta.id, "SOURCES.md")), j.meta.id).toBe(true);
    }
  });

  it("offer a Version, an ensemble, a tempo and a key -- and no Length", () => {
    expect(JINGLE_PARAMS.map((p) => p.name)).toEqual(["version", "ensemble", "tempo", "key"]);
    expect(JINGLE_PARAMS[0]!.values.map((v) => v.value)).toEqual([...JINGLE_VERSIONS]);
  });

  for (const j of jingles) {
    it(`${j.meta.id}: both versions are a few seconds and a few bars, played once`, () => {
      for (const version of JINGLE_VERSIONS) {
        const perf = arrangeJingle(j, { ...j.meta.defaults, version });
        expect(perf.duration, version).toBeGreaterThanOrEqual(1.5);
        expect(perf.duration, version).toBeLessThanOrEqual(15);
        expect(perf.bars.length, version).toBeLessThanOrEqual(8);
        expect(perf.bars.length, version).toBe(Object.values(j.scores[version].parts).reduce((n, p) => n + p.bars.length, 0));
      }
    });

    it(`${j.meta.id}: every version, ensemble, tempo and key arranges within the samples`, () => {
      for (const version of JINGLE_VERSIONS)
        for (const ensemble of JINGLE_PARAMS[1]!.values.map((v) => v.value))
          for (const tempo of JINGLE_PARAMS[2]!.values.map((v) => v.value))
            for (const key of ["-3", "0", "+3"]) {
              const perf = arrangeJingle(j, { version, ensemble, tempo, key });
              expect(perf.tracks.find((t) => t.id === "melody")).toBeDefined();
              for (const t of perf.tracks) {
                const have = samples[t.instrument];
                if (!have) continue;
                for (let i = 2; i < t.notes.length; i += 4) {
                  const p = t.notes[i]!;
                  expect(Math.min(...have.map((s) => Math.abs(s - p))), `${t.instrument} ${p}`).toBeLessThanOrEqual(7);
                }
              }
            }
    });
  }

  it("switch versions by the parameter, and drop unknown values", () => {
    const j = jingles[0]!;
    expect(resolveJingleParams(j.meta, { version: "rewrite", length: "long", key: "+9" })).toEqual({ ...j.meta.defaults, version: "rewrite" });
    const tidy = arrangeJingle(j, { ...j.meta.defaults, version: "tidy" });
    const rewrite = arrangeJingle(j, { ...j.meta.defaults, version: "rewrite" });
    expect(rewrite.tracks.find((t) => t.id === "melody")!.notes).not.toEqual(tidy.tracks.find((t) => t.id === "melody")!.notes);
  });

  it("list the default arrangement's facts for the site", () => {
    const e = jingleEntry(jingles[0]!);
    expect(e.key).toBe("D");
    expect(e.meter).toBe("4/4");
    expect(e.duration).toBeGreaterThan(1.5);
  });
});
