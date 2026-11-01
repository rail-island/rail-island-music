// The site's state in the query string (docs/site/catalog-site.md): the list's
// search, category and kind filters, its sort, and the open sound. Links from the time
// the site also held music still land somewhere sensible: `?kind=effect` and
// `?sounds` open the list, `set=<category>` filters it, and a piece or a jingle
// is dropped.

import type { SoundCategory } from "../sounds/types.ts";
import { DEFAULT_SORT, type SortDir, columnByKey } from "./catalogList.ts";

/** One-shots, loops, or both. */
export type KindFilter = "" | "oneShot" | "loop";
export const KIND_FILTERS: KindFilter[] = ["", "oneShot", "loop"];

export interface ViewState {
  q: string;
  /** A category id, or "" for every category. */
  cat: SoundCategory | "";
  kind: KindFilter;
  /** The sorted-by column's key (catalogList.ts COLUMNS), and its direction. */
  sort: string;
  dir: SortDir;
  /** The open sound's id. */
  sound: string | null;
}

export function emptyView(): ViewState {
  return { q: "", cat: "", kind: "", sort: DEFAULT_SORT, dir: "asc", sound: null };
}

/** `categories` are the valid category ids; anything else is dropped. */
export function parseView(search: string, categories: readonly string[]): ViewState {
  const p = new URLSearchParams(search);
  const v = emptyView();
  v.q = p.get("q") ?? "";
  // `set` is the category's old name, from when the list held pieces as well.
  const cat = p.get("cat") ?? p.get("set") ?? "";
  if (categories.includes(cat)) v.cat = cat as SoundCategory;
  const kind = p.get("kind") ?? "";
  if ((KIND_FILTERS as string[]).includes(kind)) v.kind = kind as KindFilter;
  const sort = p.get("sort") ?? "";
  if (columnByKey(sort)) v.sort = sort;
  const dir = p.get("dir");
  v.dir = dir === "asc" || dir === "desc" ? dir : columnByKey(v.sort)!.dir;
  v.sound = p.get("sound") || null;
  return v;
}

export function serializeView(v: ViewState): string {
  const p = new URLSearchParams();
  if (v.q) p.set("q", v.q);
  if (v.cat) p.set("cat", v.cat);
  if (v.kind) p.set("kind", v.kind);
  if (v.sort !== DEFAULT_SORT) p.set("sort", v.sort);
  if (v.dir !== (columnByKey(v.sort)?.dir ?? "asc")) p.set("dir", v.dir);
  if (v.sound) p.set("sound", v.sound);
  const s = p.toString();
  return s ? "?" + s : location.pathname;
}
