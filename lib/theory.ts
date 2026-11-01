// Pitch, key and chord helpers shared by the parser, the arranger and the ABC
// writer. Pitches are MIDI numbers (60 = middle C); pitch classes are 0..11
// with C = 0. A key is described by its position on the circle of fifths
// (`fifths`: -7 = seven flats .. +7 = seven sharps) and its mode.

/** Ticks per quarter note in every score and performance. */
export const PPQ = 480;

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
export type Letter = (typeof LETTERS)[number];

/** Pitch class of each natural letter. */
export const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** The order sharps (and, reversed, flats) enter a key signature. */
const SHARP_ORDER: Letter[] = ["F", "C", "G", "D", "A", "E", "B"];

export type Mode = "major" | "minor" | "dorian" | "phrygian" | "lydian" | "mixolydian" | "locrian";

/** How many fifths a mode's signature sits below its major key on the same tonic. */
const MODE_OFFSET: Record<Mode, number> = {
  major: 0,
  lydian: 1,
  mixolydian: -1,
  dorian: -2,
  minor: -3,
  phrygian: -4,
  locrian: -5,
};

/** Fifths of each major tonic spelling. */
const MAJOR_FIFTHS: Record<string, number> = {
  Cb: -7, Gb: -6, Db: -5, Ab: -4, Eb: -3, Bb: -2, F: -1, C: 0,
  G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7,
  // Enharmonic tonics only reachable through a mode (e.g. G# minor).
  "G#": 8, "D#": 9, "A#": 10, Fb: -8,
};

export interface Key {
  /** Signature: negative = flats, positive = sharps. */
  fifths: number;
  mode: Mode;
  /** Pitch class of the tonic. */
  tonic: number;
}

/** The signature's accidental on each letter: -1 flat, 0 natural, +1 sharp. */
export function keyAccidentals(fifths: number): Record<Letter, number> {
  const acc: Record<Letter, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (fifths > 0) for (let i = 0; i < Math.min(fifths, 7); i++) acc[SHARP_ORDER[i]!] = 1;
  if (fifths < 0) for (let i = 0; i < Math.min(-fifths, 7); i++) acc[SHARP_ORDER[6 - i]!] = -1;
  return acc;
}

/** Parse a tonic spelling such as "F#" or "Bb" into its pitch class. */
export function tonicPc(name: string): number {
  const letter = name[0]!.toUpperCase() as Letter;
  let pc = LETTER_PC[letter];
  if (pc === undefined) throw new Error(`Bad tonic "${name}"`);
  for (const ch of name.slice(1)) pc += ch === "#" ? 1 : ch === "b" ? -1 : 0;
  return ((pc % 12) + 12) % 12;
}

// Longer names first: "mix" must not be read as "m" (minor).
const MODE_NAMES: [string, Mode][] = [
  ["maj", "major"], ["ion", "major"], ["min", "minor"], ["aeo", "minor"], ["dor", "dorian"],
  ["phr", "phrygian"], ["lyd", "lydian"], ["mix", "mixolydian"], ["loc", "locrian"], ["m", "minor"],
];

/** Parse an ABC K: value ("C", "Am", "Bb", "F#m", "D mix"); anything after the key (clef=...) is ignored. */
export function parseKey(text: string): Key {
  const t = text.trim().split(/\s+(?=\w+=)/)[0]!.replace(/\s+/g, "");
  const m = /^([A-G])([#b]?)(.*)$/.exec(t);
  if (!m) throw new Error(`Bad key "${text}"`);
  const tonicName = m[1]! + m[2]!;
  const rest = m[3]!.toLowerCase();
  let mode: Mode = "major";
  if (rest) {
    const found = MODE_NAMES.find(([prefix]) => rest.startsWith(prefix));
    if (!found) throw new Error(`Bad mode in key "${text}"`);
    mode = found[1];
  }
  const major = MAJOR_FIFTHS[tonicName];
  if (major === undefined) throw new Error(`Bad tonic in key "${text}"`);
  return { fifths: major + MODE_OFFSET[mode], mode, tonic: tonicPc(tonicName) };
}

/**
 * The key a transposition by `semitones` lands in, spelled with the fewest
 * accidentals (A minor up one semitone is B-flat minor, not A-sharp minor).
 */
export function transposeKey(key: Key, semitones: number): Key {
  const tonic = (((key.tonic + semitones) % 12) + 12) % 12;
  const offset = MODE_OFFSET[key.mode];
  let best: Key | null = null;
  for (const [name, major] of Object.entries(MAJOR_FIFTHS)) {
    const fifths = major + offset;
    if (tonicPc(name) !== tonic || Math.abs(fifths) > 7) continue;
    if (!best || Math.abs(fifths) < Math.abs(best.fifths) || (Math.abs(fifths) === Math.abs(best.fifths) && fifths < best.fifths)) {
      best = { fifths, mode: key.mode, tonic };
    }
  }
  if (!best) throw new Error("No spelling for transposed key");
  return best;
}

/** The key's name for the ABC K: field ("Bbm", "F#", "Dmix"). */
export function keyName(key: Key): string {
  if (Math.abs(key.fifths) > 7) throw new Error(`No name for key ${key.fifths}`);
  // The signature is the relative major's; the mode's tonic is its degree of that scale.
  const degree: Record<Mode, number> = { major: 0, dorian: 1, phrygian: 2, lydian: 3, mixolydian: 4, minor: 5, locrian: 6 };
  const scale = scaleSpelling(key.fifths);
  const tonicName = scale[degree[key.mode]]!;
  const suffix: Record<Mode, string> = { major: "", minor: "m", dorian: "dor", phrygian: "phr", lydian: "lyd", mixolydian: "mix", locrian: "loc" };
  return tonicName + suffix[key.mode];
}

/** The seven note names of the major scale with the given signature, from its tonic. */
function scaleSpelling(fifths: number): string[] {
  const acc = keyAccidentals(fifths);
  const tonicLetterIndex = (((fifths * 4) % 7) + 7) % 7; // C=0, G=4, D=1, ...
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const letter = LETTERS[(tonicLetterIndex + i) % 7]!;
    out.push(letter + (acc[letter] > 0 ? "#" : acc[letter] < 0 ? "b" : ""));
  }
  return out;
}

export interface Spelling {
  letter: Letter;
  /** -2..+2 */
  accidental: number;
  /** Octave of the letter, scientific (C4 = middle C). */
  octave: number;
}

/**
 * Spell a MIDI pitch in a key: notes of the signature take its letters; a note
 * the signature alters, played plain, takes a natural sign; other pitch classes
 * are spelt as the raised note below in sharp and neutral keys (and as the
 * raised seventh in minor), as the lowered note above in flat keys.
 */
export function spellPitch(midi: number, key: Key): Spelling {
  const pc = ((midi % 12) + 12) % 12;
  const acc = keyAccidentals(key.fifths);
  const candidates: Spelling[] = [];
  for (const letter of LETTERS) {
    const natural = LETTER_PC[letter];
    for (let a = -2; a <= 2; a++) {
      if ((((natural + a) % 12) + 12) % 12 === pc) {
        const octave = Math.floor((midi - natural - a) / 12) - 1;
        candidates.push({ letter, accidental: a, octave });
      }
    }
  }
  const diatonic = candidates.find((c) => acc[c.letter] === c.accidental);
  if (diatonic) return diatonic;
  // A note the signature alters, played plain: written with a natural sign on
  // its own letter (C natural in D major, B natural in F major), never as the
  // neighbouring letter raised or lowered (B#, Cb).
  const cancelled = candidates.find((c) => c.accidental === 0 && acc[c.letter] !== 0);
  if (cancelled) return cancelled;
  const leadingTone = (key.tonic + 11) % 12;
  const preferSharp = key.fifths >= 0 || (key.mode === "minor" && pc === leadingTone);
  const pick = (dir: number) =>
    candidates.find((c) => c.accidental === acc[c.letter] + dir && Math.abs(c.accidental) <= 1);
  return pick(preferSharp ? 1 : -1) ?? pick(preferSharp ? -1 : 1) ?? candidates.find((c) => c.accidental === 0) ?? candidates[0]!;
}

export interface Chord {
  /** The symbol as written ("Am", "G7", "C/E"). */
  symbol: string;
  root: number;
  /** Semitones above the root, ascending, starting with 0. */
  tones: number[];
  /** Pitch class of the bass note (the root unless a slash chord). */
  bass: number;
}

const QUALITIES: [string, number[]][] = [
  ["maj7", [0, 4, 7, 11]],
  ["m7b5", [0, 3, 6, 10]],
  ["dim7", [0, 3, 6, 9]],
  ["o7", [0, 3, 6, 9]],
  ["dim", [0, 3, 6]],
  ["o", [0, 3, 6]],
  ["aug", [0, 4, 8]],
  ["+", [0, 4, 8]],
  ["sus4", [0, 5, 7]],
  ["m6", [0, 3, 7, 9]],
  ["m7", [0, 3, 7, 10]],
  ["m9", [0, 3, 7, 10]],
  ["m", [0, 3, 7]],
  ["6", [0, 4, 7, 9]],
  ["7", [0, 4, 7, 10]],
  ["9", [0, 4, 7, 10]],
  ["", [0, 4, 7]],
];

/** Parse a chord symbol; returns null for text that is not a chord (annotations). */
export function parseChord(symbol: string): Chord | null {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(symbol.trim());
  if (!m) return null;
  const quality = QUALITIES.find(([q]) => q === m[2]);
  if (!quality) return null;
  const root = tonicPc(m[1]!);
  return { symbol: symbol.trim(), root, tones: quality[1], bass: m[3] ? tonicPc(m[3]) : root };
}

/** The chord transposed by `semitones`, its symbol respelt for `key`. */
export function transposeChord(chord: Chord, semitones: number, key: Key): Chord {
  const root = (chord.root + semitones + 120) % 12;
  const bass = (chord.bass + semitones + 120) % 12;
  const name = (pc: number) => {
    const s = spellPitch(60 + pc, key);
    return s.letter + (s.accidental > 0 ? "#".repeat(s.accidental) : "b".repeat(-s.accidental));
  };
  const m = /^[A-G][#b]?([^/]*)/.exec(chord.symbol)!;
  const symbol = name(root) + m[1] + (bass !== root ? "/" + name(bass) : "");
  return { symbol, root, tones: chord.tones, bass };
}

/** Pitch classes of a chord. */
export function chordPcs(chord: Chord): number[] {
  return chord.tones.map((t) => (chord.root + t) % 12);
}

/** The pitch with class `pc` nearest to `target` (ties go down). */
export function nearestPitch(pc: number, target: number): number {
  const base = target - ((((target - pc) % 12) + 12) % 12);
  return target - base <= base + 12 - target ? base : base + 12;
}
