// The site's list (src/catalogList.ts): every sound design, filtered by search,
// category and kind, and grouped under its category.

import { describe, expect, it } from "vitest";
import { CATEGORIES, SOUNDS, soundMeta } from "../sounds/index.ts";
import { countByCategory, filterSounds, groupByCategory } from "../src/catalogList.ts";

const metas = SOUNDS.map(soundMeta);
const ids = (q: string, cat: "" | (typeof CATEGORIES)[number]["id"] = "", kind: "" | "oneShot" | "loop" = "") =>
  filterSounds(metas, CATEGORIES, q, cat, kind).map((s) => s.id);

describe("the list", () => {
  it("holds every sound without a filter", () => {
    expect(ids("")).toEqual(SOUNDS.map((s) => s.id));
  });

  it("filters by category and by kind", () => {
    expect(ids("", "water")).toEqual(["river-rapids", "waterfall", "spring-fountain", "sea-surf"]);
    expect(ids("", "bells", "oneShot")).toEqual(["church-bell", "big-ben", "notre-dame-bell"]);
    expect(ids("", "bells", "loop")).toEqual([]);
    expect(ids("", "", "loop").every((id) => SOUNDS.find((s) => s.id === id)!.kind === "loop")).toBe(true);
  });

  it("searches every word across title, id, description, category and kind", () => {
    expect(ids("bell")).toEqual(["crossing-bell", "church-bell", "big-ben", "notre-dame-bell"]);
    expect(ids("ships horn")).toEqual(["ship-horn"]);
    expect(ids("trains loop")).toEqual(["steam-chuff", "diesel-engine", "crossing-bell"]);
    expect(ids("waterfall demolish")).toEqual([]);
  });

  it("groups the sounds under their categories, in category order, leaving empty ones out", () => {
    const all = groupByCategory(metas, CATEGORIES);
    expect(all.map((g) => g.category.id)).toEqual(CATEGORIES.map((c) => c.id));
    expect(all.flatMap((g) => g.sounds.map((s) => s.id))).toEqual(SOUNDS.map((s) => s.id));
    const bells = groupByCategory(filterSounds(metas, CATEGORIES, "bell", "", ""), CATEGORIES);
    expect(bells.map((g) => [g.category.id, g.sounds.length])).toEqual([
      ["trains", 1],
      ["bells", 3],
    ]);
  });

  it("counts each category's sounds for its chip", () => {
    const counts = countByCategory(metas);
    expect(counts.water).toBe(4);
    expect(counts.ships).toBe(1);
    expect(Object.values(counts).reduce((a, b) => a + b!, 0)).toBe(SOUNDS.length);
  });
});
