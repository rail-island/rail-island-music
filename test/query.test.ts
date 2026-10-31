import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../lib/catalog.ts";
import { filterPieces, formatTime, parseView, serializeView } from "../src/query.ts";

describe("query string", () => {
  it("round-trips the view and drops unknown parameter values", () => {
    const v = parseView("?q=rag&set=ragtime&piece=maple-leaf-rag&ensemble=chiptune&key=%2B2&tempo=fast&t=12.5");
    expect(v).toEqual({ q: "rag", set: "ragtime", piece: "maple-leaf-rag", params: { ensemble: "chiptune", key: "+2" }, t: 12.5 });
    expect(parseView(serializeView(v))).toEqual(v);
  });

  it("opens the Sounds page from ?sounds, whatever else is there", () => {
    const v = parseView("?sounds&piece=maple-leaf-rag");
    expect(v.sounds).toBe(true);
    expect(serializeView(v)).toBe("?sounds");
    expect(parseView("?piece=maple-leaf-rag").sounds).toBeUndefined();
  });

  it("filters by words and set", () => {
    const e = (title: string, composer: string, set: string) => ({ title, composer, set, year: 1900 }) as CatalogEntry;
    const list = [e("Maple Leaf Rag", "Scott Joplin", "ragtime"), e("Rondo alla Turca", "Mozart", "classical")];
    expect(filterPieces(list, "joplin", "").map((p) => p.title)).toEqual(["Maple Leaf Rag"]);
    expect(filterPieces(list, "", "classical").map((p) => p.title)).toEqual(["Rondo alla Turca"]);
    expect(filterPieces(list, "maple turca", "")).toEqual([]);
  });

  it("formats times", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(125.9)).toBe("2:05");
  });
});
