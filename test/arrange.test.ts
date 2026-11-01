import { describe, expect, it } from "vitest";
import { parseAbc } from "../lib/abcParse.ts";
import { arrange, fitRange, voice } from "../lib/arrange.ts";
import { ENSEMBLES } from "../lib/ensembles.ts";
import type { Params, PieceMeta } from "../lib/params.ts";
import { parseChord } from "../lib/theory.ts";
import { INSTRUMENTS } from "../synth/instruments.ts";

const meta: PieceMeta = {
  id: "test-tune",
  title: "Test",
  composer: "Nobody",
  year: 1900,
  set: "railway",
  groove: "oompah",
  swing: 0.5,
  defaults: { ensemble: "brass-band", tempo: "normal", length: "full", key: "0" },
  publicDomain: "test",
};
const score = parseAbc(
  ["X:1", "T:Test", "M:2/4", "L:1/8", "Q:1/4=120", "K:C", '|: G | "C"c2 e2 | "G7"d2 B2 | "C"c3 :|'].join("\n"),
);
const params = (p: Partial<Params> = {}): Params => ({ ...meta.defaults, ...p });
const track = (perf: ReturnType<typeof arrange>, id: string) => perf.tracks.find((t) => t.id === id)!;
const pitches = (notes: number[]) => notes.filter((_, i) => i % 4 === 2);

describe("arrange", () => {
  it("is deterministic", () => {
    expect(JSON.stringify(arrange(meta, score, params()))).toBe(JSON.stringify(arrange(meta, score, params())));
  });

  it("adds no chords to a score that writes its harmony and its bass, but still the drums", () => {
    const full = parseAbc(
      ["X:1", "T:Test", "M:2/4", "L:1/8", "Q:1/4=120", "V:m role=melody", "V:h role=harmony", "V:b role=bass", "K:C",
        "V:m", '"C"c2 e2 | "G7"d2 B2 |]', "V:h", "E4 | F4 |]", "V:b", "C,4 | G,,4 |]"].join("\n"),
    );
    const perf = arrange(meta, full, params());
    expect(perf.tracks.find((t) => t.id === "chords")).toBeUndefined();
    expect(perf.tracks.find((t) => t.id === "drums")).toBeDefined();
    // Either voice alone still gets the chords.
    expect(perf.tracks.length).toBeGreaterThan(0);
    expect(track(arrange(meta, score, params()), "chords")).toBeDefined();
  });

  it("plays the repeats as written, the pickup only once silent", () => {
    const perf = arrange(meta, score, params());
    // pickup, 3 bars, pickup, 3 bars
    expect(perf.bars).toEqual([0, 240, 1200, 2160, 2880, 3120, 4080, 5040]);
    expect(perf.length).toBe(5760);
    // Nothing but the melody under the opening pickup...
    for (const t of perf.tracks.filter((t) => t.id !== "melody")) expect(t.notes[0]).toBeGreaterThanOrEqual(240);
    // ...but the repeated pickup is accompanied: its eighth is the bar's last off-beat.
    expect(track(perf, "chords").notes.filter((_, i) => i % 4 === 0)).toContain(2880);
  });

  it("transposes, changes tempo and length", () => {
    const base = arrange(meta, score, params({ ensemble: "piano" }));
    const up = arrange(meta, score, params({ ensemble: "piano", key: "+2" }));
    expect(pitches(track(up, "melody").notes)).toEqual(pitches(track(base, "melody").notes).map((p) => p + 2));
    expect(up.keys[0]).toEqual([0, 2, "major"]);
    expect(up.chords[0]![1]).toBe("D");
    const lively = arrange(meta, score, params({ tempo: "lively" }));
    expect(lively.duration).toBeCloseTo(base.duration / 1.12, 2);
    const short = arrange(meta, score, params({ length: "short" }));
    const long = arrange(meta, score, params({ length: "long" }));
    expect(short.bars.length).toBe(4);
    expect(long.bars.length).toBe(16);
  });

  it("generates a harmony line under the melody when the score has none", () => {
    const perf = arrange(meta, score, params({ ensemble: "piano" }));
    const mel = track(perf, "melody").notes;
    const harm = track(perf, "harmony").notes;
    expect(harm.length).toBeGreaterThan(0);
    for (let i = 0; i < harm.length; i += 4) {
      const j = mel.findIndex((v, k) => k % 4 === 0 && v === harm[i]);
      expect(j).toBeGreaterThanOrEqual(0);
      const gap = mel[j + 2]! - harm[i + 2]!;
      expect(gap).toBeGreaterThanOrEqual(3);
      expect(gap).toBeLessThanOrEqual(9);
    }
  });

  it("uses only known instruments and keeps each line in its range", () => {
    for (const ensemble of Object.keys(ENSEMBLES)) {
      const perf = arrange(meta, score, params({ ensemble }));
      for (const t of perf.tracks) {
        expect(INSTRUMENTS[t.instrument], t.instrument).toBeDefined();
        if (t.clef === "perc") continue;
        const def = ENSEMBLES[ensemble]!.tracks.find((x) => x.role === t.id)!;
        for (const p of pitches(t.notes)) {
          expect(p).toBeGreaterThanOrEqual(def.range[0]);
          expect(p).toBeLessThanOrEqual(def.range[1]);
        }
      }
    }
  });

  it("swings jazz pieces and not others", () => {
    const swung = arrange({ ...meta, swing: 0.6 }, score, params());
    expect(swung.duration).toBe(arrange(meta, score, params()).duration);
    expect(swung.swing).toBe(0.6);
  });
});

describe("helpers", () => {
  it("fits a line into a range by octaves", () => {
    const notes = [40, 43, 47].map((pitch) => ({ tick: 0, dur: 1, pitch, vel: 1 }));
    expect(fitRange(notes, [55, 80]).map((n) => n.pitch)).toEqual([64, 67, 71]);
    expect(fitRange(notes, [30, 50])).toBe(notes);
    // A note the shift cannot place is folded in by octaves.
    expect(fitRange([...notes, { tick: 0, dur: 1, pitch: 70, vel: 1 }], [36, 50]).map((n) => n.pitch)).toEqual([40, 43, 47, 46]);
  });

  it("voices chords with voice leading", () => {
    const c = voice(parseChord("C")!, null);
    expect(c.map((p) => p % 12).sort()).toEqual([0, 4, 7]);
    const f = voice(parseChord("F")!, c);
    // F after C moves the least: C stays, E->F, G->A.
    expect(f.reduce((s, p, k) => s + Math.abs(p - c[k]!), 0)).toBeLessThanOrEqual(3);
  });
});
