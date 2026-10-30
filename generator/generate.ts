// `pnpm build:music`: writes the export folder (docs/music/export.md) - the
// catalog, the source scores, every piece's default arrangement as note data
// and as ABC, the synth bundle and the samples. Deterministic: the same
// sources give the same bytes.

import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSync } from "esbuild";
import { writeAbc } from "../lib/abcWrite.ts";
import { arrange } from "../lib/arrange.ts";
import { catalogEntry } from "../lib/catalog.ts";
import { PARAMS, SETS } from "../lib/params.ts";
import type { SampleManifest } from "../synth/instruments.ts";
import { loadPieces } from "./scores.ts";

export const EXPORT_DIR = "export";

/** The drum sample each General MIDI percussion number plays. */
const DRUM_SAMPLES: Record<string, string> = { "36": "kick", "38": "snare", "49": "crash", "51": "ride" };

function main(): void {
  const out = EXPORT_DIR;
  rmSync(out, { recursive: true, force: true });
  for (const d of ["music", "scores", "samples", "synth"]) mkdirSync(join(out, d), { recursive: true });

  const pieces = loadPieces();
  const entries = [];
  for (const p of pieces) {
    const perf = arrange(p.meta, p.score, p.meta.defaults);
    writeFileSync(join(out, "music", `${p.meta.id}.json`), JSON.stringify(perf) + "\n");
    writeFileSync(join(out, "music", `${p.meta.id}.abc`), writeAbc(perf));
    writeFileSync(join(out, "scores", `${p.meta.id}.abc`), p.abc);
    entries.push(catalogEntry(p.meta, p.score, perf));
    console.log(`${p.meta.id.padEnd(28)} ${perf.duration.toFixed(0).padStart(4)} s  ${perf.bars.length} bars`);
  }
  writeFileSync(join(out, "catalog.json"), JSON.stringify({ params: PARAMS, sets: SETS, pieces: entries }, null, 1) + "\n");

  // Samples and their manifest.
  const manifest: SampleManifest = { pitched: {}, drums: DRUM_SAMPLES };
  for (const inst of readdirSync("samples", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    mkdirSync(join(out, "samples", inst), { recursive: true });
    const files = readdirSync(join("samples", inst)).filter((f) => f.endsWith(".mp3")).sort();
    for (const f of files) copyFileSync(join("samples", inst, f), join(out, "samples", inst, f));
    if (inst !== "drums") manifest.pitched[inst] = files.map((f) => Number(f.replace(".mp3", ""))).sort((a, b) => a - b);
  }
  copyFileSync(join("samples", "SOURCES.md"), join(out, "samples", "SOURCES.md"));
  writeFileSync(join(out, "samples", "samples.json"), JSON.stringify(manifest) + "\n");

  buildSync({
    entryPoints: ["synth/index.ts"],
    bundle: true,
    format: "esm",
    target: "es2020",
    outfile: join(out, "synth", "synth.js"),
    legalComments: "none",
  });
  console.log(`${pieces.length} pieces -> ${out}/`);
}

main();
