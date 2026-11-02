// What a sound's page is playing (src/EffectPage.tsx): every one-shot still
// ringing and the running loop, so that leaving the page stops all of it -- a
// bell's strikes or a horn's call as well as a loop (docs/site/catalog-site.md).
// No DOM: tested over a stub context (test/audition.test.ts).

import type { LoopDesign, LoopVoice, OneShotDesign, SoundValues, Voice } from "../sounds/types.ts";

/** How far ahead (s) a running loop schedules, and how often it is ticked (ms). */
export const HORIZON = 0.2;
export const TICK_MS = 50;
/** A press schedules this far (s) after now, so the first event is never late. */
const LEAD = 0.02;

export interface Timers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

export interface Audition {
  /** Play a one-shot; returns its voice. */
  playOnce(design: OneShotDesign, values: SoundValues): Voice;
  /** Start a loop, stopping one already running. */
  startLoop(design: LoopDesign, values: SoundValues): LoopVoice;
  /** New values for the running loop, if any. */
  set(values: SoundValues): void;
  stopLoop(): void;
  /** Stop everything still sounding: the loop and every one-shot. */
  stopAll(): void;
  /** When the last thing playing falls silent by itself (Infinity while a loop runs). */
  endsAt(): number;
}

export function createAudition(ctx: BaseAudioContext, dest: AudioNode, timers: Timers = globalThis as unknown as Timers): Audition {
  const once = new Set<Voice>();
  let loop: LoopVoice | null = null;
  let timer: unknown = undefined;

  const prune = () => {
    for (const v of once) if (v.endsAt <= ctx.currentTime) once.delete(v);
  };
  const stopLoop = () => {
    if (timer !== undefined) timers.clearInterval(timer);
    timer = undefined;
    loop?.stop(ctx.currentTime);
    loop = null;
  };

  return {
    playOnce(design, values) {
      prune();
      const v = design.play(ctx, dest, ctx.currentTime + LEAD, values);
      once.add(v);
      return v;
    },
    startLoop(design, values) {
      stopLoop();
      const v = design.start(ctx, dest, ctx.currentTime + LEAD, values);
      loop = v;
      v.tick(ctx.currentTime, HORIZON);
      timer = timers.setInterval(() => v.tick(ctx.currentTime, HORIZON), TICK_MS);
      return v;
    },
    set(values) {
      loop?.set(values);
    },
    stopLoop,
    stopAll() {
      stopLoop();
      prune();
      for (const v of once) v.stop(ctx.currentTime);
      once.clear();
    },
    endsAt() {
      if (loop) return Infinity;
      prune();
      let end = 0;
      for (const v of once) end = Math.max(end, v.endsAt);
      return end;
    },
  };
}
