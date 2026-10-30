// The site's music: the catalog, arranging a piece in the browser from its
// source score with the generator's own code, and the one shared player.

import { createSignal } from "solid-js";
import { type Score, parseAbc } from "../lib/abcParse.ts";
import { writeAbc } from "../lib/abcWrite.ts";
import { arrange } from "../lib/arrange.ts";
import type { Catalog, CatalogEntry } from "../lib/catalog.ts";
import type { Params } from "../lib/params.ts";
import { type Performance, tickToSeconds } from "../lib/performance.ts";
import { Player } from "../synth/player.ts";

export async function loadCatalog(): Promise<Catalog> {
  const res = await fetch("/catalog.json");
  // `vite` serves index.html for a missing file, so check the type as well.
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) {
    throw new Error("The catalog is missing - run `pnpm build:music` first.");
  }
  return (await res.json()) as Catalog;
}

const scores = new Map<string, Promise<Score>>();

function loadScore(id: string): Promise<Score> {
  let p = scores.get(id);
  if (!p) {
    p = fetch(`/scores/${id}.abc`).then(async (r) => {
      if (!r.ok) throw new Error(`The score of ${id} is missing.`);
      return parseAbc(await r.text());
    });
    scores.set(id, p);
  }
  return p;
}

export interface Arrangement {
  perf: Performance;
  abc: string;
  /** Start of every bar in seconds. */
  barTimes: number[];
}

/** Arrange a piece with the given parameters (same code and result as the generator's export). */
export async function arrangePiece(entry: CatalogEntry, params: Params): Promise<Arrangement> {
  const score = await loadScore(entry.id);
  const perf = arrange(entry, score, params);
  return { perf, abc: writeAbc(perf), barTimes: perf.bars.map((t) => tickToSeconds(perf, t)) };
}

// The player and its state, shared by the piece page and the mini player.
let player: Player | null = null;
const [nowPlaying, setNowPlaying] = createSignal<{ entry: CatalogEntry; arrangement: Arrangement } | null>(null);
const [playing, setPlaying] = createSignal(false);
const [position, setPosition] = createSignal(0);
const [loading, setLoading] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

const VOLUME_KEY = "rail-island-music.volume";
function readVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return localStorage.getItem(VOLUME_KEY) !== null && v >= 0 && v <= 1 ? v : 0.8;
  } catch {
    return 0.8;
  }
}
const [volume, setVolumeSignal] = createSignal(readVolume());

export { error, loading, nowPlaying, playing, position, volume };

function ensurePlayer(): Player {
  if (!player) {
    player = new Player({ samplesUrl: "/samples/" });
    player.setVolume(volume());
    player.onEnded = () => {
      setPlaying(false);
      setPosition(0);
    };
    const tick = () => {
      if (player?.playing) setPosition(player.position);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  return player;
}

export async function play(entry: CatalogEntry, arrangement: Arrangement, from: number): Promise<void> {
  const p = ensurePlayer();
  setError(null);
  setLoading(true);
  try {
    setNowPlaying({ entry, arrangement });
    await p.play(arrangement.perf, from);
    setPosition(from);
    setPlaying(true);
  } catch (e) {
    setError((e as Error).message);
    setPlaying(false);
  } finally {
    setLoading(false);
  }
}

export function pause(): void {
  if (!player) return;
  player.pause();
  setPosition(player.position);
  setPlaying(false);
}

export function stop(): void {
  if (!player) return;
  player.stop();
  setPosition(0);
  setPlaying(false);
}

/** Jump to `seconds` in the current performance, playing on if it was playing. */
export function seek(seconds: number): void {
  const now = nowPlaying();
  if (!now) return;
  if (playing()) void play(now.entry, now.arrangement, seconds);
  else setPosition(seconds);
}

export function setVolume(v: number): void {
  setVolumeSignal(v);
  player?.setVolume(v);
  try {
    localStorage.setItem(VOLUME_KEY, String(v));
  } catch {
    // storage blocked: the volume lasts for this visit only
  }
}
