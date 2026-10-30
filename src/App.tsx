// The whole site: the catalog of every piece the generator arranges, a piece
// page that plays it and shows its score, and a mini player that keeps playing
// while you browse (docs/site/catalog-site.md). Its state is the URL's query
// string (query.ts), so the browser's back button walks it.

import { For, Show, createMemo, createResource, createSignal, onCleanup, onMount } from "solid-js";
import { SETS } from "../lib/params.ts";
import { MiniPlayer } from "./MiniPlayer";
import { PiecePage } from "./PiecePage";
import { loadCatalog } from "./music";
import { filterPieces, formatTime, parseView, serializeView, type ViewState } from "./query";
import logoUrl from "./rail-island-logo.webp";

const PLAY_URL = "https://play.railisland.com";
const HOME_URL = "https://www.railisland.com";
const FACTORY_URL = "https://factory.railisland.com";
const REPO_URL = "https://github.com/rail-island/rail-island-music";

export function App() {
  const [catalog] = createResource(loadCatalog);
  const [view, setView] = createSignal<ViewState>(parseView(location.search));

  onMount(() => {
    const onPop = () => setView(parseView(location.search));
    window.addEventListener("popstate", onPop);
    onCleanup(() => window.removeEventListener("popstate", onPop));
  });

  /** Change the view; `replace` keeps typing in the search box out of the history. */
  const go = (next: ViewState, replace = false) => {
    const opening = next.piece !== view().piece;
    setView(next);
    const url = serializeView(next);
    if (replace) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
    if (opening) window.scrollTo(0, 0);
  };

  const entry = createMemo(() => catalog()?.pieces.find((p) => p.id === view().piece) ?? null);
  const shown = createMemo(() => filterPieces(catalog()?.pieces ?? [], view().q, view().set));
  const setTitle = (id: string) => SETS.find((s) => s.id === id)?.title ?? id;

  return (
    <div class="music">
      <header class="music-bar">
        <a class="music-bar__logo" href={PLAY_URL} title="Play Rail Island">
          <img src={logoUrl} alt="Rail Island" width="40" height="40" />
        </a>
        <Show
          when={entry()}
          fallback={
            <h1 class="music-bar__title">Rail Island Music</h1>
          }
        >
          {(e) => (
            <>
              <button class="music-btn music-bar__back" title="Back to the list" onClick={() => go({ ...view(), piece: null, params: {}, t: null })}>
                &larr;
              </button>
              <h1 class="music-bar__title">
                {e().title}
                <span class="music-bar__sub">{e().composer}</span>
              </h1>
            </>
          )}
        </Show>
      </header>

      <main class="music-main">
        <Show when={!catalog.error} fallback={<p class="music-error">{String(catalog.error?.message ?? catalog.error)}</p>}>
          <Show when={catalog()} fallback={<p class="music-muted">Loading the catalog...</p>}>
            <Show
              when={entry()}
              fallback={
                <section class="music-list">
                  <p class="music-muted music-intro">
                    Music generated for the game Rail Island: public-domain classical pieces, ragtime and early jazz, written once as
                    notes and arranged for piano, bands or chiptune. Open a piece to play it and follow its score.
                  </p>
                  <div class="music-filters">
                    <input
                      class="music-search"
                      type="search"
                      placeholder="Search title or composer"
                      aria-label="Search"
                      value={view().q}
                      onInput={(ev) => go({ ...view(), q: ev.currentTarget.value }, true)}
                    />
                    <div class="music-chips" role="group" aria-label="Set">
                      <button class={`music-chip${view().set === "" ? " is-on" : ""}`} onClick={() => go({ ...view(), set: "" }, true)}>
                        All
                      </button>
                      <For each={catalog()!.sets}>
                        {(s) => (
                          <button
                            class={`music-chip${view().set === s.id ? " is-on" : ""}`}
                            onClick={() => go({ ...view(), set: view().set === s.id ? "" : s.id }, true)}
                          >
                            {s.title}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                  <table class="music-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Composer</th>
                        <th class="music-col-year">Year</th>
                        <th>Set</th>
                        <th class="music-col-num">Length</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={shown()} fallback={<tr><td colSpan={5} class="music-muted">No piece matches.</td></tr>}>
                        {(p) => (
                          <tr class="music-row" onClick={() => go({ ...view(), piece: p.id, params: {}, t: null })}>
                            <td>
                              <a href={serializeView({ ...view(), piece: p.id, params: {}, t: null })} onClick={(ev) => ev.preventDefault()}>
                                {p.title}
                              </a>
                            </td>
                            <td>{p.composer}</td>
                            <td class="music-col-year">{p.year}</td>
                            <td>{setTitle(p.set)}</td>
                            <td class="music-col-num">{formatTime(p.duration)}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </section>
              }
            >
              {(e) => <PiecePage entry={e()} catalog={catalog()!} view={view()} go={go} />}
            </Show>
          </Show>
        </Show>
      </main>

      <footer class="music-footer">
        <a href={HOME_URL}>railisland.com</a> &middot; <a href={FACTORY_URL}>Rail Island Factory</a> &middot; <a href={REPO_URL}>Source on GitHub</a> &middot;
        samples: VS Chamber Orchestra CE (CC0)
      </footer>
      <MiniPlayer current={view().piece} open={(id) => go({ ...view(), piece: id, params: {}, t: null })} />
    </div>
  );
}
