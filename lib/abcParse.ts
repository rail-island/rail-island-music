// A parser for the subset of ABC notation the score sources use
// (docs/music/scores.md). It reads one tune into a Score: header fields, voices
// with roles, parts in order, bars with repeats and endings, notes with ties,
// tuplets and broken rhythm, and chord symbols. It is strict: anything it does
// not understand is an error naming the line, so a typo in a transcription
// fails the build instead of playing a wrong note.

import { type Chord, type Key, LETTER_PC, type Letter, PPQ, keyAccidentals, parseChord, parseKey } from "./theory.ts";

export type VoiceRole = "melody" | "harmony" | "bass";

export interface VoiceDef {
  id: string;
  role: VoiceRole;
  name: string;
}

/** One sounding pitch. `start` counts ticks from the start of its bar; a tied note may last past the bar. */
export interface ScoreNote {
  start: number;
  dur: number;
  pitch: number;
  staccato: boolean;
  accent: boolean;
}

export interface ScoreBar {
  /** Written length in ticks (short for a pickup or the bar that completes it). */
  length: number;
  /** Notes per voice id; a voice silent in this bar has an empty list. */
  voices: Record<string, ScoreNote[]>;
  /** Chord symbols, by tick from the bar start. */
  chords: { at: number; chord: Chord }[];
  key: Key;
  meter: [number, number];
  /** Quarter notes per minute. */
  tempo: number;
  startRepeat: boolean;
  endRepeat: boolean;
  /** The endings (1, 2...) this bar belongs to, or null outside an ending. */
  ending: number[] | null;
}

export interface ScorePart {
  name: string;
  bars: ScoreBar[];
}

export interface Score {
  title: string;
  composer: string;
  meter: [number, number];
  key: Key;
  tempo: number;
  voices: VoiceDef[];
  parts: Record<string, ScorePart>;
  /** The part names in playing order (the P: header, or the parts as written). */
  partOrder: string[];
}

class AbcError extends Error {}

function fail(line: number, message: string): never {
  throw new AbcError(`ABC line ${line}: ${message}`);
}

function parseMeter(text: string, line: number): [number, number] {
  const t = text.trim();
  if (t === "C") return [4, 4];
  if (t === "C|") return [2, 2];
  const m = /^(\d+)\/(\d+)$/.exec(t);
  if (!m) fail(line, `bad meter "${text}"`);
  return [Number(m[1]), Number(m[2])];
}

function parseFraction(text: string, line: number): number {
  const m = /^(\d+)\/(\d+)$/.exec(text.trim());
  if (!m) fail(line, `bad length "${text}"`);
  return Number(m[1]) / Number(m[2]);
}

/** Q: "1/4=120" or "3/8=60" -> quarter notes per minute. */
function parseTempo(text: string, line: number): number {
  const m = /^(?:"[^"]*"\s*)?(?:(\d+)\/(\d+)\s*=\s*)?(\d+)\s*(?:"[^"]*")?$/.exec(text.trim());
  if (!m) fail(line, `bad tempo "${text}"`);
  const beat = m[1] ? Number(m[1]) / Number(m[2]) : 0.25;
  return Number(m[3]) * beat * 4;
}

/** P: "A2BA" -> ["A", "A", "B", "A"]. */
export function expandPartOrder(text: string, line = 0): string[] {
  const out: string[] = [];
  const t = text.replace(/[\s.]/g, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (!/[A-Z]/.test(ch)) fail(line, `bad part order "${text}"`);
    let j = i + 1;
    while (j < t.length && /\d/.test(t[j]!)) j++;
    const count = j > i + 1 ? Number(t.slice(i + 1, j)) : 1;
    for (let k = 0; k < count; k++) out.push(ch);
    i = j - 1;
  }
  return out;
}

interface RawNote {
  start: number; // ticks from the part start
  dur: number;
  pitch: number;
  staccato: boolean;
  accent: boolean;
  tie: boolean;
}

interface RawBar {
  start: number;
  length: number;
  key: Key;
  meter: [number, number];
  tempo: number;
  startRepeat: boolean;
  endRepeat: boolean;
  ending: number[] | null;
}

/** What one voice wrote in one part, in written order. */
interface VoicePart {
  notes: RawNote[];
  chords: { at: number; chord: Chord }[];
  bars: RawBar[];
}

/** The running state of one voice across the whole tune. */
interface VoiceState {
  key: Key;
  meter: [number, number];
  unit: number; // ticks of the L: unit
  tempo: number;
}

export function parseAbc(text: string): Score {
  const lines = text.split(/\r?\n/);
  let title = "";
  let composer = "";
  let meter: [number, number] | null = null;
  let unit: number | null = null;
  let tempo = 120;
  let key: Key | null = null;
  let headerOrder: string[] | null = null;
  const voices: VoiceDef[] = [];
  let i = 0;

  // Header: up to and including K:.
  for (; i < lines.length; i++) {
    const raw = stripComment(lines[i]!);
    if (!raw.trim()) continue;
    const f = /^([A-Za-z]):(.*)$/.exec(raw);
    if (!f) fail(i + 1, "music before the K: field");
    const [, field, value] = f as unknown as [string, string, string];
    switch (field) {
      case "X":
        break;
      case "T":
        if (!title) title = value.trim();
        break;
      case "C":
        composer = value.trim();
        break;
      case "M":
        meter = parseMeter(value, i + 1);
        break;
      case "L":
        unit = parseFraction(value, i + 1);
        break;
      case "Q":
        tempo = parseTempo(value, i + 1);
        break;
      case "P":
        headerOrder = expandPartOrder(value, i + 1);
        break;
      case "V":
        voices.push(parseVoiceDef(value, i + 1));
        break;
      case "K":
        key = parseKey(value);
        break;
      default:
        // Other information fields (S:, N:, Z:, R: ...) carry no music.
        break;
    }
    if (field === "K") {
      i++;
      break;
    }
  }
  if (!meter) fail(i, "missing M:");
  if (!unit) fail(i, "missing L:");
  if (!key) fail(i, "missing K:");
  if (voices.length === 0) voices.push({ id: "1", role: "melody", name: "Melody" });
  if (!voices.some((v) => v.role === "melody")) fail(i, "no voice has role=melody");

  const unitTicks = unit * 4 * PPQ;
  const states = new Map<string, VoiceState>();
  for (const v of voices) states.set(v.id, { key, meter, unit: unitTicks, tempo });

  // Body: part -> voice -> what was written.
  const written = new Map<string, Map<string, VoicePart>>();
  const partsSeen: string[] = [];
  let part = "";
  let voice = voices[0]!.id;
  const cursor = new Map<string, Cursor>();

  const current = (): Cursor => {
    const k = part + "\u0000" + voice;
    let c = cursor.get(k);
    if (!c) {
      let byVoice = written.get(part);
      if (!byVoice) {
        byVoice = new Map();
        written.set(part, byVoice);
        partsSeen.push(part);
      }
      const vp: VoicePart = { notes: [], chords: [], bars: [] };
      byVoice.set(voice, vp);
      c = new Cursor(vp, states.get(voice)!);
      cursor.set(k, c);
    }
    return c;
  };

  for (; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = stripComment(lines[i]!);
    if (!raw.trim()) continue;
    const f = /^([A-Za-z]):(.*)$/.exec(raw);
    if (f) {
      const [, field, value] = f as unknown as [string, string, string];
      if (field === "P") {
        part = value.trim();
        if (!/^[A-Z]$/.test(part)) fail(lineNo, `part names are single capital letters, got "${part}"`);
      } else if (field === "V") {
        voice = value.trim().split(/\s+/)[0]!;
        if (!states.has(voice)) fail(lineNo, `voice "${voice}" is not declared in the header`);
      } else {
        applyField(field, value, states.get(voice)!, current(), lineNo);
      }
      continue;
    }
    if (part === "" && voices.length > 1 && headerOrder) fail(lineNo, "music outside a part");
    parseMusicLine(raw, current(), states, lineNo, (v) => {
      voice = v;
      return current();
    });
  }

  for (const c of cursor.values()) c.finish();

  // Assemble the parts.
  const parts: Record<string, ScorePart> = {};
  for (const name of partsSeen) {
    parts[name] = assemblePart(name, written.get(name)!, voices);
  }
  const partOrder = headerOrder ?? partsSeen;
  for (const p of partOrder) if (!parts[p]) throw new AbcError(`part ${p} is in P: but never written`);
  return { title, composer, meter, key, tempo, voices, parts, partOrder };
}

function parseVoiceDef(value: string, line: number): VoiceDef {
  const words = value.trim().split(/\s+/);
  const id = words[0]!;
  let role: VoiceRole = "melody";
  let name = id;
  const nameMatch = /name="([^"]*)"/.exec(value);
  if (nameMatch) name = nameMatch[1]!;
  const roleMatch = /role=(\w+)/.exec(value);
  if (roleMatch) {
    if (!["melody", "harmony", "bass"].includes(roleMatch[1]!)) fail(line, `bad role "${roleMatch[1]}"`);
    role = roleMatch[1] as VoiceRole;
  }
  return { id, role, name };
}

function stripComment(line: string): string {
  if (line.startsWith("%%")) return "";
  const at = line.search(/(?<!\\)%/);
  return (at >= 0 ? line.slice(0, at) : line).replace(/\s+$/, "");
}

function applyField(field: string, value: string, state: VoiceState, c: Cursor, line: number): void {
  switch (field) {
    case "K":
      state.key = parseKey(value);
      c.resetAccidentals();
      break;
    case "M":
      state.meter = parseMeter(value, line);
      break;
    case "L":
      state.unit = parseFraction(value, line) * 4 * PPQ;
      break;
    case "Q":
      state.tempo = parseTempo(value, line);
      break;
    default:
      fail(line, `field ${field}: is not allowed in the body`);
  }
}

/** Writes notes and bars for one voice in one part. */
class Cursor {
  pos = 0;
  barStart = 0;
  barAccidentals = new Map<string, number>();
  pendingChord: Chord | null = null;
  pendingStaccato = false;
  pendingAccent = false;
  pendingStartRepeat = false;
  currentEnding: number[] | null = null;
  tuplet: { factor: number; left: number } | null = null;
  brokenNext = 1;
  barOpen = false;
  barSnapshot: Omit<RawBar, "length" | "endRepeat"> | null = null;

  constructor(
    readonly vp: VoicePart,
    readonly state: VoiceState,
  ) {}

  resetAccidentals(): void {
    this.barAccidentals.clear();
  }

  openBar(): void {
    if (this.barOpen) return;
    this.barOpen = true;
    this.barStart = this.pos;
    this.barSnapshot = {
      start: this.pos,
      key: this.state.key,
      meter: this.state.meter,
      tempo: this.state.tempo,
      startRepeat: this.pendingStartRepeat,
      ending: this.currentEnding,
    };
    this.pendingStartRepeat = false;
  }

  closeBar(endRepeat: boolean): void {
    if (!this.barOpen) {
      // A bar line with nothing before it (|: at the start of a line) only sets flags.
      if (endRepeat && this.vp.bars.length > 0) this.vp.bars[this.vp.bars.length - 1]!.endRepeat = true;
      return;
    }
    this.vp.bars.push({ ...this.barSnapshot!, length: this.pos - this.barStart, endRepeat });
    this.barOpen = false;
    this.barAccidentals.clear();
  }

  finish(): void {
    if (this.barOpen && this.pos > this.barStart) this.closeBar(false);
  }
}

function parseMusicLine(
  text: string,
  c0: Cursor,
  states: Map<string, VoiceState>,
  line: number,
  switchVoice: (id: string) => Cursor,
): void {
  let c = c0;
  let i = 0;
  const peek = (k = 0) => text[i + k] ?? "";
  const tieTarget: { notes: RawNote[] | null } = { notes: null };

  const readLength = (): number => {
    let num = "";
    while (/\d/.test(peek())) num += text[i++];
    let n = num ? Number(num) : 1;
    let d = 1;
    while (peek() === "/") {
      i++;
      let den = "";
      while (/\d/.test(peek())) den += text[i++];
      d *= den ? Number(den) : 2;
    }
    return n / d;
  };

  const readPitch = (): { pitch: number; key: string } | null => {
    let acc: number | null = null;
    if (peek() === "^") {
      i++;
      acc = 1;
      if (peek() === "^") {
        i++;
        acc = 2;
      }
    } else if (peek() === "_") {
      i++;
      acc = -1;
      if (peek() === "_") {
        i++;
        acc = -2;
      }
    } else if (peek() === "=") {
      i++;
      acc = 0;
    }
    const ch = peek();
    if (!/[A-Ga-g]/.test(ch)) {
      if (acc !== null) fail(line, `accidental without a note at column ${i + 1}`);
      return null;
    }
    i++;
    const letter = ch.toUpperCase() as Letter;
    let octave = ch === letter ? 4 : 5;
    while (peek() === "'" || peek() === ",") octave += text[i++] === "'" ? 1 : -1;
    const k = letter + octave;
    if (acc !== null) c.barAccidentals.set(k, acc);
    const a = c.barAccidentals.get(k) ?? keyAccidentals(c.state.key.fifths)[letter];
    return { pitch: 12 * (octave + 1) + LETTER_PC[letter] + a, key: k };
  };

  const ticks = (len: number): number => {
    let t = len * c.state.unit;
    if (c.tuplet) t *= c.tuplet.factor;
    t *= c.brokenNext;
    c.brokenNext = 1;
    if (Math.abs(t - Math.round(t)) > 1e-6) fail(line, `duration ${t} ticks is not whole`);
    return Math.round(t);
  };

  const place = (pitches: number[], tiesPer: boolean[], len: number, rest: boolean): void => {
    c.openBar();
    let dur = ticks(len);
    // Broken rhythm: a > or < right after this note.
    let skip = 0;
    while (text[i + skip] === " ") skip++;
    if (text[i + skip] === ">" || text[i + skip] === "<") {
      const sign = text[i + skip];
      let count = 0;
      while (text[i + skip + count] === sign) count++;
      const small = Math.pow(0.5, count);
      const factor = sign === ">" ? 2 - small : small;
      dur = Math.round(dur * factor);
      c.brokenNext = sign === ">" ? small : 2 - small;
      i += skip + count;
    }
    if (c.pendingChord) {
      c.vp.chords.push({ at: c.pos, chord: c.pendingChord });
      c.pendingChord = null;
    }
    const notes: RawNote[] = [];
    if (!rest) {
      pitches.forEach((p, k) => {
        const n: RawNote = { start: c.pos, dur, pitch: p, staccato: c.pendingStaccato, accent: c.pendingAccent, tie: tiesPer[k]! };
        c.vp.notes.push(n);
        notes.push(n);
      });
    }
    tieTarget.notes = notes;
    c.pendingStaccato = false;
    c.pendingAccent = false;
    c.pos += dur;
    if (c.tuplet && --c.tuplet.left === 0) c.tuplet = null;
  };

  while (i < text.length) {
    const ch = peek();
    if (ch === " " || ch === "\t" || ch === "`" || ch === "\\" || ch === "y") {
      i++;
      continue;
    }
    if (ch === '"') {
      const end = text.indexOf('"', i + 1);
      if (end < 0) fail(line, "unclosed chord symbol");
      const body = text.slice(i + 1, end);
      i = end + 1;
      if (/^[\^_<>@]/.test(body)) continue; // a text annotation
      const chord = parseChord(body);
      if (!chord) fail(line, `bad chord symbol "${body}"`);
      c.pendingChord = chord;
      continue;
    }
    if (ch === "!" || ch === "+") {
      const end = text.indexOf(ch, i + 1);
      if (end < 0) fail(line, "unclosed decoration");
      const deco = text.slice(i + 1, end);
      if (deco === "staccato") c.pendingStaccato = true;
      if (deco === "accent" || deco === ">") c.pendingAccent = true;
      i = end + 1;
      continue;
    }
    if (ch === ".") {
      c.pendingStaccato = true;
      i++;
      continue;
    }
    if (ch === "~") {
      i++;
      continue;
    }
    if (ch === "{") {
      const end = text.indexOf("}", i);
      if (end < 0) fail(line, "unclosed grace notes");
      i = end + 1;
      continue;
    }
    if (ch === "(") {
      if (/\d/.test(peek(1))) {
        i++;
        const m = /^(\d+)(?::(\d*))?(?::(\d*))?/.exec(text.slice(i))!;
        i += m[0].length;
        const p = Number(m[1]);
        const defaultQ: Record<number, number> = { 2: 3, 3: 2, 4: 3, 6: 2 };
        const q = m[2] ? Number(m[2]) : defaultQ[p] ?? 2;
        const r = m[3] ? Number(m[3]) : p;
        c.tuplet = { factor: q / p, left: r };
      } else i++;
      continue;
    }
    if (ch === ")") {
      i++;
      continue;
    }
    if (ch === "-") {
      if (tieTarget.notes) for (const n of tieTarget.notes) n.tie = true;
      i++;
      continue;
    }
    if (ch === "[" && /[A-Za-z]/.test(peek(1)) && peek(2) === ":") {
      const end = text.indexOf("]", i);
      if (end < 0) fail(line, "unclosed inline field");
      const field = text[i + 1]!;
      const value = text.slice(i + 3, end);
      i = end + 1;
      if (field === "V") {
        c = switchVoice(value.trim().split(/\s+/)[0]!);
        if (!states.has(value.trim().split(/\s+/)[0]!)) fail(line, `undeclared voice ${value}`);
      } else applyField(field, value, c.state, c, line);
      continue;
    }
    if (ch === "[" && /\d/.test(peek(1))) {
      i++;
      c.currentEnding = readEndingNumbers();
      continue;
    }
    if (ch === "|" || ch === ":" || (ch === "[" && peek(1) === "|")) {
      let run = "";
      while (/[|:\[\]]/.test(peek()) && !(peek() === "[" && /[\dA-Za-z]/.test(peek(1)))) run += text[i++];
      if (peek() === "]") run += text[i++];
      const pipe = run.indexOf("|");
      const before = pipe >= 0 ? run.slice(0, pipe) : run;
      const after = pipe >= 0 ? run.slice(run.lastIndexOf("|") + 1) : "";
      const endRepeat = before.includes(":") || (pipe < 0 && run.startsWith("::"));
      const startRepeat = after.includes(":") || (pipe < 0 && run.endsWith("::"));
      const sectionEnd = run.includes("||") || run.includes("|]") || run.includes("[|");
      const hadEnding = c.barOpen && c.barSnapshot?.ending;
      c.closeBar(endRepeat);
      if (sectionEnd || startRepeat || (endRepeat && hadEnding)) c.currentEnding = null;
      if (startRepeat) c.pendingStartRepeat = true;
      if (/\d/.test(peek())) c.currentEnding = readEndingNumbers();
      tieTarget.notes = null;
      continue;
    }
    if (ch === "z" || ch === "x") {
      i++;
      place([], [], readLength(), true);
      continue;
    }
    if (ch === "Z") {
      i++;
      let num = "";
      while (/\d/.test(peek())) num += text[i++];
      const count = num ? Number(num) : 1;
      for (let k = 0; k < count; k++) {
        c.openBar();
        const [n, d] = c.state.meter;
        c.pos += (n / d) * 4 * PPQ;
        if (k < count - 1) c.closeBar(false);
      }
      continue;
    }
    if (ch === "[") {
      i++;
      const pitches: number[] = [];
      const ties: boolean[] = [];
      let innerLen: number | null = null;
      while (peek() !== "]") {
        if (i >= text.length) fail(line, "unclosed chord");
        if (peek() === " ") {
          i++;
          continue;
        }
        const p = readPitch();
        if (!p) fail(line, `bad note in chord at column ${i + 1}`);
        const len = readLength();
        if (innerLen === null) innerLen = len;
        pitches.push(p.pitch);
        let tie = false;
        if (peek() === "-") {
          tie = true;
          i++;
        }
        ties.push(tie);
      }
      i++;
      const outer = readLength();
      place(pitches, ties, (innerLen ?? 1) * outer, false);
      continue;
    }
    const p = readPitch();
    if (p) {
      const len = readLength();
      place([p.pitch], [false], len, false);
      continue;
    }
    fail(line, `unexpected "${ch}" at column ${i + 1}`);
  }

  function readEndingNumbers(): number[] {
    const m = /^\d+(?:[,-]\d+)*/.exec(text.slice(i))!;
    i += m[0].length;
    const out: number[] = [];
    for (const piece of m[0].split(",")) {
      const [a, b] = piece.split("-").map(Number) as [number, number | undefined];
      for (let k = a; k <= (b ?? a); k++) out.push(k);
    }
    return out;
  }
}

function assemblePart(name: string, byVoice: Map<string, VoicePart>, voices: VoiceDef[]): ScorePart {
  // Ties: join a tied note with the next note of the same pitch that starts where it ends.
  for (const vp of byVoice.values()) {
    const notes = vp.notes;
    for (let k = 0; k < notes.length; k++) {
      const n = notes[k]!;
      while (n.tie) {
        const end = n.start + n.dur;
        const nextIdx = notes.findIndex((m, j) => j > k && m.start === end && m.pitch === n.pitch);
        if (nextIdx < 0) {
          n.tie = false;
          break;
        }
        const next = notes[nextIdx]!;
        n.dur += next.dur;
        n.tie = next.tie;
        notes.splice(nextIdx, 1);
      }
    }
  }

  const structural = voices.find((v) => byVoice.has(v.id))!;
  const sBars = byVoice.get(structural.id)!.bars;
  const bars: ScoreBar[] = sBars.map((b) => ({
    length: b.length,
    voices: {},
    chords: [],
    key: b.key,
    meter: b.meter,
    tempo: b.tempo,
    startRepeat: b.startRepeat,
    endRepeat: b.endRepeat,
    ending: b.ending,
  }));

  for (const v of voices) {
    const vp = byVoice.get(v.id);
    for (const bar of bars) bar.voices[v.id] = [];
    if (!vp) continue;
    if (vp.bars.length !== bars.length) {
      throw new AbcError(`part ${name || "(none)"}: voice ${v.id} has ${vp.bars.length} bars, voice ${structural.id} has ${bars.length}`);
    }
    vp.bars.forEach((b, k) => {
      const bar = bars[k]!;
      if (b.length !== bar.length) {
        throw new AbcError(`part ${name || "(none)"} bar ${k + 1}: voice ${v.id} is ${b.length} ticks, voice ${structural.id} is ${bar.length}`);
      }
      if (b.startRepeat !== bar.startRepeat || b.endRepeat !== bar.endRepeat || String(b.ending) !== String(bar.ending)) {
        throw new AbcError(`part ${name || "(none)"} bar ${k + 1}: voice ${v.id} has different repeat signs`);
      }
    });
    const barIndexAt = (tick: number): number => {
      let idx = 0;
      for (let k = 0; k < vp.bars.length; k++) if (vp.bars[k]!.start <= tick) idx = k;
      return idx;
    };
    for (const n of vp.notes) {
      const k = barIndexAt(n.start);
      const b = vp.bars[k]!;
      bars[k]!.voices[v.id]!.push({ start: n.start - b.start, dur: n.dur, pitch: n.pitch, staccato: n.staccato, accent: n.accent });
    }
    for (const ch of vp.chords) {
      const k = barIndexAt(ch.at);
      const at = ch.at - vp.bars[k]!.start;
      if (!bars[k]!.chords.some((x) => x.at === at)) bars[k]!.chords.push({ at, chord: ch.chord });
    }
  }
  for (const bar of bars) bar.chords.sort((a, b) => a.at - b.at);
  return { name, bars };
}
