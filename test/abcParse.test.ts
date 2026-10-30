import { describe, expect, it } from "vitest";
import { type Score, expandPartOrder, parseAbc } from "../lib/abcParse.ts";
import { unroll } from "../lib/arrange.ts";

const tune = (body: string, header = "M:4/4\nL:1/8\nK:C") => parseAbc(`X:1\nT:Test\n${header}\n${body}\n`);
const melody = (s: Score, part = "") => s.parts[part]!.bars.map((b) => b.voices["1"]!.map((n) => [n.start, n.dur, n.pitch]));

describe("parseAbc", () => {
  it("reads pitches, octaves, accidentals and lengths", () => {
    const s = tune("C D2 ^F/ _B,/ c' z3 |");
    expect(melody(s)[0]).toEqual([
      [0, 240, 60],
      [240, 480, 62],
      [720, 120, 66],
      [840, 120, 58],
      [960, 240, 84],
    ]);
    expect(s.parts[""]!.bars[0]!.length).toBe(1920);
  });

  it("keeps an accidental to the end of its bar and applies the key", () => {
    const s = tune("=F F f F | F", "M:2/4\nL:1/8\nK:G");
    expect(melody(s)[0]!.map((n) => n[2])).toEqual([65, 65, 78, 65]);
    expect(melody(s)[1]!.map((n) => n[2])).toEqual([66]);
  });

  it("joins ties, also across bar lines, and reads chords", () => {
    const s = tune("[CEG]4- [CEG]4 | c8- | c8 |");
    const bars = melody(s);
    expect(bars[0]).toEqual([
      [0, 1920, 60],
      [0, 1920, 64],
      [0, 1920, 67],
    ]);
    expect(bars[1]).toEqual([[0, 3840, 72]]);
    expect(bars[2]).toEqual([]);
  });

  it("reads triplets and broken rhythm", () => {
    const s = tune("(3CDE C>D C<D z2 |");
    expect(melody(s)[0]!.map((n) => n[1])).toEqual([160, 160, 160, 360, 120, 120, 360]);
  });

  it("reads chord symbols and ignores annotations", () => {
    const s = tune('"C"C2 "^loud"E2 "G7"G4 |');
    expect(s.parts[""]!.bars[0]!.chords.map((c) => [c.at, c.chord.symbol])).toEqual([
      [0, "C"],
      [960, "G7"],
    ]);
  });

  it("reads repeats and endings", () => {
    const s = tune("|: C8 | D8 |[1 E8 :|[2 F8 || G8 |]");
    const bars = s.parts[""]!.bars;
    expect(bars.map((b) => [b.startRepeat, b.endRepeat, b.ending])).toEqual([
      [true, false, null],
      [false, false, null],
      [false, true, [1]],
      [false, false, [2]],
      [false, false, null],
    ]);
    const played = (len: string) => unroll(s, len).map((p) => p.bar.voices["1"]![0]!.pitch);
    expect(played("full")).toEqual([60, 62, 64, 60, 62, 65, 67]);
    expect(played("short")).toEqual([60, 62, 65, 67]);
    expect(played("long")).toHaveLength(14);
  });

  it("reads voices and parts", () => {
    const s = parseAbc(
      [
        "X:1",
        "T:Two",
        "M:2/4",
        "L:1/8",
        "P:ABA",
        'V:m role=melody name="Tune"',
        "V:b role=bass",
        "K:F",
        "P:A",
        "V:m",
        "c4 | f4 |",
        "V:b",
        "F,4 | C,4 |",
        "P:B",
        "V:m",
        "B4 |",
      ].join("\n"),
    );
    expect(s.partOrder).toEqual(["A", "B", "A"]);
    expect(s.voices.map((v) => v.role)).toEqual(["melody", "bass"]);
    expect(s.parts.A!.bars[0]!.voices.b![0]!.pitch).toBe(53);
    expect(s.parts.B!.bars[0]!.voices.b).toEqual([]);
    expect(s.parts.B!.bars[0]!.voices.m![0]!.pitch).toBe(70);
  });

  it("fails loudly on what it does not understand", () => {
    expect(() => tune("C D Q |")).toThrow(/unexpected "Q"/);
    expect(() => tune('"Xyz"C |')).toThrow(/bad chord symbol/);
    expect(() => parseAbc("X:1\nT:x\nL:1/8\nK:C\nC|")).toThrow(/missing M:/);
    expect(() => parseAbc("X:1\nT:x\nM:2/4\nL:1/8\nV:a\nV:b role=bass\nK:C\nV:a\nC4 | D4 |\nV:b\nC,4 |")).toThrow(/voice b has 1 bars/);
  });

  it("expands the part order", () => {
    expect(expandPartOrder("A2B.C")).toEqual(["A", "A", "B", "C"]);
  });
});
