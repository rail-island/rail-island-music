// The editor's own sounds: a wooden knock when something is built, a crumble when
// something is demolished (docs/sounds/sounds.md). Not placed in the world.

import { LEVEL, filter, gain, noiseSource, num, oneShot, strike, voiceOf } from "../nodes.ts";
import type { SoundValues, Voice } from "../types.ts";

function knock(ctx: BaseAudioContext, dest: AudioNode, t: number, v: SoundValues, demolish: boolean): Voice {
  const out = gain(ctx, num(v, "level"));
  out.connect(dest);
  const thud = ctx.createOscillator();
  thud.type = "sine";
  const tg = gain(ctx);
  thud.connect(tg).connect(out);
  const grit = noiseSource(ctx, false);
  const gf = filter(ctx, "lowpass", demolish ? 900 : 1800);
  const gg = gain(ctx);
  grit.connect(gf).connect(gg).connect(out);
  const length = demolish ? 0.6 : 0.25;
  if (demolish) {
    thud.frequency.setValueAtTime(95, t);
    thud.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    strike(tg.gain, t, 0.45, 0.35);
    strike(gg.gain, t, 0.4, 0.55);
  } else {
    thud.frequency.setValueAtTime(170, t);
    thud.frequency.exponentialRampToValueAtTime(65, t + 0.15);
    strike(tg.gain, t, 0.5, 0.22);
    strike(gg.gain, t, 0.25, 0.06);
  }
  thud.start(t);
  thud.stop(t + length + 0.05);
  grit.start(t);
  grit.stop(t + length + 0.05);
  return voiceOf(out, [thud, grit], t + length + 0.1);
}

export const editBuild = oneShot({
  id: "edit-build",
  title: "Build",
  category: "editor",
  description: "A committed build in the editor: a short wooden knock.",
  params: [LEVEL],
  play: (ctx, dest, t, v) => knock(ctx, dest, t, v, false),
});

export const editDemolish = oneShot({
  id: "edit-demolish",
  title: "Demolish",
  category: "editor",
  description: "A committed demolition or removal in the editor: a crumble.",
  params: [LEVEL],
  play: (ctx, dest, t, v) => knock(ctx, dest, t, v, true),
});
