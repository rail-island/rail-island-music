// The whole site: one filterable list of everything Rail Island plays -- the
// pieces the generator arranges, the jingles and the game's sound effects --
// the way the factory site lists its models; a detail per kind (a piece or a
// jingle plays with its score following, a sound effect plays with its
// parameters and a spectrogram); and a mini player that keeps a piece playing
// while you browse (docs/site/catalog-site.md). Its state is the URL's query
// string (query.ts), so the browser's back button walks it.

import { For, Show, createMemo, createResource, createSignal, onCleanup, onMount } from "solid-js";
import { JINGLE_PARAMS, type JingleParams } from "../lib/jingles.ts";
import { PARAMS, type Params } from "../lib/params.ts";
import { SOUNDS, soundById, soundMeta } from "../sounds/index.ts";
import { EffectPage } from "./EffectPage";
import { MiniPlayer } from "./MiniPlayer";
import { type ScoreItem, ScorePage } from "./ScorePage";
import { KIND_TITLES, buildRows, filterRows, groupsOf } from "./catalogList";
import { arrangeJingle, arrangePiece, loadCatalog, loadJingles } from "./music";
import { type Kind, type ViewState, emptyView, formatTime, parseView, serializeView } from "./query";
import logoUrl from "./rail-island-logo.webp";

const PLAY_URL = "https://play.railisland.com";
const HOME_URL = "https://www.railisland.com";
const FACTORY_URL = "https://factory.railisland.com";
const REPO_URL = "https://github.com/rail-island/rail-island-music";

const KIND_CHIPS: { kind: Kind; title: string }[] = [
  { kind: "", title: "All" },
  { kind: "piece", title: "Pieces" },
  { kind: "jingle", title: "Jingles" },
  { kind: "effect", title: "Sound effects" },
];

const SOUND_METAS = SOUNDS.map(soundMeta);

export function App() {
  const [catalog] = createResource(loadCatalog);
  const [jingles] = createResource(loadJingles);
  const [view, setView] = createSignal<ViewState>(parseView(location.search));

  onMount(() => {
    const onPop = () => setView(parseView(location.search));
    window.addEventListener("popstate", onPop);
    onCleanup(() => window.removeEventListener("popstate", onPop));
  });

  /** Change the view; `replace` keeps typing in the search box out of the history. */
  const go = (next: ViewState, replace = false) => {
    const opening = next.item?.id !== view().item?.id;
    setView(next);
    const url = serializeView(next);
    if (replace) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
    if (opening) window.scrollTo(0, 0);
  };
  const list = (): ViewState => ({ ...emptyView(), q: view().q, kind: view().kind, set: view().set });
  const open = (kind: "piece" | "jingle" | "effect", id: string) => go({ ...list(), item: { kind, id } });

  const rows = createMemo(() => (catalog() ? buildRows(catalog()!, jingles() ?? null, SOUND_METAS) : []));
  const shown = createMemo(() => filterRows(rows(), view().q, view().kind, view().set));
  const groups = createMemo(() => groupsOf(rows(), view().kind));

  /** The open piece or jingle, shaped for its score page. */
  const scoreItem = createMemo((): ScoreItem | null => {
    const item = view().item;
    const cat = catalog();
    if (!item || !cat) return null;
    if (item.kind === "piece") {
      const e = cat.pieces.find((p) => p.id === item.id);
      if (!e) return null;
      const setTitle = cat.sets.find((s) => s.id === e.set)?.title ?? e.set;
      return {
        kind: "piece",
        id: e.id,
        title: e.title,
        composer: e.composer,
        facts: [e.composer, String(e.year), setTitle, `${e.key}, ${e.meter}`],
        params: PARAMS,
        defaults: e.defaults,
        arrange: (p) => arrangePiece(e, p as Params),
        note: `Public domain: ${e.publicDomain}`,
      };
    }
    if (item.kind === "jingle") {
      const e = jingles()?.jingles.find((j) => j.id === item.id);
      if (!e) return null;
      return {
        kind: "jingle",
        id: e.id,
        title: e.title,
        composer: e.composer,
        facts: [e.composer, String(e.year), "Jingle", `${e.key}, ${e.meter}`],
        params: JINGLE_PARAMS,
        defaults: e.defaults,
        arrange: (p) => arrangeJingle(e, p as JingleParams),
        note: `Transcribed from: ${e.source}`,
      };
    }
    return null;
  });
  const effect = createMemo(() => (view().item?.kind === "effect" ? soundById(view().item!.id) ?? null : null));
  const title = () => scoreItem()?.title ?? effect()?.title ?? null;
  const subtitle = () => scoreItem()?.composer ?? (effect() ? KIND_TITLES.effect : "");

  return (
    <div class="music">
      <header class="music-bar">
        <a class="music-bar__logo" href={PLAY_URL} title="Play Rail Island">
          <img src={logoUrl} alt="Rail Island" width="40" height="40" />
        </a>
        <Show when={title()} fallback={<h1 class="music-bar__title">Rail Island Music</h1>}>
          <button class="music-btn music-bar__back" title="Back to the list" onClick={() => go(list())}>
            &larr;
          </button>
          <h1 class="music-bar__title">
            {title()}
            <span class="music-bar__sub">{subtitle()}</span>
          </h1>
        </Show>
      </header>

      <main class="music-main">
        <Show when={!catalog.error} fallback={<p class="music-error">{String(catalog.error?.message ?? catalog.error)}</p>}>
          <Show when={catalog()} fallback={<p class="music-muted">Loading the catalog...</p>}>
            <Show when={scoreItem()}>{(item) => <ScorePage item={item()} view={view()} go={go} />}</Show>
            <Show when={effect()}>{(d) => <EffectPage design={d()} />}</Show>
            <Show when={!view().item || (!scoreItem() && !effect())}>
              <section class="music-list">
                <p class="music-muted music-intro">
                  Everything Rail Island plays: public-domain pieces arranged for piano, bands or chiptune; jingles; and the game's
                  sound effects, synthesized as it plays them. Open one to play it and see its score or tune its parameters.
                </p>
                <div class="music-filters">
                  <input
                    class="music-search"
                    type="search"
                    placeholder="Search title, composer or group"
                    aria-label="Search"
                    value={view().q}
                    onInput={(ev) => go({ ...view(), q: ev.currentTarget.value }, true)}
                  />
                  <div class="music-chips" role="group" aria-label="Kind">
                    <For each={KIND_CHIPS}>
                      {(c) => (
                        <button class={`music-chip${view().kind === c.kind ? " is-on" : ""}`} onClick={() => go({ ...view(), kind: c.kind, set: "" }, true)}>
                          {c.title}
                        </button>
                      )}
                    </For>
                  </div>
                  <Show when={groups().length > 0}>
                    <div class="music-chips music-chips--sub" role="group" aria-label="Group">
                      <button class={`music-chip${view().set === "" ? " is-on" : ""}`} onClick={() => go({ ...view(), set: "" }, true)}>
                        All
                      </button>
                      <For each={groups()}>
                        {(g) => (
                          <button
                            class={`music-chip${view().set === g.id ? " is-on" : ""}`}
                            onClick={() => go({ ...view(), set: view().set === g.id ? "" : g.id }, true)}
                          >
                            {g.title}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
                <table class="music-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th class="music-col-by">By</th>
                      <th>Kind</th>
                      <th>Group</th>
                      <th class="music-col-num">Length</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={shown()} fallback={<tr><td colSpan={5} class="music-muted">Nothing matches.</td></tr>}>
                      {(r) => (
                        <tr class="music-row" onClick={() => open(r.kind, r.id)}>
                          <td>
                            <a href={serializeView({ ...list(), item: { kind: r.kind, id: r.id } })} onClick={(ev) => ev.preventDefault()}>
                              {r.title}
                            </a>
                          </td>
                          <td class="music-col-by">{r.by}</td>
                          <td>{KIND_TITLES[r.kind]}</td>
                          <td>{r.groupTitle}</td>
                          <td class="music-col-num">{r.duration === null ? "-" : formatTime(r.duration)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </section>
            </Show>
          </Show>
        </Show>
      </main>

      <footer class="music-footer">
        <a href={HOME_URL}>railisland.com</a> &middot; <a href={FACTORY_URL}>Rail Island Factory</a> &middot; <a href={REPO_URL}>Source on GitHub</a> &middot;
        samples: VS Chamber Orchestra CE (CC0)
      </footer>
      <MiniPlayer current={view().item?.id ?? null} open={(kind, id) => open(kind, id)} />
    </div>
  );
}
