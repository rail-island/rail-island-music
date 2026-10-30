// Render an arrangement's score to a PNG headlessly, with the same abcjs the
// site uses (docs/guide/setup-and-build.md):
//
//   pnpm exec tsx generator/renderNotation.ts <piece id> <out.png> [param=value ...] [--bars=N] [--width=PX]
//
// `--bars` keeps the first N bars (default 16). Needs Playwright's Chromium
// (pre-installed in the cloud sessions; not a dependency of this repository).

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { writeAbc } from "../lib/abcWrite.ts";
import { arrange } from "../lib/arrange.ts";
import { resolveParams } from "../lib/params.ts";
import type { Performance } from "../lib/performance.ts";
import { launchChromium } from "./headless.ts";
import { loadPieces } from "./scores.ts";

/** The first `count` bars of a performance. */
export function sliceBars(perf: Performance, count: number): Performance {
  if (count >= perf.bars.length) return perf;
  const end = perf.bars[count]!;
  const keep = <T extends [number, ...unknown[]]>(list: T[]) => list.filter((x) => x[0] < end);
  return {
    ...perf,
    bars: perf.bars.slice(0, count),
    length: end,
    tempos: keep(perf.tempos),
    meters: keep(perf.meters),
    keys: keep(perf.keys),
    chords: keep(perf.chords),
    tracks: perf.tracks.map((t) => {
      const notes: number[] = [];
      for (let i = 0; i < t.notes.length; i += 4) {
        if (t.notes[i]! < end) notes.push(t.notes[i]!, Math.min(t.notes[i + 1]!, end - t.notes[i]!), t.notes[i + 2]!, t.notes[i + 3]!);
      }
      return { ...t, notes };
    }),
  };
}

async function main(): Promise<void> {
  const [id, out, ...rest] = process.argv.slice(2);
  if (!id || !out) throw new Error("usage: renderNotation.ts <piece id> <out.png> [param=value ...] [--bars=N] [--width=PX]");
  const piece = loadPieces().find((p) => p.meta.id === id);
  if (!piece) throw new Error(`No piece ${id}`);
  const overrides: Record<string, string> = {};
  let bars = 16;
  let width = 1000;
  for (const r of rest) {
    if (r.startsWith("--bars=")) bars = Number(r.slice(7));
    else if (r.startsWith("--width=")) width = Number(r.slice(8));
    else {
      const [k, v] = r.split("=");
      overrides[k!] = v!;
    }
  }
  const perf = sliceBars(arrange(piece.meta, piece.score, resolveParams(piece.meta, overrides)), bars);
  const abc = writeAbc(perf);
  const abcjs = readFileSync(createRequire(import.meta.url).resolve("abcjs/dist/abcjs-basic-min.js"), "utf8");
  const browser = await launchChromium();
  try {
    const page = await browser.newPage({ viewport: { width: width + 40, height: 400 }, deviceScaleFactor: 2 });
    await page.setContent(`<!doctype html><body style="margin:0;background:#fff"><div id="score" style="width:${width}px;padding:20px"></div></body>`);
    await page.addScriptTag({ content: abcjs });
    await page.evaluate(
      ({ abc, width }: { abc: string; width: number }) => {
        const w = window as unknown as { ABCJS: { renderAbc: (el: string, abc: string, o: object) => unknown } };
        w.ABCJS.renderAbc("score", abc, { staffwidth: width - 20, add_classes: true, wrap: undefined });
      },
      { abc, width },
    );
    await page.locator("#score").screenshot({ path: out });
    console.log(`${out}: ${id} ${JSON.stringify(perf.params)} ${perf.bars.length} bars`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1]?.endsWith("renderNotation.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
