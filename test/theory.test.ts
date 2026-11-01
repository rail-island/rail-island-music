import { describe, expect, it } from "vitest";
import { keyName, parseChord, parseKey, spellPitch, transposeChord, transposeKey } from "../lib/theory.ts";

describe("keys", () => {
  it("reads signatures and modes", () => {
    expect(parseKey("C")).toMatchObject({ fifths: 0, mode: "major", tonic: 0 });
    expect(parseKey("Am")).toMatchObject({ fifths: 0, mode: "minor", tonic: 9 });
    expect(parseKey("Bm")).toMatchObject({ fifths: 2, mode: "minor" });
    expect(parseKey("Ab")).toMatchObject({ fifths: -4 });
    expect(parseKey("D mix")).toMatchObject({ fifths: 1, mode: "mixolydian" });
    expect(parseKey("C clef=perc")).toMatchObject({ fifths: 0 });
    expect(() => parseKey("H")).toThrow();
  });

  it("names keys", () => {
    for (const k of ["C", "Am", "Bm", "Ab", "Db", "F#m", "Bb", "Ebm"]) expect(keyName(parseKey(k))).toBe(k);
  });

  it("transposes to the spelling with fewer accidentals", () => {
    expect(keyName(transposeKey(parseKey("Am"), 1))).toBe("Bbm");
    expect(keyName(transposeKey(parseKey("C"), 1))).toBe("Db");
    expect(keyName(transposeKey(parseKey("C"), -1))).toBe("B");
    expect(keyName(transposeKey(parseKey("F"), 3))).toBe("Ab");
  });
});

describe("spelling", () => {
  it("uses the key's letters and raises the leading tone in minor", () => {
    expect(spellPitch(68, parseKey("Am"))).toMatchObject({ letter: "G", accidental: 1, octave: 4 });
    expect(spellPitch(70, parseKey("F"))).toMatchObject({ letter: "B", accidental: -1 });
    expect(spellPitch(66, parseKey("C"))).toMatchObject({ letter: "F", accidental: 1 });
    expect(spellPitch(63, parseKey("Bb"))).toMatchObject({ letter: "E", accidental: -1 });
    expect(spellPitch(60, parseKey("C"))).toMatchObject({ letter: "C", accidental: 0, octave: 4 });
  });

  it("writes a note the signature alters, played plain, as a natural -- not as the next letter raised", () => {
    // Regression: C natural in D major came out as B#, and F natural as E#.
    expect(spellPitch(60, parseKey("D"))).toMatchObject({ letter: "C", accidental: 0, octave: 4 });
    expect(spellPitch(65, parseKey("D"))).toMatchObject({ letter: "F", accidental: 0 });
    expect(spellPitch(71, parseKey("F"))).toMatchObject({ letter: "B", accidental: 0 });
    // and the leading tone of a minor key is still raised
    expect(spellPitch(61, parseKey("Dm"))).toMatchObject({ letter: "C", accidental: 1 });
    expect(transposeChord(parseChord("D7/C")!, 0, parseKey("D")).symbol).toBe("D7/C");
  });
});

describe("chords", () => {
  it("parses symbols", () => {
    expect(parseChord("Am")).toMatchObject({ root: 9, tones: [0, 3, 7] });
    expect(parseChord("G7")).toMatchObject({ root: 7, tones: [0, 4, 7, 10] });
    expect(parseChord("C/E")).toMatchObject({ root: 0, bass: 4 });
    expect(parseChord("F#dim7")).toMatchObject({ root: 6, tones: [0, 3, 6, 9] });
    expect(parseChord("Bbm/Db")).toMatchObject({ root: 10, bass: 1 });
    expect(parseChord("hello")).toBeNull();
  });

  it("transposes and respells", () => {
    expect(transposeChord(parseChord("C7/E")!, 1, parseKey("Db")).symbol).toBe("Db7/F");
    expect(transposeChord(parseChord("E7")!, -2, parseKey("G")).symbol).toBe("D7");
  });
});
