// The site's list (src/catalogList.ts): every sound design, filtered by search,
// category and kind, and grouped under its category.

import { describe, expect, it } from "vitest";
import { CATEGORIES, SOUNDS, soundMeta } from "../sounds/index.ts";
import { COLUMNS, columnByKey, countByCategory, filterSounds, formatCell, sortSounds, type SoundRow } from "../src/catalogList.ts";
import { soundsMeta } from "../generator/sounds.ts";
import { measureSounds } from "../generator/metrics.ts";

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
    expect(ids("bell")).toEqual(["crossing-bell", "tram-bell", "church-bell", "big-ben", "notre-dame-bell"]);
    expect(ids("ships horn")).toEqual(["ship-horn"]);
    expect(ids("trains loop")).toEqual([
      "steam-chuff",
      "diesel-engine-railcar",
      "diesel-engine-shunter",
      "diesel-engine-mainline",
      "diesel-engine-two-stroke",
      "diesel-engine-bus",
      "diesel-engine-truck",
      "electric-engine-resistor",
      "electric-engine-converter",
      "electric-engine-shinkansen",
      "crossing-bell",
    ]);
    expect(ids("waterfall demolish")).toEqual([]);
  });

  it("sorts on category by default, keeping the SOUNDS order within one", () => {
    const rows: SoundRow[] = metas.map((m, order) => ({ ...m, order }));
    expect(sortSounds(rows, CATEGORIES, "category", "asc").map((r) => r.id)).toEqual(SOUNDS.map((s) => s.id));
    const desc = sortSounds(rows, CATEGORIES, "category", "desc").map((r) => r.category);
    expect(desc[0]).toBe("editor");
    expect(desc[desc.length - 1]).toBe("trains");
    // an unknown column falls back to the default
    expect(sortSounds(rows, CATEGORIES, "nope", "asc").map((r) => r.id)).toEqual(SOUNDS.map((s) => s.id));
  });
  it("counts each category's sounds for its chip", () => {
    const counts = countByCategory(metas);
    expect(counts.water).toBe(4);
    expect(counts.ships).toBe(1);
    expect(Object.values(counts).reduce((a, b) => a + b!, 0)).toBe(SOUNDS.length);
  });
});

describe("the table's metric columns", async () => {
  const metrics = await measureSounds(SOUNDS);
  const rows: SoundRow[] = soundsMeta(metrics).sounds.map((m, order) => ({ ...m, order }));

  it("sort numbers, and put a missing value last in both directions", () => {
    const bySeconds = sortSounds(rows, CATEGORIES, "seconds", "desc");
    expect(bySeconds[0]!.id).toBe("big-ben");
    // loops have no length: they come after every one-shot, either way round
    for (const dir of ["asc", "desc"] as const) {
      const kinds = sortSounds(rows, CATEGORIES, "seconds", dir).map((r) => r.kind);
      expect(kinds.indexOf("loop")).toBe(kinds.filter((k) => k === "oneShot").length);
    }
    const byJs = sortSounds(rows, CATEGORIES, "jsBytes", "asc").map((r) => r.metrics!.jsBytes);
    expect(byJs).toEqual([...byJs].sort((a, b) => a - b));
  });

  it("show bytes in KB, a category by title and a missing value as a dash", () => {
    expect(formatCell(columnByKey("jsBytes")!, 2048, CATEGORIES)).toBe("2.0 KB");
    expect(formatCell(columnByKey("category")!, 1, CATEGORIES)).toBe("Ships");
    expect(formatCell(columnByKey("seconds")!, null, CATEGORIES)).toBe("-");
  });

  it("have a column per metric, title first", () => {
    expect(COLUMNS.map((c) => c.key)).toEqual(["title", "category", "kind", "jsBytes", "nodes", "nodesPerSecond", "seconds", "params"]);
  });
});
