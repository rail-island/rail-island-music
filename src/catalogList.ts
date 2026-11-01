// The site's list (docs/site/catalog-site.md): every sound design, filtered by
// search, category and kind, and grouped under its category. Pure: tested
// without a DOM (test/catalogList.test.ts).

import type { SoundCategory, SoundCategoryInfo, SoundMeta } from "../sounds/types.ts";
import type { KindFilter } from "./query.ts";

export const KIND_TITLES: Record<SoundMeta["kind"], string> = { oneShot: "One-shot", loop: "Loop" };

/** Sounds matching every word of the search (title, id, description, category, kind), the category and the kind. */
export function filterSounds(
  sounds: readonly SoundMeta[],
  categories: readonly SoundCategoryInfo[],
  q: string,
  cat: SoundCategory | "",
  kind: KindFilter,
): SoundMeta[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const catTitle = (id: string) => categories.find((c) => c.id === id)?.title ?? id;
  return sounds.filter((s) => {
    if (cat && s.category !== cat) return false;
    if (kind && s.kind !== kind) return false;
    const hay = `${s.title} ${s.id} ${s.description} ${catTitle(s.category)} ${KIND_TITLES[s.kind]}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** `sounds` under their categories, in category order; a category with none is left out. */
export function groupByCategory(
  sounds: readonly SoundMeta[],
  categories: readonly SoundCategoryInfo[],
): { category: SoundCategoryInfo; sounds: SoundMeta[] }[] {
  return categories
    .map((category) => ({ category, sounds: sounds.filter((s) => s.category === category.id) }))
    .filter((g) => g.sounds.length > 0);
}

/** How many sounds each category holds, for its chip. */
export function countByCategory(sounds: readonly SoundMeta[]): Partial<Record<SoundCategory, number>> {
  const out: Partial<Record<SoundCategory, number>> = {};
  for (const s of sounds) out[s.category] = (out[s.category] ?? 0) + 1;
  return out;
}
