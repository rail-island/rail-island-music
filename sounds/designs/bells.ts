// Tower bells (docs/sounds/sounds.md): a village church bell, the Great Bell of
// the Westminster clock tower (Big Ben) and Emmanuel, the great bourdon of
// Notre-Dame de Paris. A cast bell is a handful of sine partials at fixed ratios
// to its strike note -- the hum an octave below, the prime, the minor-third
// tierce, the quint, the nominal an octave above, and weaker ones higher up --
// each with its own ring: the higher, the sooner it dies, the hum longest. A
// strike starts them all at once with a short clang of noise. These are
// one-shots: the design plays a whole ringing (a toll, an hour) and ends by
// itself. The game plays none of them yet.

import { LEVEL, filter, gain, noiseSource, num, choice, oneShot, voiceOf } from "../nodes.ts";

/** One partial of a bell: ratio to the strike note, level, and seconds to fall 60 dB at `ring` 1. */
export type BellPartial = { ratio: number; level: number; ring: number };

/** A well-tuned church bell's partials (hum, prime, tierce, quint, nominal and up). */
export const CHURCH_PARTIALS: readonly BellPartial[] = [
  { ratio: 0.5, level: 0.5, ring: 9 },
  { ratio: 1, level: 0.7, ring: 6 },
  { ratio: 1.2, level: 0.55, ring: 5 },
  { ratio: 1.5, level: 0.25, ring: 3.5 },
  { ratio: 2, level: 1, ring: 3.2 },
  { ratio: 2.5, level: 0.35, ring: 2 },
  { ratio: 2.67, level: 0.2, ring: 1.8 },
  { ratio: 3.01, level: 0.25, ring: 1.4 },
  { ratio: 4.02, level: 0.12, ring: 0.9 },
];

/**
 * The Westminster Great Bell: an E, heavy and long ringing, its harsh twinned
 * partials a few hertz apart, the way a bell sounds that was cracked and turned
 * rather than recast.
 */
export const GREAT_BELL_PARTIALS: readonly BellPartial[] = [
  { ratio: 0.5, level: 0.6, ring: 14 },
  { ratio: 1, level: 0.7, ring: 9 },
  { ratio: 1.012, level: 0.4, ring: 8 },
  { ratio: 1.19, level: 0.55, ring: 7 },
  { ratio: 1.5, level: 0.2, ring: 5 },
  { ratio: 2, level: 1, ring: 4.5 },
  { ratio: 2.008, level: 0.45, ring: 4.2 },
  { ratio: 2.52, level: 0.3, ring: 2.6 },
  { ratio: 3.03, level: 0.22, ring: 1.8 },
  { ratio: 4.1, level: 0.1, ring: 1.1 },
];

/** Emmanuel of Notre-Dame: a deep F-sharp bourdon with a very long hum. */
export const BOURDON_PARTIALS: readonly BellPartial[] = [
  { ratio: 0.5, level: 0.75, ring: 22 },
  { ratio: 1, level: 0.8, ring: 15 },
  { ratio: 1.003, level: 0.3, ring: 14 },
  { ratio: 1.2, level: 0.5, ring: 11 },
  { ratio: 1.5, level: 0.22, ring: 8 },
  { ratio: 2, level: 1, ring: 7 },
  { ratio: 2.51, level: 0.3, ring: 4 },
  { ratio: 2.68, level: 0.18, ring: 3.5 },
  { ratio: 3.02, level: 0.2, ring: 2.5 },
  { ratio: 4.05, level: 0.08, ring: 1.4 },
];

/** Seconds a bell is still heard after its last strike, at `ring`: its longest partial's ring. */
export function bellTail(partials: readonly BellPartial[], ring: number): number {
  return Math.max(...partials.map((p) => p.ring)) * ring;
}

/** One strike of a bell at `at`: every partial at once, plus the clapper's clang. Returns its sources. */
function strikeBell(
  ctx: BaseAudioContext,
  out: AudioNode,
  at: number,
  pitch: number,
  partials: readonly BellPartial[],
  ring: number,
  loud: number,
): AudioScheduledSourceNode[] {
  const sources: AudioScheduledSourceNode[] = [];
  for (const p of partials) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = pitch * p.ratio;
    const g = gain(ctx);
    osc.connect(g).connect(out);
    const decay = p.ring * ring;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(p.level * loud, at + 0.004);
    g.gain.setTargetAtTime(0, at + 0.004, decay / 6.9);
    osc.start(at);
    osc.stop(at + decay + 0.1);
    sources.push(osc);
  }
  // The clapper: a short band of noise around the nominal.
  const clang = noiseSource(ctx, false);
  const band = filter(ctx, "bandpass", Math.min(8000, pitch * 3), 1.5);
  const cg = gain(ctx);
  clang.connect(band).connect(cg).connect(out);
  cg.gain.setValueAtTime(0, at);
  cg.gain.linearRampToValueAtTime(0.5 * loud, at + 0.002);
  cg.gain.setTargetAtTime(0, at + 0.002, 0.02);
  clang.start(at);
  clang.stop(at + 0.2);
  sources.push(clang);
  return sources;
}

const STRIKES = { name: "strikes", title: "Strikes", kind: "number", min: 1, max: 12, step: 1, default: 3 } as const;
const RING = { name: "ring", title: "Ring", kind: "number", min: 0.3, max: 1.5, step: 0.05, default: 1 } as const;

/** Plays `strikes` strikes of a bell, `interval` apart, then lets it ring out. */
function toll(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  level: number,
  pitch: number,
  partials: readonly BellPartial[],
  strikes: number,
  interval: number,
  ring: number,
  first = 0,
) {
  const out = gain(ctx, level);
  out.connect(dest);
  const sources: AudioScheduledSourceNode[] = [];
  for (let i = 0; i < strikes; i++) sources.push(...strikeBell(ctx, out, t + first + i * interval, pitch, partials, ring, 0.1));
  return { out, sources, end: t + first + (strikes - 1) * interval + bellTail(partials, ring) };
}

export const churchBell = /* @__PURE__ */ oneShot({
  id: "church-bell",
  title: "Church bell",
  category: "bells",
  description: "A village church's bell tolling: a bright, well-tuned bell struck a few times, ringing on between the strikes.",
  params: [
    { name: "pitch", title: "Strike note", kind: "number", min: 200, max: 900, step: 5, default: 440, unit: "Hz" },
    STRIKES,
    { name: "interval", title: "Strike every", kind: "number", min: 0.8, max: 6, step: 0.1, default: 2.2, unit: "s" },
    RING,
    LEVEL,
  ],
  play(ctx, dest, t, v) {
    const { out, sources, end } = toll(ctx, dest, t, num(v, "level"), num(v, "pitch"), CHURCH_PARTIALS, num(v, "strikes"), num(v, "interval"), num(v, "ring"));
    return voiceOf(out, sources, end);
  },
});

/** The Westminster quarter bells, in hertz: G#4, F#4, E4 and B3. */
const QUARTER_BELLS = { gs: 415.3, fs: 369.99, e: 329.63, b: 246.94 } as const;
type Quarter = keyof typeof QUARTER_BELLS;

/**
 * The Westminster Quarters (William Crotch, 1793; public domain): the five
 * changes of four notes the clock rings in turn. Before the hour it plays the
 * four changes from the second on.
 */
export const WESTMINSTER_CHANGES: ReadonlyArray<readonly Quarter[]> = [
  ["gs", "fs", "e", "b"],
  ["e", "gs", "fs", "b"],
  ["e", "fs", "gs", "e"],
  ["gs", "e", "fs", "b"],
  ["b", "fs", "gs", "e"],
];

/** Seconds between two notes of a change, and from one change to the next. */
const QUARTER_NOTE = 0.7;
const CHANGE = 4 * QUARTER_NOTE + 0.9;

/** The quarter chimes before the hour: [seconds from the start, which bell], and when they are done. */
export function hourChime(): { notes: Array<[number, Quarter]>; length: number } {
  const notes: Array<[number, Quarter]> = [];
  WESTMINSTER_CHANGES.slice(1).forEach((change, c) => {
    change.forEach((bell, i) => notes.push([c * CHANGE + i * QUARTER_NOTE, bell]));
  });
  return { notes, length: 4 * CHANGE };
}

export const bigBen = /* @__PURE__ */ oneShot({
  id: "big-ben",
  title: "Big Ben",
  category: "bells",
  description: "The Great Bell of the Westminster clock tower striking the hour in E, deep and a little harsh, optionally after the Westminster Quarters on the four quarter bells.",
  params: [
    { name: "pitch", title: "Strike note", kind: "number", min: 100, max: 260, step: 1, default: 165, unit: "Hz" },
    { ...STRIKES, title: "Hour" },
    {
      name: "chime",
      title: "Quarters first",
      kind: "choice",
      values: [
        { value: "quarters", title: "Westminster Quarters, then the hour" },
        { value: "hour", title: "The hour only" },
      ],
      default: "quarters",
    },
    RING,
    LEVEL,
  ],
  play(ctx, dest, t, v) {
    const ring = num(v, "ring");
    // The quarter bells keep their tuning against the hour bell's E.
    const scale = num(v, "pitch") / 164.81;
    let first = 0;
    const chimes: AudioScheduledSourceNode[] = [];
    const out0 = gain(ctx, num(v, "level"));
    out0.connect(dest);
    if (choice(v, "chime") === "quarters") {
      const { notes, length } = hourChime();
      for (const [at, bell] of notes) chimes.push(...strikeBell(ctx, out0, t + at, QUARTER_BELLS[bell] * scale, CHURCH_PARTIALS, ring * 0.8, 0.06));
      first = length + 2;
    }
    const hour = toll(ctx, dest, t, num(v, "level"), num(v, "pitch"), GREAT_BELL_PARTIALS, num(v, "strikes"), 4.5, ring, first);
    const hourVoice = voiceOf(hour.out, [...hour.sources], hour.end);
    const quarters = voiceOf(out0, chimes, hour.end);
    return {
      endsAt: hour.end,
      stop(at) {
        hourVoice.stop(at);
        quarters.stop(at);
      },
    };
  },
});

export const notreDameBell = /* @__PURE__ */ oneShot({
  id: "notre-dame-bell",
  title: "Notre-Dame bourdon",
  category: "bells",
  description: "Emmanuel, the great bourdon of Notre-Dame de Paris: a very deep F-sharp, swung slowly, its hum ringing on long after each stroke.",
  params: [
    { name: "pitch", title: "Strike note", kind: "number", min: 60, max: 160, step: 0.5, default: 92.5, unit: "Hz" },
    { ...STRIKES, default: 4 },
    { name: "interval", title: "Strike every", kind: "number", min: 1.5, max: 8, step: 0.1, default: 3.4, unit: "s" },
    RING,
    LEVEL,
  ],
  play(ctx, dest, t, v) {
    const { out, sources, end } = toll(ctx, dest, t, num(v, "level"), num(v, "pitch"), BOURDON_PARTIALS, num(v, "strikes"), num(v, "interval"), num(v, "ring"));
    return voiceOf(out, sources, end);
  },
});
