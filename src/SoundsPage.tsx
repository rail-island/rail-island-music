// The Sounds page (`?sounds`, docs/sounds/sounds.md): every sound design the game
// plays, with its parameters as controls, to audition and debug a design without
// the game. It plays the designs from source -- the very code the generator
// bundles into export/sounds/sounds.js -- through one AudioContext of its own,
// created on the first press (browsers start audio only from a gesture).

import { For, Show, createSignal, onCleanup } from "solid-js";
import { SOUNDS } from "../sounds/index.ts";
import type { LoopVoice, SoundDesign, SoundParam, SoundValues } from "../sounds/types.ts";

/** How far ahead (s) a running loop schedules, and how often it is ticked (ms). */
const HORIZON = 0.2;
const TICK_MS = 50;

let audio: { ctx: AudioContext; out: GainNode } | null = null;

function output(): { ctx: AudioContext; out: GainNode } {
  if (!audio) {
    const ctx = new AudioContext();
    const out = ctx.createGain();
    out.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    out.connect(comp).connect(ctx.destination);
    audio = { ctx, out };
  }
  if (audio.ctx.state === "suspended") void audio.ctx.resume();
  return audio;
}

function defaults(params: readonly SoundParam[]): SoundValues {
  return Object.fromEntries(params.map((p) => [p.name, p.default]));
}

function formatValue(p: SoundParam, v: number | string): string {
  if (p.kind === "choice") return String(v);
  const n = v as number;
  const digits = p.step < 0.1 ? 2 : p.step < 1 ? 1 : 0;
  return `${n.toFixed(digits)}${p.unit ? ` ${p.unit}` : ""}`;
}

function SoundCard(props: { design: SoundDesign }) {
  const [values, setValues] = createSignal<SoundValues>(defaults(props.design.params));
  const [running, setRunning] = createSignal(false);
  let voice: LoopVoice | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const set = (name: string, v: number | string) => {
    setValues({ ...values(), [name]: v });
    voice?.set(values());
  };

  const stopLoop = () => {
    clearInterval(timer);
    timer = undefined;
    if (voice && audio) voice.stop(audio.ctx.currentTime);
    voice = null;
    setRunning(false);
  };
  onCleanup(stopLoop);

  const press = () => {
    const d = props.design;
    const { ctx, out } = output();
    if (d.kind === "oneShot") {
      d.play(ctx, out, ctx.currentTime + 0.02, values());
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
  };

  return (
    <section class="music-sound" id={props.design.id}>
      <header class="music-sound__head">
        <h2 class="music-sound__title">{props.design.title}</h2>
        <code class="music-sound__id">{props.design.id}</code>
      </header>
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
          {props.design.kind === "oneShot" ? "Play" : running() ? "Stop" : "Start"}
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
    </section>
  );
}

export function SoundsPage() {
  return (
    <section class="music-sounds">
      <p class="music-muted music-intro">
        Every sound the game makes, synthesized at run time with Web Audio - no recordings. The game imports these designs with
        <code> pnpm import:sounds</code> and sets the parameters itself: a horn's pitch from the locomotive's weight, the exhaust beat
        from its speed. Here each parameter is a control, to audition and tune a design.
      </p>
      <For each={SOUNDS}>{(d) => <SoundCard design={d} />}</For>
    </section>
  );
}
