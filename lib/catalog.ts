// The catalog entry of a piece (export/catalog.json; docs/music/export.md).
// Shared by the generator, which writes it, and the site, which reads it.

import type { Score } from "./abcParse.ts";
import type { ParamDef, PieceMeta, SetId } from "./params.ts";
import type { Performance } from "./performance.ts";
import { keyName } from "./theory.ts";

export interface CatalogEntry extends PieceMeta {
  /** The written key ("Am") and meter ("2/4"). */
  key: string;
  meter: string;
  /** Seconds and bars of the default arrangement. */
  duration: number;
  bars: number;
}

export interface Catalog {
  params: ParamDef[];
  sets: { id: SetId; title: string }[];
  pieces: CatalogEntry[];
}

export function catalogEntry(meta: PieceMeta, score: Score, perf: Performance): CatalogEntry {
  return {
    ...meta,
    key: keyName(score.key),
    meter: `${score.meter[0]}/${score.meter[1]}`,
    duration: perf.duration,
    bars: perf.bars.length,
  };
}
