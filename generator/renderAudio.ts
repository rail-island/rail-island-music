// Render an arrangement to an audio file headlessly, through the very synth
// the site and the game use (docs/guide/setup-and-build.md):
//
//   pnpm exec tsx generator/renderAudio.ts <piece or jingle id> <out.mp3|out.wav> [param=value ...] [--seconds=N]
//
// Needs `pnpm build:music` first (it serves export/), ffmpeg for MP3, and
// Playwright's Chromium (pre-installed in the cloud sessions; not a dependency
// of this repository). The browser runs an OfflineAudioContext, so rendering
// is faster than real time and needs no sound card.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { launchChromium } from "./headless.ts";
import { arrangeById } from "./arrangeById.ts";

const RATE = 32000;

const TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".html": "text/html",
};

async function main(): Promise<void> {
  const [id, out, ...rest] = process.argv.slice(2);
  if (!id || !out) throw new Error("usage: renderAudio.ts <piece or jingle id> <out.mp3|out.wav> [param=value ...] [--seconds=N]");
  const overrides: Record<string, string> = {};
  let seconds = Infinity;
  for (const r of rest) {
    if (r.startsWith("--seconds=")) seconds = Number(r.slice(10));
    else {
      const [k, v] = r.split("=");
      overrides[k!] = v!;
    }
  }
  const perf = arrangeById(id, overrides);
  const length = Math.min(perf.duration + 2.5, seconds);

  const root = "export";
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]!)).replace(/^(\.\.[/\\])+/, "");
    if (path === "/" || path === "/index.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><title>render</title>");
      return;
    }
    try {
      const body = readFileSync(join(root, path));
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;

  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    const frames: number = await page.evaluate(
      async ({ perf, length, rate }: { perf: unknown; length: number; rate: number }) => {
        const mod = await import("/synth/synth.js" as string);
        const ctx = new OfflineAudioContext(2, Math.ceil(length * rate), rate);
        const player = new mod.Player({ samplesUrl: "/samples/", context: ctx });
        const buf: AudioBuffer = await player.render(perf);
        (window as unknown as { rendered: AudioBuffer }).rendered = buf;
        return buf.length;
      },
      { perf, length, rate: RATE },
    );
    // Fetch interleaved 16-bit PCM in chunks.
    const pcm = Buffer.alloc(frames * 4);
    const chunk = 1 << 18;
    for (let start = 0; start < frames; start += chunk) {
      const b64: string = await page.evaluate(
        ({ start, chunk }: { start: number; chunk: number }) => {
          const buf = (window as unknown as { rendered: AudioBuffer }).rendered;
          const l = buf.getChannelData(0);
          const r = buf.getChannelData(1);
          const n = Math.min(chunk, buf.length - start);
          const out = new Int16Array(n * 2);
          for (let i = 0; i < n; i++) {
            out[2 * i] = Math.max(-1, Math.min(1, l[start + i]!)) * 32767;
            out[2 * i + 1] = Math.max(-1, Math.min(1, r[start + i]!)) * 32767;
          }
          let s = "";
          const bytes = new Uint8Array(out.buffer);
          for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return btoa(s);
        },
        { start, chunk },
      );
      Buffer.from(b64, "base64").copy(pcm, start * 4);
    }
    const wav = Buffer.concat([wavHeader(frames), pcm]);
    if (out.endsWith(".wav")) writeFileSync(out, wav);
    else {
      const tmp = out + ".tmp.wav";
      writeFileSync(tmp, wav);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-c:a", "libmp3lame", "-b:a", "128k", out]);
      execFileSync("rm", [tmp]);
    }
    console.log(`${out}: ${id} ${JSON.stringify(perf.params)} ${(frames / RATE).toFixed(1)} s`);
  } finally {
    await browser.close();
    server.close();
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
