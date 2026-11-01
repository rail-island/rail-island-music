// The detail of a sound effect (docs/sounds/sounds.md): its description, its
// parameters as controls, Play (or Start/Stop for a loop) and Defaults, and a
// live spectrogram of what it plays, to audition and tune a design without the
// game. It plays the design from source -- the very code the generator bundles
// into export/sounds/sounds.js -- through one AudioContext of its own, created on
// the first press (browsers start audio only from a gesture). Leaving the page
// stops whatever it still plays (src/audition.ts). Below, the recordings the
// design was matched to (src/ReferenceList.tsx) play through the same chain, so
// the spectrogram shows them too; the design and a recording take turns.

import { For, Show, createSignal, onCleanup } from "solid-js";
import { categoryById } from "../sounds/index.ts";
import type { SoundDesign, SoundParam, SoundValues } from "../sounds/types.ts";
import { type Audition, createAudition } from "./audition";
import { KIND_TITLES } from "./catalogList";
import { ReferenceList } from "./ReferenceList";
import { referencesFor } from "./references";

/** The spectrogram's frequency ceiling (Hz): every sound here lives below it. */
const SPECTRUM_TOP = 8000;

let audio: { ctx: AudioContext; out: GainNode; analyser: AnalyserNode } | null = null;

function output(): { ctx: AudioContext; out: GainNode; analyser: AnalyserNode } {
  if (!audio) {
    const ctx = new AudioContext();
    const out = ctx.createGain();
    out.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    out.connect(comp).connect(analyser).connect(ctx.destination);
    audio = { ctx, out, analyser };
  }
  if (audio.ctx.state === "suspended") void audio.ctx.resume();
  return audio;
}

function defaults(params: readonly SoundParam[]): SoundValues {
  return Object.fromEntries(params.map((p) => [p.name, p.default]));
}

function formatValue(p: SoundParam, v: number | string): string {
  if (p.kind === "choice") return p.values.find((x) => x.value === v)?.title ?? String(v);
  const n = v as number;
  const digits = p.step < 0.1 ? 2 : p.step < 1 ? 1 : 0;
  return `${n.toFixed(digits)}${p.unit ? ` ${p.unit}` : ""}`;
}

/**
 * A scrolling spectrogram on `canvas`: time runs left to right, frequency bottom
 * to top up to SPECTRUM_TOP, loudness as brightness. Drawn only while `active()`
 * says so, so nothing runs while the page is idle; the last picture stays.
 */
function spectrogram(canvas: HTMLCanvasElement, active: () => boolean): () => void {
  const g = canvas.getContext("2d");
  let frame = 0;
  let data: Uint8Array<ArrayBuffer> | null = null;
  const draw = () => {
    frame = 0;
    if (!g || !audio || !active()) return;
    const a = audio.analyser;
    if (!data || data.length !== a.frequencyBinCount) data = new Uint8Array(a.frequencyBinCount);
    a.getByteFrequencyData(data);
    const w = canvas.width;
    const h = canvas.height;
    // scroll one column left, paint the newest column at the right edge
    g.drawImage(canvas, -2, 0);
    const bins = Math.floor((SPECTRUM_TOP / (audio.ctx.sampleRate / 2)) * data.length);
    for (let y = 0; y < h; y++) {
      const v = data[Math.floor((1 - y / h) * (bins - 1))]! / 255;
      g.fillStyle = `hsl(${200 - 160 * v}, 90%, ${6 + 60 * v}%)`;
      g.fillRect(w - 2, y, 2, 1);
    }
    frame = requestAnimationFrame(draw);
  };
  const start = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  return start;
}

export function EffectPage(props: { design: SoundDesign }) {
  const [values, setValues] = createSignal<SoundValues>(defaults(props.design.params));
  const [running, setRunning] = createSignal(false);
  // Until when the spectrogram draws: a loop while it runs, a one-shot until it ends.
  const [drawUntil, setDrawUntil] = createSignal(0);
  const [refPlaying, setRefPlaying] = createSignal(false);
  let audition: Audition | null = null;
  let startDrawing: () => void = () => {};
  // The page's reference players, and those already routed into the context (once each).
  const players: HTMLAudioElement[] = [];
  const routed = new WeakSet<HTMLAudioElement>();

  const active = () => !!audio && (running() || refPlaying() || audio.ctx.currentTime < drawUntil());

  const pauseRefs = (except?: HTMLAudioElement) => {
    for (const p of players) if (p !== except && !p.paused) p.pause();
  };

  const set = (name: string, v: number | string) => {
    setValues({ ...values(), [name]: v });
    audition?.set(values());
  };

  const stopLoop = () => {
    if (!audition || !audio) return;
    audition.stopLoop();
    setDrawUntil(audio.ctx.currentTime + 0.3);
    setRunning(false);
  };
  // Leaving the page silences it: the loop and every one-shot still ringing.
  onCleanup(() => {
    audition?.stopAll();
    pauseRefs();
    setRunning(false);
  });

  // A recording started: through the page's chain to the spectrogram, alone.
  const playRef = (el: HTMLAudioElement) => {
    const { ctx, out } = output();
    if (!routed.has(el)) {
      ctx.createMediaElementSource(el).connect(out);
      routed.add(el);
    }
    pauseRefs(el);
    if (running()) stopLoop();
    setRefPlaying(true);
    startDrawing();
  };

  const press = () => {
    pauseRefs();
    const d = props.design;
    const { ctx, out } = output();
    audition ??= createAudition(ctx, out);
    if (d.kind === "oneShot") {
      const v = audition.playOnce(d, values());
      setDrawUntil(Math.max(drawUntil(), v.endsAt + 0.2));
      startDrawing();
      return;
    }
    if (running()) {
      stopLoop();
      return;
    }
    audition.startLoop(d, values());
    setRunning(true);
    startDrawing();
  };

  return (
    <section class="sound-sound">
      <p class="sound-facts">
        <span>{categoryById(props.design.category)?.title ?? props.design.category}</span>
        <span>{KIND_TITLES[props.design.kind]}</span>
        <code class="sound-id">{props.design.id}</code>
      </p>
      <p class="sound-muted">{props.design.description}</p>
      <div class="sound-params">
        <For each={props.design.params}>
          {(p) => (
            <label class="sound-param">
              <span>
                {p.title}: {formatValue(p, values()[p.name]!)}
              </span>
              <Show
                when={p.kind === "number" ? p : null}
                fallback={
                  <select value={String(values()[p.name])} onChange={(ev) => set(p.name, ev.currentTarget.value)}>
                    <For each={p.kind === "choice" ? p.values : []}>{(c) => <option value={c.value}>{c.title}</option>}</For>
                  </select>
                }
              >
                {(n) => (
                  <input
                    type="range"
                    min={n().min}
                    max={n().max}
                    step={n().step}
                    value={values()[p.name] as number}
                    onInput={(ev) => set(p.name, Number(ev.currentTarget.value))}
                  />
                )}
              </Show>
            </label>
          )}
        </For>
      </div>
      <div class="sound-controls">
        <button class="sound-btn sound-btn--play" onClick={press}>
          {props.design.kind === "oneShot" ? "▶ Play" : running() ? "■ Stop" : "▶ Start"}
        </button>
        <button
          class="sound-btn"
          onClick={() => {
            setValues(defaults(props.design.params));
            audition?.set(values());
          }}
        >
          Defaults
        </button>
      </div>
      <figure class="sound-spectrum">
        <canvas
          width="720"
          height="200"
          aria-label="Spectrogram"
          ref={(el) => {
            startDrawing = spectrogram(el, active);
          }}
        />
        <figcaption class="sound-muted">Spectrogram, 0-8 kHz: time runs left to right, louder is brighter.</figcaption>
      </figure>
      <ReferenceList
        references={referencesFor(props.design.id)}
        register={(el) => players.push(el)}
        onPlay={playRef}
        onPause={() => setRefPlaying(players.some((p) => !p.paused))}
      />
    </section>
  );
}
