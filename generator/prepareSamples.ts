// Turn the VS Chamber Orchestra: Community Edition (VSCO 2 CE, CC0) recordings
// into the synth's small sample set (docs/music/synth.md, samples/SOURCES.md).
// Run by hand when the set changes; its output is committed:
//
//   pnpm exec tsx generator/prepareSamples.ts <path to a VSCO-2-CE checkout>
//
// Each sample is trimmed to its onset, cut to a fixed length with a fade,
// mixed to mono at 32 kHz, peak-normalised to -1 dBFS and encoded as MP3.
// Needs ffmpeg on the PATH.

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

interface Source {
  instrument: string;
  /** MIDI pitch the recording sounds at (VSCO names its files an octave low; checked by pitch detection). */
  out: string;
  file: string;
  seconds: number;
}

// The upright piano's files are numbered by (MIDI pitch - 21) / 2 (its MappingChart.txt).
const piano = [29, 37, 45, 53, 61, 69, 77, 85].map((p) => ({
  instrument: "piano",
  out: String(p),
  file: `Keys/Upright Piano/Player_dyn2_rr1_${String((p - 21) / 2).padStart(3, "0")}.wav`,
  seconds: 3,
}));

/** VSCO note name with its file octave -> MIDI pitch (the files name C4 as "C3"). */
function midiOf(name: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(name)!;
  const pcs: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  return (Number(m[2]) + 2) * 12 + pcs[m[1]!]!;
}

const named = (instrument: string, names: string[], path: (n: string) => string, seconds: number): Source[] =>
  names.map((n) => ({ instrument, out: String(midiOf(n)), file: path(n), seconds }));

const SOURCES: Source[] = [
  ...piano,
  ...named("bass", ["E0", "G0", "A#0", "D1", "F#1", "A1", "C#2", "E2"], (n) => `Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_${n}_v1_rr1.wav`, 1.6),
  ...named("trumpet", ["F2", "A2", "C3", "D#3", "G3", "A#3", "D4", "F4", "A4"], (n) => `Brass/Trumpet/sus/Sum_SHTrumpet_sus_${n}_v3_rr1.wav`, 2.5),
  ...named("trombone", ["A#0", "D#1", "F1", "A#1", "D2", "F2", "C3", "F3"], (n) => `Brass/Tenor Trombone/sus/tenortbn_sus_${n}_v2_1.wav`, 2.5),
  ...named("tuba", ["A#0", "D#1", "F1", "A#1", "D2", "F2", "A#2"], (n) => `Brass/Tuba/stac/Tuba3_stac_${n}_v2_rr1_Sum.wav`, 1),
  ...named("clarinet", ["D2", "F2", "A#2", "D3", "F3", "A#3", "D4", "F4", "A#4"], (n) => `Woodwinds/Clarinet/susLong/DCClar_susLong_${n}_v2_rr1_sum.wav`, 2.5),
  { instrument: "drums", out: "kick", file: "VSCO 1 Percussion/drums/bass/bdrum_f_1.wav", seconds: 0.8 },
  { instrument: "drums", out: "snare", file: "VSCO 1 Percussion/drums/snare/drum1/snare1_f_1.wav", seconds: 0.6 },
  { instrument: "drums", out: "ride", file: "VSCO 1 Percussion/varMetal/Cymbals/susp/susp_hit_metal_2_mf.wav", seconds: 1.2 },
  { instrument: "drums", out: "crash", file: "VSCO 1 Percussion/varMetal/Cymbals/clash/crash_hit_mp_loose.wav", seconds: 2 },
];

function ffmpeg(args: string[]): string {
  return execFileSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function main(): void {
  const vsco = process.argv[2];
  if (!vsco) throw new Error("usage: tsx generator/prepareSamples.ts <VSCO-2-CE checkout>");
  const outDir = "samples";
  for (const inst of new Set(SOURCES.map((s) => s.instrument))) {
    rmSync(join(outDir, inst), { recursive: true, force: true });
    mkdirSync(join(outDir, inst), { recursive: true });
  }
  for (const s of SOURCES) {
    const input = join(vsco, s.file);
    const shape = [
      "silenceremove=start_periods=1:start_threshold=-45dB",
      `atrim=0:${s.seconds}`,
      `afade=t=out:st=${(s.seconds * 0.75).toFixed(3)}:d=${(s.seconds * 0.25).toFixed(3)}`,
    ].join(",");
    // Measure the peak of the shaped sound, then normalise it to -1 dBFS.
    const log = execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostdin -i "$1" -af "$2,volumedetect" -ac 1 -f null - 2>&1`, "sh", input, shape], {
      encoding: "utf8",
    });
    const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(log)?.[1] ?? "0");
    const gain = -1 - peak;
    const out = join(outDir, s.instrument, `${s.out}.mp3`);
    ffmpeg(["-y", "-i", input, "-af", `${shape},volume=${gain.toFixed(2)}dB`, "-ac", "1", "-ar", "32000", "-c:a", "libmp3lame", "-b:a", "80k", "-map_metadata", "-1", out]);
    console.log(`${out}  (${s.file}, ${gain.toFixed(1)} dB)`);
  }
}

main();
