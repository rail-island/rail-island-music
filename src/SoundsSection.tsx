// The train sounds and the tram bell on the list page (docs/site/catalog-site.md):
// one row per sound, a button per situation. A sound is computed in the browser
// by the synth (lib/sfx/) the first time it plays, then kept.

import { For, Show, createSignal, onCleanup } from "solid-js";
import { SOUNDS } from "../lib/sfx/sounds.ts";
import { playSound } from "../synth/sounds.ts";
import { volume } from "./music";

let ctx: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;

export function SoundsSection() {
  /** "<id>/<variant>" playing or being computed. */
  const [active, setActive] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);

  const stop = () => {
    try {
      current?.stop();
    } catch {
      // already ended
    }
    current = null;
    setActive(null);
  };
  onCleanup(stop);

  const toggle = async (id: string, variant: string) => {
    const key = `${id}/${variant}`;
    const wasActive = active() === key;
    stop();
    if (wasActive) return;
    ctx ??= new AudioContext();
    await ctx.resume();
    setActive(key);
    setBusy(true);
    // Let the button show its state before the samples are computed.
    await new Promise((r) => setTimeout(r, 20));
    try {
      const src = playSound(ctx, id, variant, { volume: volume() });
      current = src;
      src.onended = () => {
        if (current === src) stop();
      };
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="music-sounds" aria-labelledby="music-sounds-title">
      <h2 id="music-sounds-title" class="music-sounds__title">
        Train sounds
      </h2>
      <p class="music-muted">
        Computed, not recorded: each is synthesised and tuned against real recordings kept in the repository.
      </p>
      <ul class="music-sounds__list">
        <For each={SOUNDS}>
          {(s) => (
            <li class="music-sounds__item">
              <div>
                <strong>{s.title}</strong>
                <div class="music-muted music-sounds__desc">{s.description}</div>
              </div>
              <div class="music-chips" role="group" aria-label={s.title}>
                <For each={s.variants}>
                  {(v) => {
                    const key = `${s.id}/${v.id}`;
                    return (
                      <button class={`music-chip${active() === key ? " is-on" : ""}`} onClick={() => void toggle(s.id, v.id)}>
                        <Show when={active() === key} fallback={<>&#9654; </>}>
                          {busy() ? "... " : "■ "}
                        </Show>
                        {v.title}
                      </button>
                    );
                  }}
                </For>
              </div>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
