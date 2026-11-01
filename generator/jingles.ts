// Reads the jingles (jingles/<id>/jingle.json, score.abc;
// docs/music/jingles.md) and writes the site's copy of them. Node-only.
//
// Jingles are not exported for the game yet: they go to export/site/, which
// only the site reads (jingles.json and jingles/<id>/score.abc), not to the
// catalog.json, music/ and sounds/ the game would import.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Score, parseAbc } from "../lib/abcParse.ts";
import { arrange } from "../lib/arrange.ts";
import { JINGLE_PARAMS, type JingleCatalog, type JingleEntry, type JingleMeta, isJingleParams, jingleAsPiece } from "../lib/jingles.ts";
import { keyName } from "../lib/theory.ts";

export const JINGLES_DIR = "jingles";

const GROOVES = ["oompah", "two-beat", "swing", "waltz"];

export interface LoadedJingle {
  meta: JingleMeta;
  abc: string;
  score: Score;
}

/** Every jingle, in id order (jingle-1, jingle-2, ... numerically). */
export function loadJingles(dir = JINGLES_DIR): LoadedJingle[] {
  const out: LoadedJingle[] = [];
  for (const id of readdirSync(dir)) {
    if (id.startsWith(".") || id.endsWith(".md")) continue;
    const meta = JSON.parse(readFileSync(join(dir, id, "jingle.json"), "utf8")) as JingleMeta;
    checkMeta(id, meta);
    const abc = readFileSync(join(dir, id, "score.abc"), "utf8");
    let score: Score;
    try {
      score = parseAbc(abc);
    } catch (e) {
      throw new Error(`${id}/score.abc: ${(e as Error).message}`);
    }
    if (score.title !== meta.title) throw new Error(`${id}/score.abc: T: "${score.title}" differs from jingle.json title "${meta.title}"`);
    out.push({ meta, abc, score });
  }
  return out.sort((a, b) => a.meta.id.localeCompare(b.meta.id, "en", { numeric: true }));
}

function checkMeta(id: string, m: JingleMeta): void {
  const bad = (what: string) => {
    throw new Error(`jingles/${id}/jingle.json: ${what}`);
  };
  if (m.id !== id) bad(`id "${m.id}" differs from the folder name`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) bad("id is not kebab-case");
  if (!m.title || !m.composer || !m.source) bad("title, composer and source are required");
  if (!Number.isInteger(m.year)) bad("year must be an integer");
  if (!GROOVES.includes(m.groove)) bad(`unknown groove "${m.groove}"`);
  if (!(m.swing >= 0.5 && m.swing <= 0.7)) bad("swing must be between 0.5 and 0.7");
  if (!m.defaults || !isJingleParams(m.defaults)) bad(`defaults must give a valid value for ${JINGLE_PARAMS.map((p) => p.name).join(", ")}`);
}

/** A jingle's list entry: its metadata and its default arrangement's facts. */
export function jingleEntry(j: LoadedJingle): JingleEntry {
  const score = j.score;
  const { piece, params } = jingleAsPiece(j.meta, j.meta.defaults);
  const perf = arrange(piece, score, params);
  return {
    ...j.meta,
    key: keyName(score.key),
    meter: `${score.meter[0]}/${score.meter[1]}`,
    duration: perf.duration,
    bars: perf.bars.length,
  };
}

/** Write the site's copy: export/site/jingles.json and every jingle's score. */
export function writeJingles(out: string): void {
  const jingles = loadJingles();
  const site = join(out, "site");
  const catalog: JingleCatalog = { params: JINGLE_PARAMS, jingles: jingles.map(jingleEntry) };
  for (const j of jingles) {
    mkdirSync(join(site, "jingles", j.meta.id), { recursive: true });
    writeFileSync(join(site, "jingles", j.meta.id, "score.abc"), j.abc);
  }
  writeFileSync(join(site, "jingles.json"), JSON.stringify(catalog, null, 1) + "\n");
  console.log(`${jingles.length} jingles -> ${site}/ (site only)`);
}
