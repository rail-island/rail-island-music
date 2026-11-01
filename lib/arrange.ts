// The arranger: a parsed score plus the four parameters becomes a Performance
// (docs/music/arrangement.md). It unrolls the form, transposes, generates the
// accompaniment the piece's groove asks for from the chord symbols, voices
// every role on the ensemble's instruments and fits each line into its
// instrument's range. Everything is deterministic: the same score and
// parameters give the same notes, in the browser and in the generator.

import type { Score, ScoreBar, ScoreNote } from "./abcParse.ts";
import { ENSEMBLES, type Ensemble, type Role } from "./ensembles.ts";
import { type Params, type PieceMeta, TEMPO_FACTOR } from "./params.ts";
import { FORMAT, type Performance, type Track, tickToSeconds } from "./performance.ts";
import { type Chord, type Key, PPQ, chordPcs, nearestPitch, transposeChord, transposeKey } from "./theory.ts";

export interface PlacedBar {
  bar: ScoreBar;
  part: string;
  /** First bar played of a part (after a part change), for crash cymbals and accents. */
  partStart: boolean;
  /** Pickup: a short bar that opens a part, played without accompaniment. */
  pickup: boolean;
}

/** The bars in playing order for a `length` value. */
export function unroll(score: Score, length: string): PlacedBar[] {
  let order = score.partOrder;
  if (length === "short") order = order.filter((p, k) => order.indexOf(p) === k);
  const passes = length === "long" ? 2 : 1;
  const out: PlacedBar[] = [];
  for (let pass = 0; pass < passes; pass++) {
    for (const name of order) {
      const part = score.parts[name]!;
      const indices = length === "short" ? playOnce(part.bars) : playRepeats(part.bars);
      indices.forEach((idx, k) => {
        const bar = part.bars[idx]!;
        const [n, d] = bar.meter;
        const full = (n / d) * 4 * PPQ;
        out.push({ bar, part: name, partStart: k === 0, pickup: idx === 0 && bar.length < full });
      });
    }
  }
  return out;
}

/** Bar indices with repeats and first/second endings played as written. */
function playRepeats(bars: ScoreBar[]): number[] {
  const out: number[] = [];
  let repeatFrom = 0;
  let pass = 1;
  let i = 0;
  let guard = 0;
  while (i < bars.length) {
    if (++guard > 10000) throw new Error("repeat structure does not terminate");
    const bar = bars[i]!;
    if (bar.startRepeat && pass === 1) repeatFrom = i;
    if (bar.ending && !bar.ending.includes(pass)) {
      i++;
      continue;
    }
    out.push(i);
    if (bar.endRepeat) {
      if (pass === 1) {
        pass = 2;
        i = repeatFrom;
        continue;
      }
      pass = 1;
      repeatFrom = i + 1;
    }
    i++;
  }
  return out;
}

/** Every bar once, taking the last ending of each repeat. */
function playOnce(bars: ScoreBar[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;
    if (bar.ending) {
      // Keep only the highest-numbered ending of this group.
      let j = i;
      let max = 0;
      while (j < bars.length && bars[j]!.ending) max = Math.max(max, ...bars[j++]!.ending!);
      if (!bar.ending.includes(max)) continue;
    }
    out.push(i);
  }
  return out;
}

interface Timed {
  tick: number;
  dur: number;
  pitch: number;
  vel: number;
}

interface BarInfo {
  start: number;
  length: number;
  meter: [number, number];
  key: Key;
  tempo: number;
  placed: PlacedBar;
  /** Ticks the bar's beat grid starts before the bar: a pickup's missing beats. */
  phase: number;
  /** No accompaniment: the opening pickup of the performance. */
  silent: boolean;
  /** A crash cymbal on this bar's downbeat: the first full bar of a part. */
  crash: boolean;
}

/** Beats of a meter: how many and how long (compound meters count dotted beats). */
export function beatsOf(meter: [number, number]): { count: number; len: number } {
  const [n, d] = meter;
  const unit = (4 * PPQ) / d;
  if (d === 8 && n % 3 === 0 && n > 3) return { count: n / 3, len: unit * 3 };
  return { count: n, len: unit };
}

export function arrange(piece: PieceMeta, score: Score, params: Params): Performance {
  const ensemble = ENSEMBLES[params.ensemble];
  if (!ensemble) throw new Error(`Unknown ensemble ${params.ensemble}`);
  const shift = Number(params.key);
  const tempoFactor = TEMPO_FACTOR[params.tempo] ?? 1;
  const placed = unroll(score, params.length);

  // Lay the bars out on the timeline.
  const bars: BarInfo[] = [];
  let tick = 0;
  for (const p of placed) {
    const [n, d] = p.bar.meter;
    const full = (n / d) * 4 * PPQ;
    const prev = bars[bars.length - 1];
    bars.push({
      start: tick,
      length: p.bar.length,
      meter: p.bar.meter,
      key: transposeKey(p.bar.key, shift),
      tempo: Math.round(p.bar.tempo * tempoFactor * 100) / 100,
      placed: p,
      phase: p.pickup ? full - p.bar.length : 0,
      silent: p.pickup && bars.length === 0,
      crash: (p.partStart && !p.pickup) || (!!prev && prev.placed.pickup && prev.placed.partStart),
    });
    tick += p.bar.length;
  }
  const total = tick;

  // Chord symbols, carried forward from bar to bar.
  const chords: { tick: number; chord: Chord }[] = [];
  for (const b of bars) {
    for (const c of b.placed.bar.chords) chords.push({ tick: b.start + c.at, chord: transposeChord(c.chord, shift, b.key) });
  }
  const chordAt = (t: number): Chord | null => {
    let found: Chord | null = null;
    for (const c of chords) {
      if (c.tick <= t) found = c.chord;
      else break;
    }
    return found;
  };
  const chordChangesAt = (t: number) => chords.some((c) => c.tick === t);

  // The written voices, by role.
  const written: Record<"melody" | "harmony" | "bass", Timed[]> = { melody: [], harmony: [], bass: [] };
  for (const b of bars) {
    for (const v of score.voices) {
      for (const n of b.placed.bar.voices[v.id] ?? []) written[v.role].push(toTimed(n, b, shift));
    }
  }

  const lines: Record<Role, Timed[]> = {
    melody: written.melody,
    harmony: written.harmony.length > 0 ? written.harmony : harmonize(written.melody, chordAt, bars),
    bass: written.bass.length > 0 ? written.bass : walkBass(bars, piece.groove, chordAt, chordChangesAt),
    // A score that writes its harmony and its bass is complete: no chords are added.
    chords: written.harmony.length > 0 && written.bass.length > 0 ? [] : comp(bars, piece.groove, chordAt, ensemble.chordStyle),
    drums: ensemble.drums === "none" ? [] : drums(bars, piece.groove, ensemble.drums),
  };

  const tracks: Track[] = [];
  for (const t of ensemble.tracks) {
    let notes = lines[t.role];
    if (notes.length === 0) continue;
    if (t.role !== "drums") notes = fitRange(notes, t.range);
    const flat: number[] = [];
    const sorted = [...notes].sort((a, b) => a.tick - b.tick || a.pitch - b.pitch);
    for (const n of sorted) flat.push(n.tick, Math.max(1, Math.round(n.dur)), n.pitch, clampVel(n.vel * t.velocity));
    tracks.push({
      id: t.role,
      name: t.name,
      instrument: t.instrument,
      clef: t.role === "drums" ? "perc" : median(notes) < 57 ? "bass" : "treble",
      gain: t.gain,
      pan: t.pan,
      notes: flat,
    });
  }

  const tempos: [number, number][] = [];
  const meters: [number, number, number][] = [];
  const keys: [number, number, string][] = [];
  for (const b of bars) {
    if (tempos.length === 0 || tempos[tempos.length - 1]![1] !== b.tempo) tempos.push([b.start, b.tempo]);
    const lastM = meters[meters.length - 1];
    if (!lastM || lastM[1] !== b.meter[0] || lastM[2] !== b.meter[1]) meters.push([b.start, b.meter[0], b.meter[1]]);
    const lastK = keys[keys.length - 1];
    if (!lastK || lastK[1] !== b.key.fifths || lastK[2] !== b.key.mode) keys.push([b.start, b.key.fifths, b.key.mode]);
  }

  const perf: Performance = {
    format: FORMAT,
    piece: piece.id,
    title: piece.title,
    composer: piece.composer,
    params: { ...params },
    ppq: PPQ,
    swing: piece.swing,
    tempos,
    meters,
    keys,
    bars: bars.map((b) => b.start),
    chords: chords.map((c) => [c.tick, c.chord.symbol]),
    length: total,
    duration: 0,
    tracks,
  };
  perf.duration = Math.round(tickToSeconds(perf, total) * 1000) / 1000;
  return perf;
}

function toTimed(n: ScoreNote, b: BarInfo, shift: number): Timed {
  const dur = n.staccato ? Math.max(PPQ / 8, n.dur / 2) : n.dur;
  return { tick: b.start + n.start, dur, pitch: n.pitch + shift, vel: n.accent ? 112 : n.start === 0 ? 100 : 92 };
}

function clampVel(v: number): number {
  return Math.max(1, Math.min(127, Math.round(v)));
}

function median(notes: Timed[]): number {
  const p = notes.map((n) => n.pitch).sort((a, b) => a - b);
  return p[Math.floor(p.length / 2)] ?? 60;
}

/**
 * Shift a line by whole octaves so the most notes fall inside `range` (ties
 * prefer the smaller shift), then fold the few notes still outside it back in
 * by octaves, so every note stays where the instrument has samples.
 */
export function fitRange(notes: Timed[], range: [number, number]): Timed[] {
  let best = 0;
  let bestInside = -1;
  for (const k of [0, -1, 1, -2, 2, -3, 3]) {
    const inside = notes.filter((n) => n.pitch + 12 * k >= range[0] && n.pitch + 12 * k <= range[1]).length;
    if (inside > bestInside) {
      best = k;
      bestInside = inside;
    }
  }
  if (best === 0 && bestInside === notes.length) return notes;
  return notes.map((n) => {
    let pitch = n.pitch + 12 * best;
    while (pitch < range[0]) pitch += 12;
    while (pitch > range[1]) pitch -= 12;
    return { ...n, pitch };
  });
}

/** A second line under the melody: the nearest chord tone a third to a sixth below each longer note. */
function harmonize(melody: Timed[], chordAt: (t: number) => Chord | null, bars: BarInfo[]): Timed[] {
  const out: Timed[] = [];
  const beatLenAt = (t: number) => {
    const b = bars.find((x) => x.start <= t && t < x.start + x.length) ?? bars[0]!;
    return beatsOf(b.meter).len;
  };
  for (const n of melody) {
    const beat = beatLenAt(n.tick);
    if (n.dur < beat / 2) continue;
    const chord = chordAt(n.tick);
    if (!chord) continue;
    const pcs = chordPcs(chord);
    if (!pcs.includes(n.pitch % 12) && n.dur < beat) continue;
    let pick: number | null = null;
    for (let p = n.pitch - 3; p >= n.pitch - 9; p--) {
      if (pcs.includes(((p % 12) + 12) % 12)) {
        pick = p;
        break;
      }
    }
    if (pick !== null) out.push({ tick: n.tick, dur: n.dur, pitch: pick, vel: 72 });
  }
  return out;
}

const BASS_LO = 31;
const BASS_HI = 50;

function bassPitch(pc: number, prev: number): number {
  let p = nearestPitch(pc, prev);
  while (p < BASS_LO) p += 12;
  while (p > BASS_HI) p -= 12;
  return p;
}

/** The bass line a groove generates from the chord symbols. */
function walkBass(
  bars: BarInfo[],
  groove: string,
  chordAt: (t: number) => Chord | null,
  changesAt: (t: number) => boolean,
): Timed[] {
  const out: Timed[] = [];
  let prev = 40;
  for (const b of bars) {
    if (b.silent) continue;
    const { count, len } = beatsOf(b.meter);
    const style = grooveFor(groove, count);
    for (let k = 0; k < count; k++) {
      const t = b.start - b.phase + k * len;
      if (t < b.start) continue;
      if (t >= b.start + b.length) break;
      const chord = chordAt(t);
      if (!chord) continue;
      const vel = k === 0 ? 92 : 80;
      const changed = changesAt(t) || k === 0;
      if (style === "swing") {
        const next = chordAt(t + len) ?? chord;
        let pc: number;
        if (k === 0 || changesAt(t)) pc = chord.bass;
        else if (k === count - 1) {
          // Approach the next bar's root from a semitone below or above.
          const target = bassPitch(next.bass, prev);
          const from = prev <= target ? target - 1 : target + 1;
          out.push({ tick: t, dur: len, pitch: from, vel });
          prev = from;
          continue;
        } else pc = (chord.root + (k % 2 === 1 ? chord.tones[1]! : chord.tones[2]!)) % 12;
        prev = bassPitch(pc, prev);
        out.push({ tick: t, dur: len, pitch: prev, vel });
        continue;
      }
      if (style === "two-beat" && k % 2 === 1) continue;
      if (style === "waltz" && k > 0) continue;
      const beatNo = style === "two-beat" ? k / 2 : k;
      const pc = changed || beatNo % 2 === 0 ? chord.bass : (chord.root + 7) % 12;
      prev = bassPitch(pc, prev);
      const dur = style === "two-beat" ? len * 1.5 : style === "waltz" ? len : len / 2;
      out.push({ tick: t, dur, pitch: prev, vel });
    }
  }
  return out;
}

/** The pattern a groove uses in a bar with `count` beats. */
function grooveFor(groove: string, count: number): string {
  if (groove === "waltz" && count === 3) return "waltz";
  if ((groove === "two-beat" || groove === "swing") && count === 4) return groove;
  if (count === 3) return "waltz";
  return "oompah";
}

const COMP_LO = 55;
const COMP_HI = 74;

/** Close-position voicing of `chord` nearest to `prev` (voice leading), inside the comp range. */
export function voice(chord: Chord, prev: number[] | null): number[] {
  const pcs = chordPcs(chord).slice(0, 4);
  const options: number[][] = [];
  for (let r = 0; r < pcs.length; r++) {
    const order = [...pcs.slice(r), ...pcs.slice(0, r)];
    for (let base = COMP_LO; base < COMP_LO + 12; base++) {
      if (base % 12 !== order[0]) continue;
      const v = [base];
      for (const pc of order.slice(1)) v.push(v[v.length - 1]! + ((pc - v[v.length - 1]! % 12 + 12) % 12 || 12));
      if (v[v.length - 1]! <= COMP_HI) options.push(v);
    }
  }
  if (options.length === 0) return pcs.map((pc) => nearestPitch(pc, 62)).sort((a, b) => a - b);
  const centre = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const cost = (v: number[]) =>
    prev && prev.length === v.length ? v.reduce((s, x, k) => s + Math.abs(x - prev[k]!), 0) : Math.abs(centre(v) - 64);
  options.sort((a, b) => cost(a) - cost(b) || a[0]! - b[0]!);
  return options[0]!;
}

/** The chords the accompaniment plays: off-beat stabs, 2-and-4 comping or a chiptune arpeggio. */
function comp(bars: BarInfo[], groove: string, chordAt: (t: number) => Chord | null, style: "block" | "arpeggio"): Timed[] {
  const out: Timed[] = [];
  let prev: number[] | null = null;
  for (const b of bars) {
    if (b.silent) continue;
    const { count, len } = beatsOf(b.meter);
    const end = b.start + b.length;
    if (style === "arpeggio") {
      const step = PPQ / 4;
      for (let t = b.start, k = 0; t < end; t += step, k++) {
        const chord = chordAt(t);
        if (!chord) continue;
        const v = (prev = voice(chord, prev));
        const seq = [...v, ...v.slice(1, -1).reverse()];
        out.push({ tick: t, dur: step, pitch: seq[k % seq.length]! + 12, vel: 56 });
      }
      continue;
    }
    const pattern = grooveFor(groove, count);
    for (let k = 0; k < count; k++) {
      const beat = b.start - b.phase + k * len;
      let at: number;
      let dur: number;
      if (pattern === "oompah") {
        at = beat + (len === 720 ? 480 : len / 2);
        dur = len === 720 ? 240 : len / 4;
      } else if (pattern === "waltz") {
        if (k === 0) continue;
        at = beat;
        dur = len / 2;
      } else {
        if (k % 2 === 0) continue;
        at = beat;
        dur = len / 2;
      }
      if (at >= end) break;
      if (at < b.start) continue;
      const chord = chordAt(at);
      if (!chord) continue;
      const v = (prev = voice(chord, prev));
      for (const p of v) out.push({ tick: at, dur, pitch: p, vel: 62 });
    }
  }
  return out;
}

// General MIDI percussion numbers.
const KICK = 36;
const SNARE = 38;
const HAT = 42;
const CRASH = 49;
const RIDE = 51;

/** The drum pattern of a groove; `march` uses only bass drum, snare and cymbal. */
function drums(bars: BarInfo[], groove: string, kit: Ensemble["drums"]): Timed[] {
  const out: Timed[] = [];
  const hit = (tick: number, pitch: number, vel: number, len: number) => out.push({ tick, dur: len / 2, pitch, vel });
  for (const b of bars) {
    if (b.silent) continue;
    const { count, len } = beatsOf(b.meter);
    const end = b.start + b.length;
    const pattern = grooveFor(groove, count);
    if (b.crash) hit(b.start, CRASH, 84, len);
    for (let k = 0; k < count; k++) {
      const t = b.start - b.phase + k * len;
      if (t < b.start) continue;
      if (t >= end) break;
      const off = t + (len === 720 ? 480 : len / 2);
      if (pattern === "swing" && kit !== "march") {
        hit(t, RIDE, k % 2 === 0 ? 70 : 58, len);
        if (k % 2 === 1) {
          hit(t, HAT, 64, len);
          if (off < end) hit(off, RIDE, 50, len);
        }
        hit(t, KICK, 40, len);
      } else if (pattern === "two-beat" || pattern === "swing") {
        if (k % 2 === 0) hit(t, KICK, 88, len);
        else hit(t, SNARE, 74, len);
        if (kit !== "march") hit(t, HAT, 52, len);
      } else if (pattern === "waltz") {
        if (k === 0) hit(t, KICK, 86, len);
        else hit(t, kit === "march" ? SNARE : HAT, 56, len);
      } else {
        hit(t, KICK, k % 2 === 0 ? 90 : 72, len);
        if (off < end) hit(off, SNARE, kit === "march" ? 66 : 52, len);
      }
    }
  }
  return out;
}
