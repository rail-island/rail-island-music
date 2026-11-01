import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { motion } from "../lib/sfx/scene.ts";
import { SOUNDS, renderSound } from "../lib/sfx/sounds.ts";
import { TRAM_BELL_PARTIALS, steamEngine, tramBell } from "../lib/sfx/sources.ts";

/** Low rate keeps the whole catalog fast to compute in the tests. */
const RATE = 8000;

function peakDb(ch: Float32Array): number {
  let p = 0;
  for (const v of ch) p = Math.max(p, Math.abs(v));
  return 20 * Math.log10(p);
}

/** Magnitude of the Hann-windowed DFT of `x` at frequency f. */
function magnitude(x: Float32Array, f: number, rate: number): number {
  let re = 0;
  let im = 0;
  const n = x.length;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    const ph = (2 * Math.PI * f * i) / rate;
    re += x[i]! * w * Math.cos(ph);
    im += x[i]! * w * Math.sin(ph);
  }
  return Math.hypot(re, im);
}

describe("sounds catalog", () => {
  it("has unique ids, and every sound keeps its references and SOURCES.md", () => {
    expect(new Set(SOUNDS.map((s) => s.id)).size).toBe(SOUNDS.length);
    for (const s of SOUNDS) {
      const dir = join("sounds", s.id);
      expect(existsSync(join(dir, "SOURCES.md")), s.id).toBe(true);
      const sources = readFileSync(join(dir, "SOURCES.md"), "utf8");
      const refs = readdirSync(dir).filter((f) => f !== "SOURCES.md");
      expect(refs.length, s.id).toBeGreaterThan(0);
      for (const f of refs) expect(sources, `${s.id}: ${f} is listed`).toContain(f);
    }
  });

  it("rejects an unknown sound or variant", () => {
    expect(() => renderSound("no-such-train", "pass")).toThrow();
    expect(() => renderSound("shinkansen", "horn")).toThrow();
    expect(() => renderSound("tram-bell", "pass")).toThrow();
  });

  for (const s of SOUNDS)
    for (const v of s.variants)
      it(`${s.id} ${v.id}: renders, normalised, of a sensible length`, () => {
        const out = renderSound(s.id, v.id, RATE);
        const seconds = out.left.length / RATE;
        expect(seconds).toBeGreaterThan(1.5);
        expect(seconds).toBeLessThan(40);
        expect(out.right.length).toBe(out.left.length);
        const finite = [out.left, out.right].every((ch) => ch.every((x) => Number.isFinite(x)));
        expect(finite).toBe(true);
        expect(Math.max(peakDb(out.left), peakDb(out.right))).toBeCloseTo(-1, 1);
      });

  it("is deterministic", () => {
    const a = renderSound("diesel-locomotive", "horn", RATE);
    const b = renderSound("diesel-locomotive", "horn", RATE);
    expect(Buffer.from(a.left.buffer).equals(Buffer.from(b.left.buffer))).toBe(true);
    expect(Buffer.from(a.right.buffer).equals(Buffer.from(b.right.buffer))).toBe(true);
  });
});

describe("sound models", () => {
  it("tram bell: rings the measured partials at the measured levels", () => {
    const rate = 32000;
    const ring = tramBell([[0, 2.5]], 0.2, rate, 1).subarray(rate * 0.5, rate * 2.5);
    const ref = magnitude(ring, 6230, rate);
    for (const p of TRAM_BELL_PARTIALS) {
      const db = 20 * Math.log10(magnitude(ring, p.f, rate) / ref);
      expect(Math.abs(db - p.db), `${p.f} Hz`).toBeLessThan(8);
    }
    // Between the partials there is next to nothing.
    expect(20 * Math.log10(magnitude(ring, 4900, rate) / ref)).toBeLessThan(-30);
  });

  it("steam: four chuffs per turn of the driving wheels", () => {
    const v = 10;
    const x = steamEngine(motion(0, () => v, 6), () => 1, -10, RATE, 1);
    // Envelope at 200 Hz, then the lag of its autocorrelation peak.
    const hop = RATE / 200;
    const env: number[] = [];
    for (let i = 0; i + hop <= x.length; i += hop) {
      let e = 0;
      for (let k = 0; k < hop; k++) e += Math.abs(x[i + k]!);
      env.push(e);
    }
    const mean = env.reduce((a, b) => a + b, 0) / env.length;
    const c = env.map((e) => e - mean);
    const corr = (lag: number) => {
      let s = 0;
      for (let i = 0; i + lag < c.length; i++) s += c[i]! * c[i + lag]!;
      return s;
    };
    const ac = Array.from({ length: 100 }, (_, lag) => corr(lag) / corr(0));
    // The first clear peak: the beats are uneven, so every second one repeats more exactly.
    let lag = 8;
    while (lag < 99 && !(ac[lag]! > 0.3 && ac[lag]! >= ac[lag - 1]! && ac[lag]! >= ac[lag + 1]!)) lag++;
    const perSecond = 200 / lag;
    expect(perSecond).toBeCloseTo((4 * v) / (Math.PI * 1.75), 0);
  });

  it("shinkansen pass: loudest while the train is beside the listener", () => {
    const out = renderSound("shinkansen", "pass", RATE);
    const n = out.left.length;
    const win = RATE / 4;
    let best = 0;
    let at = 0;
    for (let i = 0; i + win <= n; i += win) {
      let e = 0;
      for (let k = 0; k < win; k++) e += out.left[i + k]! ** 2 + out.right[i + k]! ** 2;
      if (e > best) {
        best = e;
        at = i / RATE;
      }
    }
    // It reaches the listener after 9 s and takes 402 m / 75 m/s = 5.4 s to pass.
    expect(at).toBeGreaterThan(8.5);
    expect(at).toBeLessThan(15);
  });
});
