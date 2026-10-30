// A piece's page: its facts, the four parameter pickers, the player controls
// and the arranged score, which follows the playback.

import { For, Show, createEffect, createMemo, createResource, on } from "solid-js";
import type { Catalog, CatalogEntry } from "../lib/catalog.ts";
import { PARAMS, type ParamName, resolveParams } from "../lib/params.ts";
import { ScoreView } from "./ScoreView";
import { arrangePiece, error, loading, nowPlaying, pause, play, playing, position, seek, setVolume, stop, volume } from "./music";
import { formatTime, type ViewState } from "./query";

export function PiecePage(props: { entry: CatalogEntry; catalog: Catalog; view: ViewState; go: (v: ViewState, replace?: boolean) => void }) {
  const params = createMemo(() => resolveParams(props.entry, props.view.params));
  const key = createMemo(() => props.entry.id + JSON.stringify(params()));
  const [arrangement] = createResource(key, () => arrangePiece(props.entry, params()));
  const current = createMemo(() => {
    const now = nowPlaying();
    return now && now.entry.id === props.entry.id && now.arrangement === arrangement() ? now : null;
  });
  const isPlaying = () => !!current() && playing();
  const shownPosition = () => (current() ? position() : props.view.t ?? 0);

  // A parameter change while this piece plays carries on in the new arrangement at the same point.
  createEffect(
    on(arrangement, (next, prev) => {
      const now = nowPlaying();
      if (!next || !prev || !now || now.entry.id !== props.entry.id || !playing()) return;
      const at = (position() / prev.perf.duration) * next.perf.duration;
      void play(props.entry, next, at);
    }),
  );

  const setParam = (name: ParamName, value: string) => props.go({ ...props.view, params: { ...props.view.params, [name]: value }, t: null }, true);
  const toggle = () => {
    const a = arrangement();
    if (!a) return;
    if (isPlaying()) {
      pause();
      props.go({ ...props.view, t: position() }, true);
    } else void play(props.entry, a, current() ? position() : props.view.t ?? 0);
  };
  const seekTo = (seconds: number) => {
    const a = arrangement();
    if (!a) return;
    if (current()) seek(seconds);
    else props.go({ ...props.view, t: seconds }, true);
  };
  const setLabel = () => props.catalog.sets.find((s) => s.id === props.entry.set)?.title ?? props.entry.set;

  return (
    <section class="music-piece">
      <p class="music-facts">
        <span>{props.entry.composer}</span>
        <span>{props.entry.year}</span>
        <span>{setLabel()}</span>
        <span>
          {props.entry.key}, {props.entry.meter}
        </span>
      </p>

      <div class="music-params">
        <For each={PARAMS}>
          {(d) => (
            <label class="music-param">
              <span>{d.title}</span>
              <select value={params()[d.name]} onChange={(ev) => setParam(d.name, ev.currentTarget.value)}>
                <For each={d.values}>
                  {(v) => (
                    <option value={v.value}>
                      {v.title}
                      {v.value === props.entry.defaults[d.name] ? " (default)" : ""}
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
      <p class="music-muted music-pd">Public domain: {props.entry.publicDomain}</p>
    </section>
  );
}
