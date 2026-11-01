// Jingles (docs/music/jingles.md): short motifs recorded by hand as MIDI and
// transcribed as played, quantized and its slips fixed. Each one is a folder
// jingles/<id>/ with jingle.json, score.abc, SOURCES.md and the recording. They
// arrange like pieces, without Length: a jingle is never shortened or
// repeated. Isomorphic: the generator and the site run the same code.

import { PARAMS, type Groove, type ParamValue, type Params, type PieceMeta } from "./params.ts";

/** A parameter of a jingle: a piece's parameters but Length. */
export interface JingleParamDef {
  name: "ensemble" | "tempo" | "key";
  title: string;
  values: ParamValue[];
}

export const JINGLE_PARAMS: JingleParamDef[] = PARAMS.filter((p) => p.name !== "length") as JingleParamDef[];

export type JingleParams = Record<JingleParamDef["name"], string>;

export interface JingleMeta {
  /** Kebab-case; permanent once the game uses it (not yet: titles may still change). */
  id: string;
  title: string;
  /** Who recorded the motif. */
  composer: string;
  year: number;
  /** The accompaniment pattern for the generated chords and drums. */
  groove: Groove;
  swing: number;
  defaults: JingleParams;
  /** The recording it was transcribed from, in one line. */
  source: string;
}

/** A jingle as the site lists it: its metadata and its default arrangement's facts. */
export interface JingleEntry extends JingleMeta {
  key: string;
  meter: string;
  duration: number;
  bars: number;
}

/** What the build writes for the site (export/site/jingles.json). */
export interface JingleCatalog {
  params: JingleParamDef[];
  jingles: JingleEntry[];
}

export function isJingleParams(p: Record<string, string>): p is JingleParams {
  return JINGLE_PARAMS.every((d) => d.values.some((v) => v.value === p[d.name]));
}

/** The parameters with `overrides` applied over the jingle's defaults, unknown values dropped. */
export function resolveJingleParams(jingle: JingleMeta, overrides: Partial<Record<string, string>>): JingleParams {
  const out = { ...jingle.defaults };
  for (const d of JINGLE_PARAMS) {
    const v = overrides[d.name];
    if (v !== undefined && d.values.some((x) => x.value === v)) out[d.name] = v;
  }
  return out;
}

/**
 * What the arranger takes for a jingle: the jingle as a piece, and its
 * parameters as a piece's -- the whole score, once (`length` "full"; a jingle
 * has no repeats).
 */
export function jingleAsPiece(jingle: JingleMeta, params: JingleParams): { piece: PieceMeta; params: Params } {
  return {
    piece: {
      id: jingle.id,
      title: jingle.title,
      composer: jingle.composer,
      year: jingle.year,
      set: "railway",
      groove: jingle.groove,
      swing: jingle.swing,
      defaults: { ensemble: jingle.defaults.ensemble, tempo: jingle.defaults.tempo, length: "full", key: jingle.defaults.key },
      publicDomain: "",
    },
    params: { ensemble: params.ensemble, tempo: params.tempo, length: "full", key: params.key },
  };
}
