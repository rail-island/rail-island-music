// The one list the site shows (docs/site/catalog-site.md): every piece, jingle
// and sound effect as a row of the same shape -- a kind and a group -- so the
// search, the kind chips and the group chips treat them alike. Pure: the
// filtering is tested without a DOM (test/catalogList.test.ts).

import type { Catalog } from "../lib/catalog.ts";
import type { JingleCatalog } from "../lib/jingles.ts";
import type { SoundCategory, SoundMeta } from "../sounds/types.ts";
import type { Kind } from "./query.ts";

export type RowKind = Exclude<Kind, "">;

export interface Row {
  kind: RowKind;
  id: string;
  title: string;
  /** Composer, or what a sound effect is. */
  by: string;
  /** The group's id (a piece set, an effect category) and its title. */
  group: string;
  groupTitle: string;
  /** Seconds of the default arrangement; null for a sound effect. */
  duration: number | null;
  /** Extra words the search matches (year, key, description). */
  words: string;
}

export const KIND_TITLES: Record<RowKind, string> = { piece: "Piece", jingle: "Jingle", effect: "Sound effect" };

export const CATEGORY_TITLES: Record<SoundCategory, string> = {
  trains: "Trains",
  ships: "Ships",
  water: "Water",
  editor: "Editor",
};

/** Every row, in list order: pieces (by set, then title), jingles, then sound effects. */
export function buildRows(catalog: Catalog, jingles: JingleCatalog | null, sounds: readonly SoundMeta[]): Row[] {
  const setTitle = (id: string) => catalog.sets.find((s) => s.id === id)?.title ?? id;
  return [
    ...catalog.pieces.map(
      (p): Row => ({
        kind: "piece",
        id: p.id,
        title: p.title,
        by: p.composer,
        group: p.set,
        groupTitle: setTitle(p.set),
        duration: p.duration,
        words: `${p.year} ${p.key}`,
      }),
    ),
    ...(jingles?.jingles ?? []).map(
      (j): Row => ({
        kind: "jingle",
        id: j.id,
        title: j.title,
        by: j.composer,
        group: "jingles",
        groupTitle: "Jingles",
        duration: j.duration,
        words: `${j.year} ${j.key} ${j.source}`,
      }),
    ),
    ...sounds.map(
      (s): Row => ({
        kind: "effect",
        id: s.id,
        title: s.title,
        by: s.kind === "loop" ? "Loop" : "One-shot",
        group: s.category,
        groupTitle: CATEGORY_TITLES[s.category],
        duration: null,
        words: `${s.id} ${s.description}`,
      }),
    ),
  ];
}

/** The groups a kind's rows fall into, in list order; none for every kind at once or a single group. */
export function groupsOf(rows: readonly Row[], kind: Kind): { id: string; title: string }[] {
  if (!kind) return [];
  const out: { id: string; title: string }[] = [];
  for (const r of rows) if (r.kind === kind && !out.some((g) => g.id === r.group)) out.push({ id: r.group, title: r.groupTitle });
  return out.length > 1 ? out : [];
}

/** Rows matching every word of the search (title, by, group, kind, extras), the kind and the group. */
export function filterRows(rows: readonly Row[], q: string, kind: Kind, group: string): Row[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    if (kind && r.kind !== kind) return false;
    if (kind && group && r.group !== group) return false;
    const hay = `${r.title} ${r.by} ${r.groupTitle} ${KIND_TITLES[r.kind]} ${r.words}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
