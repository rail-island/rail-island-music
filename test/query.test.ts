import { describe, expect, it } from "vitest";
import { formatTime, parseView, serializeView } from "../src/query.ts";

describe("query string", () => {
  it("round-trips a piece's view and drops unknown parameter values", () => {
    const v = parseView("?q=rag&kind=piece&set=ragtime&piece=maple-leaf-rag&ensemble=chiptune&key=%2B2&tempo=fast&t=12.5");
    expect(v).toEqual({
      q: "rag",
      kind: "piece",
      set: "ragtime",
      item: { kind: "piece", id: "maple-leaf-rag" },
      params: { ensemble: "chiptune", key: "+2" },
      t: 12.5,
    });
    expect(parseView(serializeView(v))).toEqual(v);
  });

  it("opens a jingle with its version, and a sound effect without parameters", () => {
    const j = parseView("?jingle=jingle-3&version=rewrite&length=long");
    expect(j.item).toEqual({ kind: "jingle", id: "jingle-3" });
    expect(j.params).toEqual({ version: "rewrite", length: "long" });
    expect(parseView(serializeView(j))).toEqual(j);
    const s = parseView("?kind=effect&set=water&sound=waterfall&ensemble=piano");
    expect(s.item).toEqual({ kind: "effect", id: "waterfall" });
    expect(s.params).toEqual({});
    expect(serializeView(s)).toBe("?kind=effect&set=water&sound=waterfall");
  });

  it("lands the old Sounds page link on the list of sound effects", () => {
    const v = parseView("?sounds&piece=maple-leaf-rag");
    expect(v.kind).toBe("effect");
    expect(v.item).toBeNull();
    expect(serializeView(v)).toBe("?kind=effect");
  });

  it("formats times", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(125.9)).toBe("2:05");
  });
});
