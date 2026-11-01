// Render one sound design to an audio file headlessly, through the very design
// code the game imports (docs/sounds/sounds.md):
//
//   pnpm exec tsx generator/renderSound.ts <sound id> <out.wav|out.mp3> [param=value ...] [--seconds=N] [--at=S:param=value ...]
//
// A one-shot plays once at 0; a loop starts at 0 and is ticked for the whole
// length, as the game ticks it. `--at=S:param=value` changes a loop's value at S
// seconds (a diesel's `--at=8:state=stop`); the loop is then ticked every 50 ms
// with the changes set as they come, as the game would. Numbers are parsed as numbers, anything else is a
// choice. Needs ffmpeg for MP3 and Playwright's Chromium (pre-installed in the
// cloud sessions; not a dependency of this repository). Nothing is served: the
// designs are bundled in memory and rendered in an OfflineAudioContext.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { soundById } from "../sounds/index.ts";
import type { SoundValues } from "../sounds/types.ts";
import { launchChromium } from "./headless.ts";

const RATE = 44100;

async function main(): Promise<void> {
  const [id, out, ...rest] = process.argv.slice(2);
  if (!id || !out) throw new Error("usage: renderSound.ts <sound id> <out.wav|out.mp3> [param=value ...] [--seconds=N]");
  const design = soundById(id);
  if (!design) throw new Error(`No sound ${id}`);
  const values: SoundValues = {};
  let seconds = design.kind === "loop" ? 4 : 3;
  const changes: Array<{ at: number; values: SoundValues }> = [];
  const parse = (into: SoundValues, kv: string) => {
    const [k, v] = kv.split("=");
    into[k!] = v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : v!;
  };
  for (const r of rest) {
    if (r.startsWith("--seconds=")) seconds = Number(r.slice(10));
    else if (r.startsWith("--at=")) {
      const [at, kv] = r.slice(5).split(":");
      const change: SoundValues = {};
      parse(change, kv!);
      changes.push({ at: Number(at), values: change });
    } else parse(values, r);
  }
  changes.sort((a, b) => a.at - b.at);
  const bundle = buildSync({
    entryPoints: ["sounds/index.ts"],
    bundle: true,
    format: "iife",
    globalName: "RailIslandSounds",
    target: "es2020",
    write: false,
  }).outputFiles[0]!.text;

  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><title>render</title>");
    await page.addScriptTag({ content: bundle });
    const b64: string = await page.evaluate(
      async ({
        id,
        values,
        seconds,
        rate,
        changes,
      }: {
        id: string;
        values: SoundValues;
        seconds: number;
        rate: number;
        changes: Array<{ at: number; values: SoundValues }>;
      }) => {
        type Mod = typeof import("../sounds/index.ts");
        const mod = (window as unknown as { RailIslandSounds: Mod }).RailIslandSounds;
        const d = mod.soundById(id)!;
        const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
        const comp = ctx.createDynamicsCompressor();
        comp.connect(ctx.destination);
        if (d.kind === "oneShot") d.play(ctx, comp, 0, values);
        else {
          const v = d.start(ctx, comp, 0, values);
          if (changes.length === 0) v.tick(0, seconds);
          else {
            let current = { ...values };
            let i = 0;
            for (let now = 0; now < seconds; now += 0.05) {
              while (i < changes.length && changes[i]!.at <= now) current = { ...current, ...changes[i++]!.values };
              v.set(current);
              v.tick(now, 0.2);
            }
          }
        }
        const buf = await ctx.startRendering();
        const l = buf.getChannelData(0);
        const r = buf.getChannelData(1);
        const pcm = new Int16Array(buf.length * 2);
        for (let i = 0; i < buf.length; i++) {
          pcm[2 * i] = Math.max(-1, Math.min(1, l[i]!)) * 32767;
          pcm[2 * i + 1] = Math.max(-1, Math.min(1, r[i]!)) * 32767;
        }
        let s = "";
        const bytes = new Uint8Array(pcm.buffer);
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      },
      { id, values, seconds, rate: RATE, changes },
    );
    const pcm = Buffer.from(b64, "base64");
    const wav = Buffer.concat([wavHeader(pcm.length / 4), pcm]);
    if (out.endsWith(".wav")) writeFileSync(out, wav);
    else {
      const tmp = out + ".tmp.wav";
      writeFileSync(tmp, wav);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-c:a", "libmp3lame", "-b:a", "160k", out]);
      execFileSync("rm", [tmp]);
    }
    console.log(`${out}: ${id} ${JSON.stringify(values)} ${JSON.stringify(changes)} ${seconds} s`);
  } finally {
    await browser.close();
  }
}

function wavHeader(frames: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + frames * 4, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(frames * 4, 40);
  return h;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
