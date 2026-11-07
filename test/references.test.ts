// The reference recordings (src/references.ts, docs/sounds/references.md): every
// listed excerpt is in references/ and served, every file there is listed, they
// belong to real sounds, stay small, and carry a licence free to keep and play.

import { readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SOUNDS, soundById } from "../sounds/index.ts";
import { REFERENCES, allReferences, licenceUrl, referenceUrl, referencesFor } from "../src/references.ts";

const DIR = "references";

describe("the reference recordings", () => {
  it("belong to sounds that exist", () => {
    for (const id of Object.keys(REFERENCES)) expect(soundById(id), id).toBeDefined();
  });

  it("are each a file in references/, served by the site, and every file there is listed", () => {
    const files = readdirSync(DIR).filter((f) => !f.startsWith(".")).sort();
    expect(allReferences().map((r) => r.file)).toEqual(files);
    for (const r of allReferences()) expect(referenceUrl(r), r.file).toBeTruthy();
  });

  it("stay small enough for git: a short mono excerpt each", () => {
    let total = 0;
    for (const r of allReferences()) {
      const bytes = statSync(`${DIR}/${r.file}`).size;
      expect(bytes, r.file).toBeLessThan(400_000);
      expect(r.file).toMatch(/^[a-z0-9-]+\.mp3$/);
      total += bytes;
    }
    expect(total).toBeLessThan(6_000_000);
  });

  it("say where they came from, under a free licence", () => {
    for (const r of allReferences()) {
      expect(r.source.url, r.file).toMatch(/^https:\/\//);
      expect(r.source.author.length).toBeGreaterThan(0);
      expect(licenceUrl(r.source.licence)).toMatch(/^https:\/\/creativecommons\.org\//);
    }
  });

  it("give every diesel engine at least one, and a sound without any none", () => {
    for (const s of SOUNDS.filter((d) => d.id.startsWith("diesel-engine-"))) expect(referencesFor(s.id).length, s.id).toBeGreaterThan(0);
    expect(referencesFor("woods")).toEqual([]);
  });
});
