// Play a sound effect (docs/music/sounds.md) through WebAudio. The samples
// are computed by lib/sfx/ - plain TypeScript, so a sound costs no download;
// a computed sound is kept for the next time it plays.

import { renderSound } from "../lib/sfx/sounds.ts";

const cache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/** The sound as an AudioBuffer at the context's sample rate (computed once per context). */
export function soundBuffer(ctx: BaseAudioContext, id: string, variant: string): AudioBuffer {
  let byKey = cache.get(ctx);
  if (!byKey) cache.set(ctx, (byKey = new Map()));
  const key = `${id}/${variant}`;
  let buf = byKey.get(key);
  if (!buf) {
    const s = renderSound(id, variant, ctx.sampleRate);
    buf = ctx.createBuffer(2, s.left.length, s.rate);
    buf.copyToChannel(s.left, 0);
    buf.copyToChannel(s.right, 1);
    byKey.set(key, buf);
  }
  return buf;
}

/** Start a sound now (or at `when`) into `destination`; returns its source node, which can be stopped. */
export function playSound(
  ctx: BaseAudioContext,
  id: string,
  variant: string,
  options: { destination?: AudioNode; volume?: number; when?: number } = {},
): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = soundBuffer(ctx, id, variant);
  const gain = ctx.createGain();
  gain.gain.value = options.volume ?? 1;
  src.connect(gain).connect(options.destination ?? ctx.destination);
  src.start(options.when ?? ctx.currentTime);
  return src;
}
