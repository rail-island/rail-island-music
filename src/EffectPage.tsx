// The detail of a sound effect (docs/sounds/sounds.md): its description, its
// parameters as controls, Play (or Start/Stop for a loop) and Defaults, and a
// live spectrogram of what it plays, to audition and tune a design without the
// game. It plays the design from source -- the very code the generator bundles
// into export/sounds/sounds.js -- through one AudioContext of its own, created on
// the first press (browsers start audio only from a gesture).

import { For, Show, createSignal, onCleanup } from "solid-js";
import type { LoopVoice, SoundDesign, SoundParam, SoundValues } from "../sounds/types.ts";
import { CATEGORY_TITLES } from "./catalogList";

/** How far ahead (s) a running loop schedules, and how often it is ticked (ms). */
const HORIZON = 0.2;
const TICK_MS = 50;
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
  let voice: LoopVoice | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let startDrawing: () => void = () => {};

  const active = () => !!audio && (running() || audio.ctx.currentTime < drawUntil());

  const set = (name: string, v: number | string) => {
    setValues({ ...values(), [name]: v });
    voice?.set(values());
  };

  const stopLoop = () => {
    clearInterval(timer);
    timer = undefined;
    if (voice && audio) {
      voice.stop(audio.ctx.currentTime);
      setDrawUntil(audio.ctx.currentTime + 0.3);
    }
    voice = null;
    setRunning(false);
  };
  onCleanup(stopLoop);

  const press = () => {
    const d = props.design;
    const { ctx, out } = output();
    if (d.kind === "oneShot") {
      const v = d.play(ctx, out, ctx.currentTime + 0.02, values());
      setDrawUntil(v.endsAt + 0.2);
      startDrawing();
      return;
    }
    if (running()) {
      stopLoop();
      return;
    }
    const v = d.start(ctx, out, ctx.currentTime + 0.02, values());
    voice = v;
    v.tick(ctx.currentTime, HORIZON);
    timer = setInterval(() => v.tick(ctx.currentTime, HORIZON), TICK_MS);
    setRunning(true);
    startDrawing();
  };

  return (
    <section class="music-sound">
      <p class="music-facts">
        <span>{CATEGORY_TITLES[props.design.category]}</span>
        <span>{props.design.kind === "loop" ? "Loop" : "One-shot"}</span>
        <code class="music-sound__id">{props.design.id}</code>
      </p>
      <p class="music-muted">{props.design.description}</p>
      <div class="music-params">
        <For each={props.design.params}>
          {(p) => (
            <label class="music-param">
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
      <div class="music-controls">
        <button class="music-btn music-btn--play" onClick={press}>
          {props.design.kind === "oneShot" ? "▶ Play" : running() ? "■ Stop" : "▶ Start"}
        </button>
        <button
          class="music-btn"
          onClick={() => {
            setValues(defaults(props.design.params));
            voice?.set(values());
          }}
        >
          Defaults
        </button>
      </div>
      <figure class="music-spectrum">
        <canvas
          width="720"
          height="200"
          aria-label="Spectrogram"
          ref={(el) => {
            startDrawing = spectrogram(el, active);
          }}
        />
        <figcaption class="music-muted">Spectrogram, 0-8 kHz: time runs left to right, louder is brighter.</figcaption>
      </figure>
    </section>
  );
}
