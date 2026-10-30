// The arranged score, drawn by abcjs. Bar k of the notation is bar k of the
// performance (repeats are written out), so the bar under the playback is
// highlighted and a click on a bar starts playback there.

import abcjs from "abcjs";
import { createEffect, onCleanup } from "solid-js";
import type { Arrangement } from "./music";

/** Index of the bar sounding at `seconds`. */
export function barAtTime(barTimes: number[], seconds: number): number {
  let lo = 0;
  let hi = barTimes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (barTimes[mid]! <= seconds + 1e-6) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function ScoreView(props: { arrangement: Arrangement; position: number; following: boolean; onSeek: (seconds: number) => void }) {
  let host!: HTMLDivElement;
  // bars[k] = the SVG elements of bar k, every voice.
  let bars: Element[][] = [];
  let lit = -1;

  const draw = () => {
    host.textContent = "";
    abcjs.renderAbc(host, props.arrangement.abc, { add_classes: true, responsive: "resize", staffwidth: 980, paddingtop: 0, paddingbottom: 0 });
    // Number the bars in reading order from the first voice's lines and measures.
    const keys: string[] = [];
    const seen = new Set<string>();
    host.querySelectorAll(".abcjs-v0.abcjs-note, .abcjs-v0.abcjs-rest").forEach((el) => {
      const m = /abcjs-l(\d+)/.exec(el.getAttribute("class") ?? "");
      const n = /abcjs-m(\d+)/.exec(el.getAttribute("class") ?? "");
      if (!m || !n) return;
      const k = `${m[1]}-${n[1]}`;
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    });
    keys.sort((a, b) => {
      const [la, ma] = a.split("-").map(Number) as [number, number];
      const [lb, mb] = b.split("-").map(Number) as [number, number];
      return la - lb || ma - mb;
    });
    bars = keys.map((k) => {
      const [l, m] = k.split("-");
      return [...host.querySelectorAll(`.abcjs-l${l}.abcjs-m${m}.abcjs-note, .abcjs-l${l}.abcjs-m${m}.abcjs-rest`)];
    });
    lit = -1;
  };

  createEffect(() => {
    void props.arrangement.abc;
    draw();
  });

  createEffect(() => {
    const k = barAtTime(props.arrangement.barTimes, props.position);
    if (k === lit) return;
    bars[lit]?.forEach((el) => el.classList.remove("is-current"));
    bars[k]?.forEach((el) => el.classList.add("is-current"));
    if (props.following && bars[k]?.[0] && (lit < 0 || k % 4 === 0)) {
      (bars[k]![0] as Element).scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    lit = k;
  });

  const onClick = (ev: MouseEvent) => {
    const target = (ev.target as Element).closest("[class*='abcjs-m']");
    if (!target) return;
    const k = bars.findIndex((list) => list.includes(target));
    if (k >= 0) props.onSeek(props.arrangement.barTimes[k]!);
  };
  onCleanup(() => {
    host.textContent = "";
  });

  return <div class="music-score" ref={host} onClick={onClick} title="Click a bar to play from there" />;
}
