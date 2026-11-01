import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../sounds/index.ts";
import { parseView, serializeView } from "../src/query.ts";

const CATS = CATEGORIES.map((c) => c.id);

describe("query string", () => {
  it("round-trips the list's filters and the open sound", () => {
    const v = parseView("?q=horn&cat=trains&kind=oneShot&sound=loco-horn", CATS);
    expect(v).toEqual({ q: "horn", cat: "trains", kind: "oneShot", sound: "loco-horn" });
    expect(parseView(serializeView(v), CATS)).toEqual(v);
  });

  it("drops an unknown category or kind", () => {
    expect(parseView("?cat=pianos&kind=piece", CATS)).toEqual({ q: "", cat: "", kind: "", sound: null });
  });

  it("lands the links of the old music site on the list of sounds", () => {
    // the sound list filtered by its old group chip
    const s = parseView("?kind=effect&set=water&sound=waterfall", CATS);
    expect(s).toEqual({ q: "", cat: "water", kind: "", sound: "waterfall" });
    expect(serializeView(s)).toBe("?cat=water&sound=waterfall");
    // a piece, a jingle and the old Sounds page open the list
    expect(parseView("?piece=maple-leaf-rag&ensemble=piano", CATS).sound).toBeNull();
    expect(parseView("?jingle=jingle-1", CATS).sound).toBeNull();
    expect(parseView("?sounds", CATS)).toEqual({ q: "", cat: "", kind: "", sound: null });
  });
});
