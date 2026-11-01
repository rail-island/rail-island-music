// The detail of a piece or a jingle: its facts, its parameter pickers, the
// player controls and the arranged score, which follows the playback.

import { For, Show, createEffect, createMemo, createResource, on } from "solid-js";
import type { ParamValue } from "../lib/params.ts";
import { ScoreView } from "./ScoreView";
import { type Arrangement, type Playable, error, loading, nowPlaying, pause, play, playing, position, seek, setVolume, stop, volume } from "./music";
import { formatTime, type ViewState } from "./query";

/** A piece or a jingle as its page shows it. */
export interface ScoreItem extends Playable {
  /** The line of facts under the title: composer, year, group, key and meter. */
  facts: string[];
  params: { name: string; title: string; values: ParamValue[] }[];
  defaults: Record<string, string>;
  arrange(params: Record<string, string>): Promise<Arrangement>;
  /** A closing line (why a piece is public domain, where a jingle comes from). */
  note: string;
}

export function ScorePage(props: { item: ScoreItem; view: ViewState; go: (v: ViewState, replace?: boolean) => void }) {
  const params = createMemo(() => {
    const out: Record<string, string> = {};
    for (const d of props.item.params) {
      const v = props.view.params[d.name];
      out[d.name] = v !== undefined && d.values.some((x) => x.value === v) ? v : props.item.defaults[d.name]!;
    }
    return out;
  });
  const key = createMemo(() => props.item.kind + props.item.id + JSON.stringify(params()));
  const [arrangement] = createResource(key, () => props.item.arrange(params()));
  const current = createMemo(() => {
    const now = nowPlaying();
    return now && now.entry.id === props.item.id && now.arrangement === arrangement() ? now : null;
  });
  const isPlaying = () => !!current() && playing();
  const shownPosition = () => (current() ? position() : props.view.t ?? 0);

  // A parameter change while this piece plays carries on in the new arrangement at the same point.
  createEffect(
    on(arrangement, (next, prev) => {
      const now = nowPlaying();
      if (!next || !prev || !now || now.entry.id !== props.item.id || !playing()) return;
      const at = (position() / prev.perf.duration) * next.perf.duration;
      void play(props.item, next, at);
    }),
  );

  const setParam = (name: string, value: string) => props.go({ ...props.view, params: { ...props.view.params, [name]: value }, t: null }, true);
  const toggle = () => {
    const a = arrangement();
    if (!a) return;
    if (isPlaying()) {
      pause();
      props.go({ ...props.view, t: position() }, true);
    } else void play(props.item, a, current() ? position() : props.view.t ?? 0);
  };
  const seekTo = (seconds: number) => {
    const a = arrangement();
    if (!a) return;
    if (current()) seek(seconds);
    else props.go({ ...props.view, t: seconds }, true);
  };

  return (
    <section class="music-piece">
      <p class="music-facts">
        <For each={props.item.facts}>{(f) => <span>{f}</span>}</For>
      </p>

      <div class="music-params">
        <For each={props.item.params}>
          {(d) => (
            <label class="music-param">
              <span>{d.title}</span>
              <select value={params()[d.name]} onChange={(ev) => setParam(d.name, ev.currentTarget.value)}>
                <For each={d.values}>
                  {(v) => (
                    <option value={v.value}>
                      {v.title}
                      {v.value === props.item.defaults[d.name] ? " (default)" : ""}
                    </option>
                  )}
                </For>
              </select>
            </label>
          )}
        </For>
      </div>

      <div class="music-controls">
        <button class="music-btn music-btn--play" disabled={!arrangement() || loading()} onClick={toggle} title={isPlaying() ? "Pause" : "Play"}>
          {loading() ? "Loading..." : isPlaying() ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button
          class="music-btn"
          disabled={!current()}
          onClick={() => {
            stop();
            props.go({ ...props.view, t: null }, true);
          }}
          title="Stop"
        >
          &#9632; Stop
        </button>
        <Show when={arrangement()}>
          {(a) => (
            <>
              <input
                class="music-progress"
                type="range"
                min="0"
                max={a().perf.duration}
                step="0.1"
                value={shownPosition()}
                aria-label="Position"
                onChange={(ev) => seekTo(Number(ev.currentTarget.value))}
              />
              <span class="music-time">
                {formatTime(shownPosition())} / {formatTime(a().perf.duration)}
              </span>
            </>
          )}
        </Show>
        <label class="music-volume" title="Volume">
          <span aria-hidden="true">&#128266;</span>
          <input type="range" min="0" max="1" step="0.05" value={volume()} aria-label="Volume" onInput={(ev) => setVolume(Number(ev.currentTarget.value))} />
        </label>
      </div>
      <Show when={error()}>
        <p class="music-error">{error()}</p>
      </Show>

      <Show when={!arrangement.error} fallback={<p class="music-error">{String(arrangement.error?.message ?? arrangement.error)}</p>}>
        <Show when={arrangement()} fallback={<p class="music-muted">Arranging...</p>}>
          {(a) => <ScoreView arrangement={a()} position={shownPosition()} following={isPlaying()} onSeek={seekTo} />}
        </Show>
      </Show>
      <p class="music-muted music-pd">{props.item.note}</p>
    </section>
  );
}
