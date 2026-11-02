// A sound's reference recordings (src/references.ts, docs/site/catalog-site.md):
// each with its title, what the design took from it, a player and where it came
// from, under its licence. The page routes a playing recording through its own
// audio chain (`onPlay`), so the spectrogram draws it the same way as the design.

import { For, Show } from "solid-js";
import { type Reference, licenceUrl, referenceUrl } from "./references";

export function ReferenceList(props: {
  references: readonly Reference[];
  /** A player started: route it, and silence everything else on the page. */
  onPlay: (el: HTMLAudioElement) => void;
  /** A player paused or ended. */
  onPause: () => void;
  /** Every player, for the page to pause them. */
  register: (el: HTMLAudioElement) => void;
}) {
  return (
    <Show when={props.references.length > 0}>
      <section class="sound-refs" aria-label="Reference recordings">
        <h2 class="sound-refs-title">Reference recordings</h2>
        <p class="sound-muted">The recordings this sound was matched to. Play one, then the design, and compare the spectrograms.</p>
        <For each={props.references}>
          {(r) => (
            <article class="sound-ref">
              <h3 class="sound-ref-title">{r.title}</h3>
              <p class="sound-muted sound-ref-note">{r.note}</p>
              <Show when={referenceUrl(r)} fallback={<p class="sound-error">Missing file: references/{r.file}</p>}>
                {(url) => (
                  <audio
                    class="sound-ref-player"
                    controls
                    preload="none"
                    src={url()}
                    ref={(el) => props.register(el)}
                    onPlay={(ev) => props.onPlay(ev.currentTarget)}
                    onPause={() => props.onPause()}
                    onEnded={() => props.onPause()}
                  />
                )}
              </Show>
              <p class="sound-ref-source">
                From <a href={r.source.url} target="_blank" rel="noopener">{r.source.title}</a>, {r.source.author},{" "}
                <a href={licenceUrl(r.source.licence)} target="_blank" rel="noopener">
                  {r.source.licence}
                </a>
                ; an excerpt, loudness-normalised.
              </p>
            </article>
          )}
        </For>
      </section>
    </Show>
  );
}
