// The jingles (jingles/<id>/, docs/music/jingles.md): every one has its score,
// its recording and its sources; it arranges in every ensemble, tempo and key
// within the samples; a jingle stays a jingle (a few seconds, a few bars,
// never repeated); and the site's copy carries them while the game-facing
// catalog does not.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arrange } from "../lib/arrange.ts";
import { PPQ } from "../lib/theory.ts";
import { JINGLE_PARAMS, type JingleParams, jingleAsPiece, resolveJingleParams } from "../lib/jingles.ts";
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
  return arrange(piece, j.score, p);
}

describe("jingles", () => {
  it("are the recordings, each with its score, recording and sources", () => {
    expect(jingles.map((j) => j.meta.id)).toEqual(["jingle-1"]);
    for (const j of jingles) {
      expect(existsSync(join("jingles", j.meta.id, "recording.mid")), j.meta.id).toBe(true);
      expect(existsSync(join("jingles", j.meta.id, "SOURCES.md")), j.meta.id).toBe(true);
    }
  });

  it("offer an ensemble, a tempo and a key -- and no Length", () => {
    expect(JINGLE_PARAMS.map((p) => p.name)).toEqual(["ensemble", "tempo", "key"]);
  });

  for (const j of jingles) {
    it(`${j.meta.id}: a few seconds and a few bars, played once`, () => {
      const perf = arrangeJingle(j, j.meta.defaults);
      expect(perf.duration).toBeGreaterThanOrEqual(1.5);
      expect(perf.duration).toBeLessThanOrEqual(15);
      expect(perf.bars.length).toBeLessThanOrEqual(8);
      expect(perf.bars.length).toBe(Object.values(j.score.parts).reduce((n, p) => n + p.bars.length, 0));
    });

    it(`${j.meta.id}: every ensemble, tempo and key arranges within the samples`, () => {
      for (const ensemble of JINGLE_PARAMS[0]!.values.map((v) => v.value))
        for (const tempo of JINGLE_PARAMS[1]!.values.map((v) => v.value))
          for (const key of ["-3", "0", "+3"]) {
            const perf = arrangeJingle(j, { ensemble, tempo, key });
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

  it("drop unknown parameters and values", () => {
    const j = jingles[0]!;
    expect(resolveJingleParams(j.meta, { version: "rewrite", length: "long", key: "+9", tempo: "lively" })).toEqual({ ...j.meta.defaults, tempo: "lively" });
  });

  it("jingle-1 keeps the recording's harp chords: rolled D, D/C#, D/C, then a plain G/B", () => {
    const j = jingles.find((x) => x.meta.id === "jingle-1")!;
    const bars = Object.values(j.score.parts).flatMap((p) => p.bars);
    expect(bars.map((b) => b.chords.map((c) => c.chord.symbol).join(" "))).toEqual(["D", "D/C#", "D/C", "G/B", "D", "A7", "D", "D"]);
    // A harp chord is rolled up from its bass: three bass notes start, one
    // after another, within the first beat. The G/B bar starts with a plain octave.
    const firstBeat = (i: number) => bars[i]!.voices.bass!.filter((n) => n.start < PPQ);
    for (const i of [0, 1, 2]) {
      const roll = firstBeat(i);
      expect(roll.length, `bar ${i + 1}`).toBe(3);
      expect(new Set(roll.map((n) => n.start)).size, `bar ${i + 1}`).toBe(3);
    }
    expect(firstBeat(3).map((n) => n.start)).toEqual([0, 0]);
    // The right hand rolls D-F#-A, C#-F#-A, C-F#-A; its top A starts the melody
    // A-B-A-F#-G, with B an eighth later.
    const rolled = (i: number) =>
      bars[i]!.voices.mel!.filter((n) => n.start === 0).sort((a, b) => (a.roll ?? 0) - (b.roll ?? 0)).map((n) => n.pitch);
    expect([0, 1, 2].map(rolled)).toEqual([
      [62, 66, 69],
      [61, 66, 69],
      [60, 66, 69],
    ]);
    // The top line: the highest note at each onset.
    const topLine = (i: number) => {
      const top = new Map<number, number>();
      for (const n of bars[i]!.voices.mel!) top.set(n.start, Math.max(top.get(n.start) ?? 0, n.pitch));
      return [...top].sort((a, b) => a[0] - b[0]);
    };
    for (const i of [0, 1]) {
      expect(topLine(i), `bar ${i + 1}`).toEqual([
        [0, 69],
        [PPQ / 2, 71],
        [PPQ, 69],
        [(3 * PPQ) / 2, 66],
        [(5 * PPQ) / 2, 67],
      ]);
    }
    expect(topLine(2).slice(0, 3)).toEqual([
      [0, 69],
      [PPQ / 2, 71],
      [PPQ, 69],
    ]);
    expect(bars[3]!.voices.mel!.some((n) => n.roll)).toBe(false);
  });

  it("list the default arrangement's facts for the site", () => {
    const e = jingleEntry(jingles[0]!);
    expect(e.key).toBe("D");
    expect(e.meter).toBe("3/4");
    expect(e.duration).toBeGreaterThan(1.5);
  });
});
