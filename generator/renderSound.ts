// Render a sound effect to an audio file (docs/music/sounds.md). The sounds
// are computed in plain TypeScript (lib/sfx/), so no browser is needed:
//
//   pnpm exec tsx generator/renderSound.ts <sound id> <variant> <out.mp3|out.wav>
//   pnpm exec tsx generator/renderSound.ts --all <folder>
//
// MP3 needs ffmpeg on the PATH.

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Stereo } from "../lib/sfx/dsp.ts";
import { SOUNDS, renderSound } from "../lib/sfx/sounds.ts";

/** 16-bit stereo WAV bytes. */
export function wavBytes(s: Stereo): Buffer {
  const n = s.left.length;
  const b = Buffer.alloc(44 + n * 4);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 4, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(s.rate, 24);
  b.writeUInt32LE(s.rate * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.left[i]!)) * 32767), 44 + i * 4);
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.right[i]!)) * 32767), 46 + i * 4);
  }
  return b;
}

function write(s: Stereo, out: string): void {
  const wav = wavBytes(s);
  if (out.endsWith(".wav")) {
    writeFileSync(out, wav);
    return;
  }
  const tmp = out + ".tmp.wav";
  writeFileSync(tmp, wav);
  try {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-c:a", "libmp3lame", "-b:a", "160k", out]);
  } finally {
    rmSync(tmp, { force: true });
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args[0] === "--all" && args[1]) {
    mkdirSync(args[1], { recursive: true });
    for (const s of SOUNDS)
      for (const v of s.variants) {
        const out = join(args[1], `${s.id}-${v.id}.mp3`);
        const t0 = Date.now();
        const st = renderSound(s.id, v.id);
        write(st, out);
        console.log(`${out}  ${(st.left.length / st.rate).toFixed(1)} s  (${Date.now() - t0} ms)`);
      }
    return;
  }
  const [id, variant, out] = args;
  if (!id || !variant || !out) throw new Error("usage: renderSound.ts <sound id> <variant> <out.mp3|out.wav> | --all <folder>");
  const st = renderSound(id, variant);
  write(st, out);
  console.log(`${out}: ${id} ${variant} ${(st.left.length / st.rate).toFixed(1)} s`);
}

if (process.argv[1]?.endsWith("renderSound.ts")) main();
