// The rewards: what the player hears when something is given to them
// (docs/sounds/sounds.md, "The rewards"). Not placed in the world: the game plays
// them at the listener, like the editor's knocks. Modelled without a reference
// recording: nothing in them is measured.
//
//   * token-coins  - gold coins clinking as tokens are earned: one bright, ringing
//                    clink per coin, falling onto the ones before
//   * gift-fanfare - a gift has arrived: a short brass fanfare in C major, a
//                    triplet pickup into a held chord, with a cymbal's shimmer
//   * gift-take    - a gift is taken into the collection: a paper rustle as it is
//                    unwrapped, then a glittering arpeggio rising into a chord
//   * shop-buy     - an item bought with tokens: the register's clack, the coins
//                    dropped into the till and its bell's "ching"
//
// Every tone is scheduled at an explicit time from `t`, and the coins' small
// differences come from a seeded sequence, so a render is the same every time.

import { LEVEL, filter, gain, noiseSource, num, oneShot, seeded, strike, voiceOf } from "../nodes.ts";
import type { SoundParam, SoundValues, Voice } from "../types.ts";

/**
 * The rewards' trim under `level`: they play at the listener, unattenuated, over
 * whatever the island plays, so they sit a little under a horn's blast.
 */
export const REWARD_TRIM = 0.45;

/**
 * The partials of a gold coin's clink, as [ratio to its pitch, level, ring in s]:
 * a thin struck disc, its modes inharmonic but close enough to a chord to sound
 * bright rather than tinny.
 */
export const COIN_PARTIALS = [
  [1, 1, 0.42],
  [1.52, 0.55, 0.3],
  [2.27, 0.42, 0.22],
  [2.98, 0.22, 0.16],
  [4.14, 0.12, 0.1],
] as const;

/** A coin's lowest partial (Hz) at `pitch` 1. */
export const COIN_BASE = 2350;

/** The gap between two coins of one payment (s). */
export const COIN_GAP = 0.085;

const COINS: SoundParam = { name: "coins", title: "Coins", kind: "number", min: 1, max: 5, step: 1, default: 1 };
const PITCH: SoundParam = { name: "pitch", title: "Pitch", kind: "number", min: 0.8, max: 1.25, step: 0.01, default: 1 };

/** When each of `coins` coins lands (s after the start): a little uneven, from a seeded sequence. */
export function coinTimes(coins: number): number[] {
  const rnd = seeded(0x60d);
  const out: number[] = [];
  let at = 0;
  for (let i = 0; i < coins; i++) {
    out.push(at);
    at += COIN_GAP * (0.8 + 0.45 * rnd());
  }
  return out;
}

/** One coin's clink at `at`: a tick of the edge, then its partials ringing. Returns when it is silent. */
function clink(
  ctx: BaseAudioContext,
  dest: AudioNode,
  at: number,
  base: number,
  strength: number,
  sources: AudioScheduledSourceNode[],
): number {
  let end = at;
  for (const [ratio, level, ring] of COIN_PARTIALS) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(base * ratio, at);
    const g = gain(ctx);
    osc.connect(g).connect(dest);
    strike(g.gain, at, 0.32 * level * strength, ring);
    osc.start(at);
    osc.stop(at + ring + 0.02);
    sources.push(osc);
    end = Math.max(end, at + ring + 0.02);
  }
  const tick = noiseSource(ctx, false);
  const hp = filter(ctx, "bandpass", 6500, 1.5);
  const tg = gain(ctx);
  tick.connect(hp).connect(tg).connect(dest);
  strike(tg.gain, at, 0.3 * strength, 0.03);
  tick.start(at);
  tick.stop(at + 0.05);
  sources.push(tick);
  return end;
}

function coinsVoice(ctx: BaseAudioContext, dest: AudioNode, t: number, v: SoundValues): Voice {
  const out = gain(ctx, REWARD_TRIM * num(v, "level"));
  out.connect(dest);
  const sources: AudioScheduledSourceNode[] = [];
  const coins = Math.round(num(v, "coins"));
  const pitch = num(v, "pitch");
  const rnd = seeded(0xc01);
  let end = t;
  coinTimes(coins).forEach((dt, i) => {
    // each coin a little different, the later ones a touch softer as they settle
    const base = COIN_BASE * pitch * (0.94 + 0.12 * rnd());
    end = Math.max(end, clink(ctx, out, t + dt, base, 1 - 0.08 * i, sources));
  });
  return voiceOf(out, sources, end + 0.05);
}

// --- The fanfare -------------------------------------------------------------

/** A MIDI note's frequency (Hz). */
export function midiHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * The fanfare, as [seconds, MIDI notes, length in s]: three quick G4s, a C5,
 * then G4 C5 and the held C major chord.
 */
export const FANFARE_NOTES: ReadonlyArray<readonly [number, readonly number[], number]> = [
  [0, [67], 0.09],
  [0.12, [67], 0.09],
  [0.24, [67], 0.09],
  [0.36, [72, 64], 0.32],
  [0.74, [67, 60], 0.12],
  [0.9, [72, 64], 0.12],
  [1.06, [76, 72, 67, 60], 1.05],
];

/** How long the fanfare lasts (s), its last chord's release and shimmer included. */
export const FANFARE_LENGTH = 2.6;

/** One brass note: two detuned sawtooths through a low-pass that opens on the attack. */
function brass(ctx: BaseAudioContext, dest: AudioNode, at: number, hz: number, length: number, peak: number, sources: AudioScheduledSourceNode[]): void {
  const lp = filter(ctx, "lowpass", hz * 1.5, 1.2);
  const g = gain(ctx);
  lp.connect(g).connect(dest);
  // the bite of the attack: the filter opens wide, then settles
  lp.frequency.setValueAtTime(hz * 1.5, at);
  lp.frequency.linearRampToValueAtTime(hz * 7, at + 0.04);
  lp.frequency.exponentialRampToValueAtTime(hz * 3.5, at + 0.04 + Math.min(0.25, length));
  const release = length > 0.5 ? 0.45 : 0.08;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.025);
  g.gain.linearRampToValueAtTime(peak * 0.75, at + 0.12);
  g.gain.setValueAtTime(peak * 0.75, at + length);
  g.gain.linearRampToValueAtTime(0, at + length + release);
  // a held note swells a little and wavers (5.5 Hz)
  let vib: OscillatorNode | null = null;
  if (length > 0.5) {
    g.gain.cancelScheduledValues(at + length);
    g.gain.linearRampToValueAtTime(peak * 0.9, at + length * 0.8);
    g.gain.linearRampToValueAtTime(0, at + length + release);
    vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const depth = gain(ctx, hz * 0.004);
    vib.connect(depth);
    vib.start(at + 0.2);
    vib.stop(at + length + release + 0.02);
    sources.push(vib);
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(hz, at);
      o.detune.setValueAtTime(detune, at);
      depth.connect(o.frequency);
      o.connect(lp);
      o.start(at);
      o.stop(at + length + release + 0.02);
      sources.push(o);
    }
    return;
  }
  for (const detune of [-6, 6]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(hz, at);
    o.detune.setValueAtTime(detune, at);
    o.connect(lp);
    o.start(at);
    o.stop(at + length + release + 0.02);
    sources.push(o);
  }
}

/** A cymbal's shimmer: high-passed noise ringing out. */
function shimmer(ctx: BaseAudioContext, dest: AudioNode, at: number, peak: number, ring: number, sources: AudioScheduledSourceNode[]): void {
  const n = noiseSource(ctx, true);
  const hp = filter(ctx, "highpass", 5200, 0.7);
  const g = gain(ctx);
  n.connect(hp).connect(g).connect(dest);
  strike(g.gain, at, peak, ring);
  n.start(at);
  n.stop(at + ring + 0.02);
  sources.push(n);
}

function fanfare(ctx: BaseAudioContext, dest: AudioNode, t: number, v: SoundValues): Voice {
  const out = gain(ctx, REWARD_TRIM * num(v, "level"));
  out.connect(dest);
  const sources: AudioScheduledSourceNode[] = [];
  for (const [at, notes, length] of FANFARE_NOTES) {
    // a chord shares the brass section's loudness among its notes
    const peak = 0.29 / Math.sqrt(notes.length);
    for (const note of notes) brass(ctx, out, t + at, midiHz(note), length, peak, sources);
  }
  const last = FANFARE_NOTES[FANFARE_NOTES.length - 1]!;
  shimmer(ctx, out, t + last[0], 0.09, 1.4, sources);
  // a timpani roll's single stroke under the chord
  const timp = ctx.createOscillator();
  timp.type = "sine";
  timp.frequency.setValueAtTime(midiHz(48) * 1.02, t + last[0]);
  timp.frequency.exponentialRampToValueAtTime(midiHz(48), t + last[0] + 0.2);
  const tg = gain(ctx);
  timp.connect(tg).connect(out);
  strike(tg.gain, t + last[0], 0.35, 0.9);
  timp.start(t + last[0]);
  timp.stop(t + last[0] + 0.95);
  sources.push(timp);
  return voiceOf(out, sources, t + FANFARE_LENGTH);
}

// --- Taking a gift -------------------------------------------------------------

/** The glitter's arpeggio as MIDI notes: C6 E6 G6 C7 E7, then the chord rings. */
export const GLITTER_NOTES = [84, 88, 91, 96, 100] as const;
/** The gap between two notes of the glitter (s). */
export const GLITTER_GAP = 0.07;
/** When the glitter starts, after the wrapping's rustle (s). */
export const GLITTER_AT = 0.22;

/** A bell-like chime: a sine and its bright, inharmonic overtone, struck. */
function chime(ctx: BaseAudioContext, dest: AudioNode, at: number, hz: number, peak: number, ring: number, sources: AudioScheduledSourceNode[]): number {
  for (const [ratio, level, r] of [[1, 1, ring], [2.76, 0.25, ring * 0.4], [5.4, 0.08, ring * 0.2]] as const) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(hz * ratio, at);
    const g = gain(ctx);
    o.connect(g).connect(dest);
    strike(g.gain, at, peak * level, r);
    o.start(at);
    o.stop(at + r + 0.02);
    sources.push(o);
  }
  return at + ring + 0.02;
}

function take(ctx: BaseAudioContext, dest: AudioNode, t: number, v: SoundValues): Voice {
  const out = gain(ctx, REWARD_TRIM * num(v, "level"));
  out.connect(dest);
  const sources: AudioScheduledSourceNode[] = [];
  // the wrapping torn open: band-passed noise sweeping up
  const paper = noiseSource(ctx, true);
  const bp = filter(ctx, "bandpass", 1500, 1.4);
  bp.frequency.setValueAtTime(1500, t);
  bp.frequency.exponentialRampToValueAtTime(5200, t + 0.22);
  const pg = gain(ctx);
  paper.connect(bp).connect(pg).connect(out);
  pg.gain.setValueAtTime(0, t);
  pg.gain.linearRampToValueAtTime(0.22, t + 0.05);
  pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  paper.start(t);
  paper.stop(t + 0.32);
  sources.push(paper);
  // the glitter rising, its last note held under the chord
  let end = t + 0.32;
  GLITTER_NOTES.forEach((note, i) => {
    const at = t + GLITTER_AT + i * GLITTER_GAP;
    const last = i === GLITTER_NOTES.length - 1;
    end = Math.max(end, chime(ctx, out, at, midiHz(note), last ? 0.2 : 0.15, last ? 1.6 : 0.7, sources));
  });
  // the chord the glitter lands on, softer, ringing longest
  const chordAt = t + GLITTER_AT + GLITTER_NOTES.length * GLITTER_GAP;
  for (const note of [72, 76, 79]) end = Math.max(end, chime(ctx, out, chordAt, midiHz(note), 0.11, 1.8, sources));
  shimmer(ctx, out, chordAt, 0.05, 1.0, sources);
  return voiceOf(out, sources, end + 0.05);
}

// --- Buying in the shop ----------------------------------------------------------

/** When the till's bell rings, after the register's clack and the coins (s). */
export const TILL_BELL_AT = 0.3;

function buy(ctx: BaseAudioContext, dest: AudioNode, t: number, v: SoundValues): Voice {
  const out = gain(ctx, REWARD_TRIM * num(v, "level"));
  out.connect(dest);
  const sources: AudioScheduledSourceNode[] = [];
  // the register's clack: a short knock of the drawer's mechanism
  const knock = ctx.createOscillator();
  knock.type = "triangle";
  knock.frequency.setValueAtTime(320, t);
  knock.frequency.exponentialRampToValueAtTime(110, t + 0.06);
  const kg = gain(ctx);
  knock.connect(kg).connect(out);
  strike(kg.gain, t, 0.45, 0.09);
  knock.start(t);
  knock.stop(t + 0.12);
  sources.push(knock);
  const clack = noiseSource(ctx, false);
  const cf = filter(ctx, "bandpass", 2200, 2);
  const cg = gain(ctx);
  clack.connect(cf).connect(cg).connect(out);
  strike(cg.gain, t, 0.5, 0.05);
  strike(cg.gain, t + 0.07, 0.35, 0.04);
  clack.start(t);
  clack.stop(t + 0.14);
  sources.push(clack);
  // the coins dropped into the till
  let end = t + 0.14;
  const rnd = seeded(0xb07);
  coinTimes(3).forEach((dt, i) => {
    const base = COIN_BASE * (0.9 + 0.12 * rnd());
    end = Math.max(end, clink(ctx, out, t + 0.08 + dt * 0.8, base, 0.6 - 0.1 * i, sources));
  });
  // the till's bell: two bright tones a fourth apart, "ka-ching"
  end = Math.max(end, chime(ctx, out, t + TILL_BELL_AT, midiHz(93), 0.26, 1.3, sources));
  end = Math.max(end, chime(ctx, out, t + TILL_BELL_AT, midiHz(98), 0.2, 1.1, sources));
  shimmer(ctx, out, t + TILL_BELL_AT, 0.04, 0.6, sources);
  return voiceOf(out, sources, end + 0.05);
}

export const tokenCoins = /* @__PURE__ */ oneShot({
  id: "token-coins",
  title: "Tokens",
  category: "rewards",
  description: "Tokens earned: gold coins clinking, one clink per coin.",
  params: [COINS, PITCH, LEVEL],
  play: coinsVoice,
});

export const giftFanfare = /* @__PURE__ */ oneShot({
  id: "gift-fanfare",
  title: "Gift arrives",
  category: "rewards",
  description: "A gift has arrived: a short brass fanfare into a held chord, with a cymbal's shimmer.",
  params: [LEVEL],
  play: fanfare,
});

export const giftTake = /* @__PURE__ */ oneShot({
  id: "gift-take",
  title: "Gift taken",
  category: "rewards",
  description: "A gift taken into the collection: the wrapping torn open, then a glittering arpeggio rising into a chord.",
  params: [LEVEL],
  play: take,
});

export const shopBuy = /* @__PURE__ */ oneShot({
  id: "shop-buy",
  title: "Bought",
  category: "rewards",
  description: "An item bought with tokens: the register's clack, coins into the till and its ka-ching.",
  params: [LEVEL],
  play: buy,
});
