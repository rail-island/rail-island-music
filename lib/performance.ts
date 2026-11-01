// The note data the generator exports and the synth plays (docs/music/note-data.md).
// Times are ticks (PPQ per quarter note) on a straight grid; the tempo map and
// the swing ratio turn them into seconds, the same way for the site and the
// game. This module has no imports beyond theory constants, so the synth
// bundle that ships to the game stays small.

export const FORMAT = 1;

export interface Track {
  /** Stable within an arrangement: "melody", "harmony", "bass", "chords", "drums". */
  id: string;
  /** Shown on the score: "Trumpet", "Piano". */
  name: string;
  /** A synth instrument id (synth/instruments.ts). */
  instrument: string;
  clef: "treble" | "bass" | "perc";
  /** Linear gain 0..1 applied on top of each note's velocity. */
  gain: number;
  /** Stereo position -1 (left) .. 1 (right). */
  pan: number;
  /**
   * Notes as a flat list of quadruples [tick, duration ticks, MIDI pitch,
   * velocity 1..127], sorted by tick then pitch. Drums use General MIDI
   * percussion numbers as the pitch.
   */
  notes: number[];
  /**
   * Rolled chords (harp chords), for the notation only: [written tick, ticks
   * from the lowest note's onset to the highest's]. The notes already sound
   * rolled; absent when the track has none.
   */
  rolls?: [number, number][];
}

export interface Performance {
  format: number;
  piece: string;
  title: string;
  composer: string;
  params: Record<string, string>;
  ppq: number;
  /**
   * Share of a beat the first of two eighths takes: 0.5 is straight, 2/3 a
   * triplet swing. Applies to quarter-note beats only.
   */
  swing: number;
  /** [tick, quarter notes per minute], first at tick 0. */
  tempos: [number, number][];
  /** [tick, numerator, denominator] at every meter change, first at tick 0. */
  meters: [number, number, number][];
  /** [tick, fifths, mode] at every key change, first at tick 0. */
  keys: [number, number, string][];
  /** Start tick of every bar. */
  bars: number[];
  /** [tick, symbol] for every chord symbol, transposed. */
  chords: [number, string][];
  /** End of the last bar, in ticks. */
  length: number;
  /** Length in seconds, rounded to milliseconds. */
  duration: number;
  tracks: Track[];
}

/** Apply swing inside one quarter-note beat. */
function swingTick(tick: number, ppq: number, swing: number): number {
  if (swing === 0.5) return tick;
  const beat = Math.floor(tick / ppq) * ppq;
  const p = tick - beat;
  const half = ppq / 2;
  const warped = p <= half ? (p * swing) / 0.5 : ppq * swing + ((p - half) * (1 - swing)) / 0.5;
  return beat + warped;
}

/** Seconds from the start of the performance to `tick`, with tempo changes and swing. */
export function tickToSeconds(perf: Pick<Performance, "ppq" | "swing" | "tempos">, tick: number): number {
  const t = swingTick(tick, perf.ppq, perf.swing);
  let seconds = 0;
  for (let k = 0; k < perf.tempos.length; k++) {
    const [start, qpm] = perf.tempos[k]!;
    const next = perf.tempos[k + 1]?.[0] ?? Infinity;
    if (t <= start) break;
    const span = Math.min(t, next) - start;
    seconds += (span / perf.ppq) * (60 / qpm);
  }
  return seconds;
}

/** The tick at `seconds` (inverse of tickToSeconds, ignoring swing; for seeking and progress). */
export function secondsToTick(perf: Pick<Performance, "ppq" | "tempos">, seconds: number): number {
  let elapsed = 0;
  for (let k = 0; k < perf.tempos.length; k++) {
    const [start, qpm] = perf.tempos[k]!;
    const next = perf.tempos[k + 1]?.[0] ?? Infinity;
    const spanSeconds = ((next - start) / perf.ppq) * (60 / qpm);
    if (seconds <= elapsed + spanSeconds) return start + ((seconds - elapsed) * qpm * perf.ppq) / 60;
    elapsed += spanSeconds;
  }
  return 0;
}

/** Index of the bar sounding at `tick`. */
export function barAt(perf: Pick<Performance, "bars">, tick: number): number {
  let lo = 0;
  let hi = perf.bars.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (perf.bars[mid]! <= tick) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
