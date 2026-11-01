// What each sound design costs (docs/sounds/sounds.md, "Metrics"): the size of
// its own minified code and the Web Audio nodes it creates, counted against a
// stub context at its defaults. The build writes them into sounds.meta.json and
// the site's table shows them, the way the factory's table shows a model's JS
// size and triangles. Deterministic: no timing, no randomness.

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSync } from "esbuild";
import { resolveValues } from "../sounds/index.ts";
import type { SoundDesign, SoundMetrics } from "../sounds/types.ts";

const DESIGNS_DIR = "sounds/designs";

/** How long a loop is ticked to count the nodes it keeps creating. */
export const LOOP_SECONDS = 10;
/** The game's frame step and lookahead, as the site's audition ticks a loop. */
const TICK = 0.05;
const HORIZON = 0.2;

/** A context whose nodes do nothing but count themselves. */
export function countingContext(): { ctx: BaseAudioContext; dest: AudioNode; count: () => number } {
  let nodes = 0;
  const param = () => ({
    value: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    cancelScheduledValues: () => {},
    cancelAndHoldAtTime: () => {},
    setTargetAtTime: () => {},
  });
  const node = () => ({
    connect: (to: unknown) => to,
    disconnect: () => {},
    frequency: param(),
    detune: param(),
    gain: param(),
    Q: param(),
    playbackRate: param(),
    type: "",
    buffer: null as unknown,
    loop: false,
    start: () => {},
    stop: () => {},
    setPeriodicWave: () => {},
  });
  const make = () => {
    nodes++;
    return node();
  };
  const ctx = {
    sampleRate: 48000,
    currentTime: 0,
    createGain: make,
    createBiquadFilter: make,
    createOscillator: make,
    createBufferSource: make,
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createPeriodicWave: () => ({}),
  } as unknown as BaseAudioContext;
  return { ctx, dest: node() as unknown as AudioNode, count: () => nodes };
}

const round = (v: number, places: number) => Number(v.toFixed(places));

/** The nodes a design creates at its defaults, and a one-shot's length. */
export function audioMetrics(d: SoundDesign): Pick<SoundMetrics, "nodesAtStart" | "nodesPerSecond" | "seconds"> {
  const { ctx, dest, count } = countingContext();
  const values = resolveValues(d.params, {});
  if (d.kind === "oneShot") {
    const voice = d.play(ctx, dest, 0, values);
    return { nodesAtStart: count(), nodesPerSecond: null, seconds: round(voice.endsAt, 2) };
  }
  const voice = d.start(ctx, dest, 0, values);
  const atStart = count();
  const steps = Math.round(LOOP_SECONDS / TICK);
  for (let i = 0; i <= steps; i++) voice.tick(i * TICK, HORIZON);
  voice.stop(LOOP_SECONDS);
  return { nodesAtStart: atStart, nodesPerSecond: round((count() - atStart) / LOOP_SECONDS, 1), seconds: null };
}

/** Each design's module file and export name, found by identity in sounds/designs/. */
export async function designExports(): Promise<Map<SoundDesign, { file: string; name: string }>> {
  const out = new Map<SoundDesign, { file: string; name: string }>();
  for (const file of readdirSync(DESIGNS_DIR).filter((f) => f.endsWith(".ts")).sort()) {
    const mod = (await import(pathToFileURL(join(process.cwd(), DESIGNS_DIR, file)).href)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod).sort(([a], [b]) => a.localeCompare(b))) {
      if (value && typeof value === "object" && "id" in value && "kind" in value) out.set(value as SoundDesign, { file, name });
    }
  }
  return out;
}

/**
 * Minified bytes of one design bundled alone: its own code and the shared nodes
 * it uses. Every design call (`oneShot(...)`, `loop(...)`) carries a PURE annotation,
 * which lets esbuild drop the designs beside it in the same module.
 */
export function designJsBytes(file: string, name: string): number {
  const result = buildSync({
    stdin: { contents: `export { ${name} } from "./${DESIGNS_DIR}/${file}";`, resolveDir: process.cwd(), loader: "ts" },
    bundle: true,
    format: "esm",
    target: "es2020",
    minify: true,
    write: false,
    legalComments: "none",
  });
  return result.outputFiles[0]!.contents.length;
}

/** Every metric of every design in `designs`, by id. */
export async function measureSounds(designs: readonly SoundDesign[]): Promise<Map<string, SoundMetrics>> {
  const exports = await designExports();
  const out = new Map<string, SoundMetrics>();
  for (const d of designs) {
    const where = exports.get(d);
    if (!where) throw new Error(`sound ${d.id} is not exported from ${DESIGNS_DIR}/`);
    out.set(d.id, { jsBytes: designJsBytes(where.file, where.name), ...audioMetrics(d), params: d.params.length });
  }
  return out;
}
