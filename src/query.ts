// The site's state in the query string (docs/site/catalog-site.md): the list's
// search, kind and group filters, the open item (a piece, a jingle or a sound
// effect), its parameters and the position. The Sounds page that once lived at
// `?sounds` is now the list filtered to sound effects, so that link still lands
// somewhere sensible.

import { JINGLE_PARAMS } from "../lib/jingles.ts";
import { PARAMS } from "../lib/params.ts";

/** What the list shows: everything, or one kind. */
export type Kind = "" | "piece" | "jingle" | "effect";
export const KINDS: Kind[] = ["", "piece", "jingle", "effect"];

/** The open item. */
export type ItemRef = { kind: "piece" | "jingle" | "effect"; id: string } | null;

export interface ViewState {
  q: string;
  kind: Kind;
  /** A subgroup of the kind: a piece set, an effect category. */
  set: string;
  item: ItemRef;
  /** Arrangement parameters of a piece or a jingle. */
  params: Record<string, string>;
  /** Seconds to start from, written when playback pauses. */
  t: number | null;
}

/** The URL key of each kind's open item. */
const ITEM_KEY = { piece: "piece", jingle: "jingle", effect: "sound" } as const;

const PARAM_DEFS = [...PARAMS, ...JINGLE_PARAMS];

export function emptyView(): ViewState {
  return { q: "", kind: "", set: "", item: null, params: {}, t: null };
}

export function parseView(search: string): ViewState {
  const p = new URLSearchParams(search);
  const v = emptyView();
  v.q = p.get("q") ?? "";
  const kind = p.get("kind") ?? "";
  if ((KINDS as string[]).includes(kind)) v.kind = kind as Kind;
  v.set = p.get("set") ?? "";
  // The old Sounds page: the list of sound effects.
  if (p.has("sounds")) return { ...emptyView(), kind: "effect" };
  for (const k of ["piece", "jingle", "effect"] as const) {
    const id = p.get(ITEM_KEY[k]);
    if (id) {
      v.item = { kind: k, id };
      break;
    }
  }
  if (v.item && v.item.kind !== "effect") {
    for (const d of PARAM_DEFS) {
      const value = p.get(d.name);
      if (value !== null && d.values.some((x) => x.value === value)) v.params[d.name] = value;
    }
    const t = Number(p.get("t"));
    v.t = Number.isFinite(t) && t > 0 ? t : null;
  }
  return v;
}

export function serializeView(v: ViewState): string {
  const p = new URLSearchParams();
  if (v.q) p.set("q", v.q);
  if (v.kind) p.set("kind", v.kind);
  if (v.set) p.set("set", v.set);
  if (v.item) {
    p.set(ITEM_KEY[v.item.kind], v.item.id);
    if (v.item.kind !== "effect") {
      for (const d of PARAM_DEFS) {
        const value = v.params[d.name];
        if (value !== undefined && !p.has(d.name)) p.set(d.name, value);
      }
      if (v.t) p.set("t", v.t.toFixed(1));
    }
  }
  const s = p.toString();
  return s ? "?" + s : location.pathname;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
