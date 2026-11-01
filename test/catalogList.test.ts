// The one list of the site (src/catalogList.ts): pieces, jingles and sound
// effects as rows of one shape, filtered by search, kind and group.

import { describe, expect, it } from "vitest";
import type { Catalog } from "../lib/catalog.ts";
import type { JingleCatalog } from "../lib/jingles.ts";
import { SOUNDS, soundMeta } from "../sounds/index.ts";
import { buildRows, filterRows, groupsOf } from "../src/catalogList.ts";

const catalog = {
  params: [],
  sets: [
    { id: "classical", title: "Classical" },
    { id: "ragtime", title: "Ragtime" },
  ],
  pieces: [
    { id: "maple-leaf-rag", title: "Maple Leaf Rag", composer: "Scott Joplin", year: 1899, set: "ragtime", key: "Ab", duration: 180 },
    { id: "rondo-alla-turca", title: "Rondo alla Turca", composer: "Mozart", year: 1783, set: "classical", key: "Am", duration: 200 },
  ],
} as unknown as Catalog;
const jingles = {
  params: [],
  jingles: [{ id: "jingle-1", title: "Jingle 1", composer: "Rail Island", year: 2026, key: "D", duration: 6.7, source: "Piano recording" }],
} as unknown as JingleCatalog;
const rows = buildRows(catalog, jingles, SOUNDS.map(soundMeta));

describe("the list", () => {
  it("holds every piece, jingle and sound effect, in that order", () => {
    expect(rows.map((r) => r.kind)).toEqual(["piece", "piece", "jingle", ...SOUNDS.map(() => "effect")]);
    expect(rows.find((r) => r.id === "waterfall")).toMatchObject({ group: "water", groupTitle: "Water", duration: null });
  });

  it("filters by kind, and by group within a kind", () => {
    expect(filterRows(rows, "", "jingle", "").map((r) => r.id)).toEqual(["jingle-1"]);
    expect(filterRows(rows, "", "piece", "ragtime").map((r) => r.id)).toEqual(["maple-leaf-rag"]);
    expect(filterRows(rows, "", "effect", "water").every((r) => r.group === "water")).toBe(true);
    // a group only narrows a chosen kind
    expect(filterRows(rows, "", "", "ragtime")).toHaveLength(rows.length);
  });

  it("searches every word across title, composer, kind, group and description", () => {
    expect(filterRows(rows, "joplin", "", "").map((r) => r.id)).toEqual(["maple-leaf-rag"]);
    expect(filterRows(rows, "bell", "", "").map((r) => r.id)).toEqual(["crossing-bell"]);
    expect(filterRows(rows, "sound effect ship", "", "").map((r) => r.id)).toEqual(["ship-horn"]);
    expect(filterRows(rows, "maple turca", "", "")).toEqual([]);
  });

  it("offers a kind's groups as chips only when it has more than one", () => {
    expect(groupsOf(rows, "").length).toBe(0);
    expect(groupsOf(rows, "jingle").length).toBe(0);
    expect(groupsOf(rows, "piece").map((g) => g.id)).toEqual(["ragtime", "classical"]);
    expect(groupsOf(rows, "effect").map((g) => g.id)).toEqual(["trains", "ships", "water", "editor"]);
  });
});
