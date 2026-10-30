// Writes a Performance back as ABC notation: the arranged score the site shows
// (docs/music/arrangement.md). Every track becomes a voice; the bars are the
// performance's bars in playing order (repeats written out), so bar k of the
// notation is bar k of the sound. Notes are clipped at the next onset of their
// track, split at bar lines with ties, and spelt in the bar's key.

import type { Performance, Track } from "./performance.ts";
import { type Key, type Mode, keyAccidentals, keyName, spellPitch } from "./theory.ts";

const UNIT = 120; // L:1/16 at 480 ticks per quarter

/** Ticks each written length can take, longest first (dotted values included). */
const LENGTHS = [3840, 2880, 1920, 1440, 960, 720, 480, 360, 240, 180, 120, 90, 60, 30];

interface Segment {
  at: number;
  len: number;
  pitches: number[];
  tieOut: boolean;
}

export interface WriteOptions {
  barsPerLine?: number;
}

export function writeAbc(perf: Performance, options: WriteOptions = {}): string {
  const barsPerLine = options.barsPerLine ?? 4;
  const keyAt = (tick: number): Key => {
    let k = perf.keys[0]!;
    for (const x of perf.keys) if (x[0] <= tick) k = x;
    return { fifths: k[1], mode: k[2] as Mode, tonic: 0 };
  };
  const barEnd = (k: number) => perf.bars[k + 1] ?? perf.length;
  const out: string[] = [];
  const firstKey = keyAt(0);
  const [, num, den] = perf.meters[0]!;
  out.push("X:1");
  out.push(`T:${perf.title}`);
  out.push(`C:${perf.composer}`);
  out.push(`M:${num}/${den}`);
  out.push("L:1/16");
  out.push(`Q:1/4=${Math.round(perf.tempos[0]![1])}`);
  out.push(`%%score ${scoreLayout(perf.tracks)}`);
  for (const group of staffGroups(perf.tracks)) {
    const clef = group[0]!.clef;
    group.forEach((t, k) => {
      const name = k === 0 ? ` name="${staffName(perf.tracks, t)}"` : "";
      out.push(`V:${t.id} clef=${clef}${name}`);
    });
  }
  out.push(`K:${keyName(firstKey)}`);

  const chordTicks = perf.chords.map((c) => c[0]);
  const writers = perf.tracks.map((t, idx) => ({
    track: t,
    bars: segmentTrack(t, perf, idx === 0 ? chordTicks : []),
  }));

  for (let first = 0; first < perf.bars.length; first += barsPerLine) {
    const last = Math.min(first + barsPerLine, perf.bars.length);
    writers.forEach((w, idx) => {
      const perc = w.track.clef === "perc";
      // A drum staff has no key signature.
      let line = `[V:${w.track.id}] ` + (perc && first === 0 ? "[K:C clef=perc] " : "");
      for (let k = first; k < last; k++) {
        const start = perf.bars[k]!;
        line += barPrefix(perf, k, idx === 0, perc);
        line += writeBar(w.bars[k]!, keyAt(start), w.track.clef === "perc", idx === 0 ? chordsIn(perf, start, barEnd(k)) : []);
        line += k === perf.bars.length - 1 ? " |]" : " | ";
      }
      out.push(line.trimEnd());
    });
  }
  return out.join("\n") + "\n";
}

/** Piano parts share a grand staff; melody and harmony of one instrument share a staff. */
function staffGroups(tracks: Track[]): Track[][] {
  const groups: Track[][] = [];
  for (const t of tracks) {
    const g = groups.find((x) => x[0]!.instrument === t.instrument && x[0]!.clef === t.clef && t.clef !== "perc");
    if (g && g.length < 2) g.push(t);
    else groups.push([t]);
  }
  return groups;
}

function scoreLayout(tracks: Track[]): string {
  const groups = staffGroups(tracks);
  const parts = groups.map((g) => (g.length > 1 ? `(${g.map((t) => t.id).join(" ")})` : g[0]!.id));
  const allPiano = tracks.every((t) => t.instrument === "piano");
  return allPiano && parts.length > 1 ? `{${parts.join(" ")}}` : parts.join(" ");
}

function staffName(tracks: Track[], t: Track): string {
  const allPiano = tracks.every((x) => x.instrument === "piano");
  if (allPiano) return t === tracks[0] ? "Piano" : "";
  return t.name;
}

function barPrefix(perf: Performance, k: number, first: boolean, perc: boolean): string {
  const tick = perf.bars[k]!;
  let s = "";
  if (k > 0) {
    const m = perf.meters.find((x) => x[0] === tick);
    if (m) s += `[M:${m[1]}/${m[2]}] `;
    const key = perf.keys.find((x) => x[0] === tick);
    if (key && !perc) s += `[K:${keyName({ fifths: key[1], mode: key[2] as Mode, tonic: 0 })}] `;
    const tempo = perf.tempos.find((x) => x[0] === tick);
    if (tempo && first) s += `[Q:1/4=${Math.round(tempo[1])}] `;
  }
  return s;
}

function chordsIn(perf: Performance, start: number, end: number): { at: number; symbol: string }[] {
  return perf.chords.filter((c) => c[0] >= start && c[0] < end).map((c) => ({ at: c[0] - start, symbol: c[1] }));
}

/** Cut a track into per-bar segments that cover each bar completely (rests fill the gaps). */
function segmentTrack(track: Track, perf: Performance, splitAt: number[]): Segment[][] {
  // Group notes by onset; a group lasts until its shortest note ends or the next onset.
  const onsets = new Map<number, { pitches: number[]; dur: number }>();
  const n = track.notes;
  for (let i = 0; i < n.length; i += 4) {
    const at = quantize(n[i]!);
    const g = onsets.get(at) ?? { pitches: [], dur: Infinity };
    if (!g.pitches.includes(n[i + 2]!)) g.pitches.push(n[i + 2]!);
    g.dur = Math.min(g.dur, n[i + 1]!);
    onsets.set(at, g);
  }
  const ticks = [...onsets.keys()].sort((a, b) => a - b);
  const events: { at: number; end: number; pitches: number[] }[] = [];
  ticks.forEach((t, k) => {
    const g = onsets.get(t)!;
    const next = ticks[k + 1] ?? perf.length;
    const end = Math.min(next, perf.length, t + Math.max(quantize(g.dur), 30));
    events.push({ at: t, end, pitches: g.pitches.sort((a, b) => a - b) });
  });

  const cuts = new Set<number>([...perf.bars, perf.length, ...splitAt]);
  const bars: Segment[][] = perf.bars.map(() => []);
  const barIndex = (tick: number) => {
    let k = 0;
    while (k + 1 < perf.bars.length && perf.bars[k + 1]! <= tick) k++;
    return k;
  };
  let cursor = 0;
  const pushRest = (from: number, to: number) => {
    let t = from;
    while (t < to) {
      const k = barIndex(t);
      const stop = Math.min(to, perf.bars[k + 1] ?? perf.length);
      bars[k]!.push({ at: t, len: stop - t, pitches: [], tieOut: false });
      t = stop;
    }
  };
  const sortedCuts = [...cuts].sort((a, b) => a - b);
  for (const e of events) {
    if (e.at > cursor) pushRest(cursor, e.at);
    // Split the event at bar lines and chord-symbol ticks.
    let t = e.at;
    while (t < e.end) {
      const stop = Math.min(e.end, sortedCuts.find((c) => c > t) ?? e.end);
      bars[barIndex(t)]!.push({ at: t, len: stop - t, pitches: e.pitches, tieOut: stop < e.end });
      t = stop;
    }
    cursor = Math.max(cursor, e.end);
  }
  if (cursor < perf.length) pushRest(cursor, perf.length);
  return bars;
}

/** Notation snaps onsets to a 64th grid unless they belong to a triplet. */
function quantize(t: number): number {
  if (t % 30 === 0 || t % 40 === 0) return t;
  return Math.round(t / 30) * 30;
}

function writeBar(segments: Segment[], key: Key, perc: boolean, chords: { at: number; symbol: string }[]): string {
  const acc = keyAccidentals(key.fifths) as Record<string, number>;
  const state = new Map<string, number>();
  const barStart = segments[0]?.at ?? 0;
  const parts: string[] = [];
  let i = 0;
  while (i < segments.length) {
    const s = segments[i]!;
    const chord = chords.find((c) => c.at === s.at - barStart);
    const prefix = chord ? `"${chord.symbol}"` : "";
    // A run of three equal non-dyadic lengths is a triplet.
    if (!isDyadic(s.len)) {
      const run = segments.slice(i, i + 3);
      if (run.length === 3 && run.every((x) => x.len === s.len) && isDyadic((s.len * 3) / 2)) {
        parts.push("(3" + run.map((x, k) => (k === 0 ? prefix : "") + token(x, (x.len * 3) / 2, x.tieOut)).join(""));
        i += 3;
        continue;
      }
    }
    const pieces = splitLength(isDyadic(s.len) ? s.len : Math.max(30, Math.round(s.len / 30) * 30));
    parts.push(prefix + pieces.map((len, k) => token(s, len, k < pieces.length - 1 || s.tieOut)).join(""));
    i++;
  }
  return parts.join(" ");

  function token(s: Segment, len: number, tie: boolean): string {
    const l = lengthText(len);
    if (s.pitches.length === 0) return "z" + l;
    const notes = s.pitches.map((p) => (perc ? drumNote(p) : pitchText(p)));
    const body = notes.length === 1 ? notes[0]! : `[${[...new Set(notes)].join("")}]`;
    return body + l + (tie && !perc ? "-" : "");
  }

  function pitchText(midi: number): string {
    const sp = spellPitch(midi, key);
    const id = sp.letter + sp.octave;
    const current = state.get(id) ?? acc[sp.letter]!;
    let accText = "";
    if (sp.accidental !== current) {
      accText = sp.accidental === 0 ? "=" : sp.accidental > 0 ? "^".repeat(sp.accidental) : "_".repeat(-sp.accidental);
      state.set(id, sp.accidental);
    }
    let letter: string = sp.letter;
    let marks = "";
    if (sp.octave >= 5) {
      letter = letter.toLowerCase();
      marks = "'".repeat(sp.octave - 5);
    } else {
      marks = ",".repeat(4 - sp.octave);
    }
    return accText + letter + marks;
  }
}

const DRUM_NOTES: Record<number, string> = { 36: "F", 38: "c", 42: "g", 49: "a", 51: "f" };

function drumNote(midi: number): string {
  return DRUM_NOTES[midi] ?? "e";
}

function isDyadic(len: number): boolean {
  return len % 30 === 0;
}

function splitLength(len: number): number[] {
  const out: number[] = [];
  let left = len;
  while (left > 0) {
    const l = LENGTHS.find((x) => x <= left) ?? 30;
    out.push(l);
    left -= l;
  }
  return out;
}

function lengthText(ticks: number): string {
  const r = ticks / UNIT;
  if (r === 1) return "";
  if (Number.isInteger(r)) return String(r);
  // Fractions of a sixteenth: 1/2, 3/4, 1/4 ...
  let den = 1;
  while (!Number.isInteger(r * den)) den *= 2;
  const numr = r * den;
  return (numr === 1 ? "" : String(numr)) + "/" + den;
}
