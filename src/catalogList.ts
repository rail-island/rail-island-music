// The site's list (docs/site/catalog-site.md): every sound design in one table,
// filtered by search, category and kind and sorted on any column, the way the
// factory's table lists its models. Pure: tested without a DOM
// (test/catalogList.test.ts).

import type { SoundCategory, SoundCategoryInfo, SoundMeta } from "../sounds/types.ts";
import type { KindFilter } from "./query.ts";

export const KIND_TITLES: Record<SoundMeta["kind"], string> = { oneShot: "One-shot", loop: "Loop" };

/** Sounds matching every word of the search (title, id, description, category, kind), the category and the kind. */
export function filterSounds<T extends SoundMeta>(
  sounds: readonly T[],
  categories: readonly SoundCategoryInfo[],
  q: string,
  cat: SoundCategory | "",
  kind: KindFilter,
): T[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const catTitle = (id: string) => categories.find((c) => c.id === id)?.title ?? id;
  return sounds.filter((s) => {
    if (cat && s.category !== cat) return false;
    if (kind && s.kind !== kind) return false;
    const hay = `${s.title} ${s.id} ${s.description} ${catTitle(s.category)} ${KIND_TITLES[s.kind]}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** How many sounds each category holds, for its chip. */
export function countByCategory(sounds: readonly SoundMeta[]): Partial<Record<SoundCategory, number>> {
  const out: Partial<Record<SoundCategory, number>> = {};
  for (const s of sounds) out[s.category] = (out[s.category] ?? 0) + 1;
  return out;
}

export type SortDir = "asc" | "desc";

/** A table row: a design's meta, its metrics once loaded, and its place in SOUNDS. */
export type SoundRow = SoundMeta & { order: number };

/** One column of the table; its key doubles as the `?sort=` token. */
export interface SoundColumn {
  key: string;
  label: string;
  /** How a value is shown: text, a plain number, or a byte size. */
  type: "text" | "num" | "bytes";
  /** The direction a first click sorts in: text ascending, numbers descending. */
  dir: SortDir;
  /** Hidden on a phone. */
  wide?: boolean;
  value(r: SoundRow, categories: readonly SoundCategoryInfo[]): string | number | null;
}

// The order here is the order of the table's columns.
export const COLUMNS: readonly SoundColumn[] = [
  { key: "title", label: "Title", type: "text", dir: "asc", value: (r) => r.title },
  // Category order, not alphabetical: the order CATEGORIES lists them in.
  { key: "category", label: "Category", type: "text", dir: "asc", value: (r, cats) => cats.findIndex((c) => c.id === r.category) },
  { key: "kind", label: "Kind", type: "text", dir: "asc", value: (r) => KIND_TITLES[r.kind] },
  { key: "jsBytes", label: "JS", type: "bytes", dir: "desc", value: (r) => r.metrics?.jsBytes ?? null },
  { key: "nodes", label: "Nodes", type: "num", dir: "desc", value: (r) => r.metrics?.nodesAtStart ?? null },
  { key: "nodesPerSecond", label: "Nodes/s", type: "num", dir: "desc", wide: true, value: (r) => r.metrics?.nodesPerSecond ?? null },
  { key: "seconds", label: "Length s", type: "num", dir: "desc", wide: true, value: (r) => r.metrics?.seconds ?? null },
  { key: "params", label: "Params", type: "num", dir: "desc", wide: true, value: (r) => r.params.length },
];

export const DEFAULT_SORT = "category";

export function columnByKey(key: string): SoundColumn | undefined {
  return COLUMNS.find((c) => c.key === key);
}

/**
 * `rows` sorted on one column. A missing value (a loop's length, metrics not yet
 * loaded) sorts last in both directions; ties keep the SOUNDS order, so the
 * order is total and the default reads like the grouped list did.
 */
export function sortSounds(rows: readonly SoundRow[], categories: readonly SoundCategoryInfo[], sort: string, dir: SortDir): SoundRow[] {
  const col = columnByKey(sort) ?? columnByKey(DEFAULT_SORT)!;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = col.value(a, categories);
    const vb = col.value(b, categories);
    if (va == null || vb == null) {
      if (va == null && vb != null) return 1;
      if (vb == null && va != null) return -1;
    } else {
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "en");
      if (c !== 0) return c * sign;
    }
    return a.order - b.order;
  });
}

/** A cell's text: bytes in KB, a missing value as a dash. */
export function formatCell(col: SoundColumn, v: string | number | null, categories: readonly SoundCategoryInfo[]): string {
  if (v == null) return "-";
  if (col.key === "category") return categories[v as number]?.title ?? "";
  if (col.type === "bytes") return `${((v as number) / 1024).toFixed(1)} KB`;
  return String(v);
}
