import { describe, expect, it } from "vitest";
import { parseAbc } from "../lib/abcParse.ts";
import { writeAbc } from "../lib/abcWrite.ts";
import { arrange } from "../lib/arrange.ts";
import { jingleAsPiece } from "../lib/jingles.ts";
import { loadPieces } from "../generator/scores.ts";
import { loadJingles } from "../generator/jingles.ts";

const pieces = loadPieces();

describe("writeAbc", () => {
  // Writing an arrangement as ABC and reading it back gives the same bars and
  // the same note onsets and pitches in every pitched voice.
  for (const p of pieces) {
    for (const ensemble of ["piano", "jazz-band", "chiptune"]) {
      it(`round-trips ${p.meta.id} for ${ensemble}`, () => {
        const perf = arrange(p.meta, p.score, { ...p.meta.defaults, ensemble, length: "short", key: "+1" });
        const back = parseAbc(writeAbc(perf));
        const bars = back.parts[""]!.bars;
        expect(bars.length).toBe(perf.bars.length);
        bars.forEach((b, k) => expect(b.length).toBe((perf.bars[k + 1] ?? perf.length) - perf.bars[k]!));
        for (const t of perf.tracks) {
          if (t.clef === "perc") continue;
          const want = new Set<string>();
          for (let i = 0; i < t.notes.length; i += 4) want.add(`${t.notes[i]}:${t.notes[i + 2]}`);
          const got = new Set<string>();
          bars.forEach((b, k) => {
            for (const n of b.voices[t.id] ?? []) got.add(`${perf.bars[k]! + n.start}:${n.pitch}`);
          });
          expect([...got].sort()).toEqual([...want].sort());
        }
      });
    }
  }

  // A rolled chord sounds note after note but is written as one chord with
  // !arpeggio!, and reads back to the same sounding onsets.
  for (const j of loadJingles()) {
    it(`round-trips ${j.meta.id}, its harp chords rolled`, () => {
      const { piece, params } = jingleAsPiece(j.meta, j.meta.defaults);
      const perf = arrange(piece, j.score, params);
      const abc = writeAbc(perf);
      const back = parseAbc(abc).parts[""]!.bars;
      for (const t of perf.tracks) {
        const want = new Set<string>();
        for (let i = 0; i < t.notes.length; i += 4) want.add(`${t.notes[i]}:${t.notes[i + 2]}`);
        const got = new Set<string>();
        back.forEach((b, k) => {
          for (const n of b.voices[t.id] ?? []) got.add(`${perf.bars[k]! + n.start + (n.roll ?? 0)}:${n.pitch}`);
        });
        expect([...got].sort(), t.id).toEqual([...want].sort());
      }
      if (j.meta.id === "jingle-1") expect(abc.match(/!arpeggio!/g)?.length).toBe(3);
    });
  }
});
