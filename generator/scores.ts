// Reads the score sources: scores/<id>/piece.json and scores/<id>/score.abc
// (docs/music/scores.md). Node-only.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type Score, parseAbc } from "../lib/abcParse.ts";
import { PARAMS, type PieceMeta, SETS, isParams } from "../lib/params.ts";

export interface LoadedPiece {
  meta: PieceMeta;
  abc: string;
  score: Score;
}

export const SCORES_DIR = "scores";

const GROOVES = ["oompah", "two-beat", "swing", "waltz"];

/** Every piece, in catalog order: by set, then title. */
export function loadPieces(dir = SCORES_DIR): LoadedPiece[] {
  const out: LoadedPiece[] = [];
  for (const id of readdirSync(dir).sort()) {
    if (id.startsWith(".") || id.endsWith(".md")) continue;
    const meta = JSON.parse(readFileSync(join(dir, id, "piece.json"), "utf8")) as PieceMeta;
    checkMeta(id, meta);
    const abc = readFileSync(join(dir, id, "score.abc"), "utf8");
    let score: Score;
    try {
      score = parseAbc(abc);
    } catch (e) {
      throw new Error(`${id}: ${(e as Error).message}`);
    }
    if (score.title !== meta.title) throw new Error(`${id}: T: "${score.title}" differs from piece.json title "${meta.title}"`);
    out.push({ meta, abc, score });
  }
  const setIndex = (s: string) => SETS.findIndex((x) => x.id === s);
  return out.sort((a, b) => setIndex(a.meta.set) - setIndex(b.meta.set) || a.meta.title.localeCompare(b.meta.title, "en"));
}

function checkMeta(id: string, m: PieceMeta): void {
  const bad = (what: string) => {
    throw new Error(`scores/${id}/piece.json: ${what}`);
  };
  if (m.id !== id) bad(`id "${m.id}" differs from the folder name`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) bad("id is not kebab-case");
  if (!m.title || !m.composer || !m.publicDomain) bad("title, composer and publicDomain are required");
  if (!Number.isInteger(m.year)) bad("year must be an integer");
  if (!SETS.some((s) => s.id === m.set)) bad(`unknown set "${m.set}"`);
  if (!GROOVES.includes(m.groove)) bad(`unknown groove "${m.groove}"`);
  if (!(m.swing >= 0.5 && m.swing <= 0.7)) bad("swing must be between 0.5 and 0.7");
  if (!m.defaults || !isParams(m.defaults)) bad(`defaults must give a valid value for ${PARAMS.map((p) => p.name).join(", ")}`);
}
