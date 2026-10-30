import { describe, expect, it } from "vitest";
import { parseAbc } from "../lib/abcParse.ts";
import { writeAbc } from "../lib/abcWrite.ts";
import { arrange } from "../lib/arrange.ts";
import { loadPieces } from "../generator/scores.ts";

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
});
