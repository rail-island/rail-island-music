// The whole site: the list of every sound Rail Island plays, grouped by its
// category and filtered by search, category and kind, the way the factory site
// lists its models; and the page of one sound, with its parameters and a
// spectrogram (docs/site/catalog-site.md). Its state is the URL's query string
// (query.ts), so the browser's back button walks it.

import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { CATEGORIES, SOUNDS, soundById, soundMeta } from "../sounds/index.ts";
import { EffectPage } from "./EffectPage";
import { KIND_TITLES, countByCategory, filterSounds, groupByCategory } from "./catalogList";
import { type KindFilter, type ViewState, parseView, serializeView } from "./query";
import logoUrl from "./rail-island-logo.webp";

const PLAY_URL = "https://play.railisland.com";
const HOME_URL = "https://www.railisland.com";
const FACTORY_URL = "https://factory.railisland.com";
const REPO_URL = "https://github.com/rail-island/rail-island-music";

const KIND_CHIPS: { kind: KindFilter; title: string }[] = [
  { kind: "", title: "All" },
  { kind: "oneShot", title: "One-shots" },
  { kind: "loop", title: "Loops" },
];

const METAS = SOUNDS.map(soundMeta);
const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
const COUNTS = countByCategory(METAS);

export function App() {
  const [view, setView] = createSignal<ViewState>(parseView(location.search, CATEGORY_IDS));

  onMount(() => {
    const onPop = () => setView(parseView(location.search, CATEGORY_IDS));
    window.addEventListener("popstate", onPop);
    onCleanup(() => window.removeEventListener("popstate", onPop));
  });

  /** Change the view; `replace` keeps typing in the search box out of the history. */
  const go = (next: ViewState, replace = false) => {
    const opening = next.sound !== view().sound;
    setView(next);
    const url = serializeView(next);
    if (replace) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
    if (opening) window.scrollTo(0, 0);
  };
  const list = (): ViewState => ({ ...view(), sound: null });
  const open = (id: string) => go({ ...view(), sound: id });

  const groups = createMemo(() => groupByCategory(filterSounds(METAS, CATEGORIES, view().q, view().cat, view().kind), CATEGORIES));
  const design = createMemo(() => (view().sound ? soundById(view().sound!) ?? null : null));

  return (
    <div class="sound">
      <header class="sound-bar">
        <a class="sound-bar__logo" href={PLAY_URL} title="Play Rail Island">
          <img src={logoUrl} alt="Rail Island" width="40" height="40" />
        </a>
        <Show when={design()} fallback={<h1 class="sound-bar__title">Rail Island Sound</h1>}>
          {(d) => (
            <>
              <button class="sound-btn sound-bar__back" title="Back to the list" onClick={() => go(list())}>
                &larr;
              </button>
              <h1 class="sound-bar__title">
                {d().title}
                <span class="sound-bar__sub">Sound effect</span>
              </h1>
            </>
          )}
        </Show>
      </header>

      <main class="sound-main">
        {/* keyed: another sound is a new page, so the one leaving stops what it plays */}
        <Show when={design()} keyed>
          {(d) => <EffectPage design={d} />}
        </Show>
        <Show when={!design()}>
          <section class="sound-list">
            <p class="sound-muted sound-intro">
              Every sound Rail Island plays, synthesized in the browser the way the game plays it. Open one to play it and tune its
              parameters.
            </p>
            <div class="sound-filters">
              <input
                class="sound-search"
                type="search"
                placeholder="Search title, id or description"
                aria-label="Search"
                value={view().q}
                onInput={(ev) => go({ ...view(), q: ev.currentTarget.value }, true)}
              />
              <div class="sound-chips" role="group" aria-label="Kind">
                <For each={KIND_CHIPS}>
                  {(c) => (
                    <button class={`sound-chip${view().kind === c.kind ? " is-on" : ""}`} onClick={() => go({ ...view(), kind: c.kind }, true)}>
                      {c.title}
                    </button>
                  )}
                </For>
              </div>
            </div>
            <div class="sound-chips" role="group" aria-label="Category">
              <button class={`sound-chip${view().cat === "" ? " is-on" : ""}`} onClick={() => go({ ...view(), cat: "" }, true)}>
                All<span class="sound-chip__count">{METAS.length}</span>
              </button>
              <For each={CATEGORIES}>
                {(c) => (
                  <button
                    class={`sound-chip${view().cat === c.id ? " is-on" : ""}`}
                    title={c.description}
                    onClick={() => go({ ...view(), cat: view().cat === c.id ? "" : c.id }, true)}
                  >
                    {c.title}
                    <span class="sound-chip__count">{COUNTS[c.id] ?? 0}</span>
                  </button>
                )}
              </For>
            </div>
            <Show when={groups().length > 0} fallback={<p class="sound-muted">Nothing matches.</p>}>
              <For each={groups()}>
                {(g) => (
                  <section class="sound-group">
                    <h2>{g.category.title}</h2>
                    <p class="sound-muted">{g.category.description}</p>
                    <table class="sound-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Kind</th>
                          <th class="sound-col-desc">What it is</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={g.sounds}>
                          {(s) => (
                            <tr class="sound-row" onClick={() => open(s.id)}>
                              <td>
                                <a href={serializeView({ ...view(), sound: s.id })} onClick={(ev) => ev.preventDefault()}>
                                  {s.title}
                                </a>
                              </td>
                              <td>{KIND_TITLES[s.kind]}</td>
                              <td class="sound-col-desc sound-muted">{s.description}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </section>
                )}
              </For>
            </Show>
          </section>
        </Show>
      </main>

      <footer class="sound-footer">
        <a href={HOME_URL}>railisland.com</a> &middot; <a href={FACTORY_URL}>Rail Island Factory</a> &middot; <a href={REPO_URL}>Source on GitHub</a>
      </footer>
    </div>
  );
}
