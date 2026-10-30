// The site's state in the query string (docs/site/catalog-site.md): the list's
// search and set filter, the open piece, its parameters and the position.

import { PARAMS, type ParamName } from "../lib/params.ts";
import type { CatalogEntry } from "../lib/catalog.ts";

export interface ViewState {
  q: string;
  set: string;
  piece: string | null;
  params: Partial<Record<ParamName, string>>;
  /** Seconds to start from, written when playback pauses. */
  t: number | null;
}

export function parseView(search: string): ViewState {
  const p = new URLSearchParams(search);
  const params: Partial<Record<ParamName, string>> = {};
  for (const d of PARAMS) {
    const v = p.get(d.name);
    if (v !== null && d.values.some((x) => x.value === v)) params[d.name] = v;
  }
  const t = Number(p.get("t"));
  return { q: p.get("q") ?? "", set: p.get("set") ?? "", piece: p.get("piece"), params, t: Number.isFinite(t) && t > 0 ? t : null };
}

export function serializeView(v: ViewState): string {
  const p = new URLSearchParams();
  if (v.q) p.set("q", v.q);
  if (v.set) p.set("set", v.set);
  if (v.piece) {
    p.set("piece", v.piece);
    for (const d of PARAMS) {
      const value = v.params[d.name];
      if (value !== undefined) p.set(d.name, value);
    }
    if (v.t) p.set("t", v.t.toFixed(1));
  }
  const s = p.toString();
  return s ? "?" + s : location.pathname;
}

/** Pieces matching the search (title, composer, set) and the set filter. */
export function filterPieces(pieces: CatalogEntry[], q: string, set: string): CatalogEntry[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return pieces.filter((p) => {
    if (set && p.set !== set) return false;
    const hay = `${p.title} ${p.composer} ${p.set} ${p.year}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
