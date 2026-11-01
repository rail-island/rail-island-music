// The bar at the bottom of the page that keeps the current piece or jingle
// playing while you browse: its title, Play/Pause and the progress.

import { Show } from "solid-js";
import { nowPlaying, pause, play, playing, position } from "./music";
import { formatTime } from "./query";

export function MiniPlayer(props: { current: string | null; open: (kind: "piece" | "jingle", id: string) => void }) {
  return (
    <Show when={nowPlaying() && nowPlaying()!.entry.id !== props.current ? nowPlaying() : null}>
      {(now) => (
        <div class="music-mini" role="region" aria-label="Now playing">
          <button
            class="music-btn music-btn--round"
            title={playing() ? "Pause" : "Play"}
            onClick={() => (playing() ? pause() : void play(now().entry, now().arrangement, position()))}
          >
            {playing() ? "❚❚" : "▶"}
          </button>
          <button class="music-mini__title" onClick={() => props.open(now().entry.kind, now().entry.id)}>
            {now().entry.title}
            <span class="music-muted"> &middot; {now().entry.composer}</span>
          </button>
          <span class="music-mini__time">
            {formatTime(position())} / {formatTime(now().arrangement.perf.duration)}
          </span>
          <div class="music-mini__progress" style={{ width: `${(100 * position()) / now().arrangement.perf.duration}%` }} />
        </div>
      )}
    </Show>
  );
}
