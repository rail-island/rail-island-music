// The arrangement parameters every piece offers, and a piece's metadata
// (scores/<id>/piece.json; docs/music/arrangement.md). Parameters are enums,
// like the factory's design parameters: an arrangement is a piece plus one
// value of each.

export type SetId = "classical" | "ragtime" | "early-jazz" | "railway";
export type Groove = "oompah" | "two-beat" | "swing" | "waltz";

export const SETS: { id: SetId; title: string }[] = [
  { id: "classical", title: "Classical" },
  { id: "ragtime", title: "Ragtime" },
  { id: "early-jazz", title: "Early jazz" },
  { id: "railway", title: "Railway songs" },
];

export interface ParamValue {
  value: string;
  title: string;
}

export interface ParamDef {
  name: ParamName;
  title: string;
  values: ParamValue[];
}

export type ParamName = "ensemble" | "tempo" | "length" | "key";
export type Params = Record<ParamName, string>;

export const PARAMS: ParamDef[] = [
  {
    name: "ensemble",
    title: "Ensemble",
    values: [
      { value: "piano", title: "Solo piano" },
      { value: "ragtime-band", title: "Ragtime band" },
      { value: "brass-band", title: "Brass band" },
      { value: "jazz-band", title: "Jazz band" },
      { value: "chiptune", title: "Chiptune" },
    ],
  },
  {
    name: "tempo",
    title: "Tempo",
    values: [
      { value: "calm", title: "Calm" },
      { value: "normal", title: "Normal" },
      { value: "lively", title: "Lively" },
    ],
  },
  {
    name: "length",
    title: "Length",
    values: [
      { value: "short", title: "Short (no repeats)" },
      { value: "full", title: "Full (as written)" },
      { value: "long", title: "Long (played twice)" },
    ],
  },
  {
    name: "key",
    title: "Key",
    values: [
      { value: "-3", title: "3 semitones down" },
      { value: "-2", title: "2 semitones down" },
      { value: "-1", title: "1 semitone down" },
      { value: "0", title: "Original" },
      { value: "+1", title: "1 semitone up" },
      { value: "+2", title: "2 semitones up" },
      { value: "+3", title: "3 semitones up" },
    ],
  },
];

export const TEMPO_FACTOR: Record<string, number> = { calm: 0.88, normal: 1, lively: 1.12 };

export interface PieceMeta {
  /** Permanent once published: the game may store it. Kebab-case. */
  id: string;
  title: string;
  composer: string;
  /** Year of composition or first publication. */
  year: number;
  set: SetId;
  /** The accompaniment pattern the arranger generates from the chord symbols. */
  groove: Groove;
  /** 0.5 = straight eighths; up to 2/3 for a full triplet swing. */
  swing: number;
  /** The default value of every parameter for this piece. */
  defaults: Params;
  /** Why the composition is in the public domain (composer's death, publication year). */
  publicDomain: string;
}

export function isParams(p: Record<string, string>): p is Params {
  return PARAMS.every((d) => d.values.some((v) => v.value === p[d.name]));
}

/** The parameters with `overrides` applied over the piece's defaults, unknown values dropped. */
export function resolveParams(piece: PieceMeta, overrides: Partial<Record<string, string>>): Params {
  const out = { ...piece.defaults };
  for (const d of PARAMS) {
    const v = overrides[d.name];
    if (v !== undefined && d.values.some((x) => x.value === v)) out[d.name] = v;
  }
  return out;
}
