// A ship's horn (docs/sounds/sounds.md). The game sets the pitch and the length
// from the hull: a small boat toots high and short, a big ship blows deep and long.

import { LEVEL, envelope, filter, gain, num, oneShot, voiceOf } from "../nodes.ts";

export const shipHorn = oneShot({
  id: "ship-horn",
  title: "Ship horn",
  category: "ships",
  description: "A ship's horn, leaving a berth (full length) and coming to rest at one (shorter).",
  params: [
    { name: "pitch", title: "Pitch", kind: "number", min: 50, max: 250, step: 1, default: 120, unit: "Hz" },
    { name: "seconds", title: "Length", kind: "number", min: 0.3, max: 3, step: 0.05, default: 1.5, unit: "s" },
    LEVEL,
  ],
  play(ctx, dest, t, v) {
    const pitch = num(v, "pitch");
    const seconds = num(v, "seconds");
    const out = gain(ctx, num(v, "level"));
    out.connect(dest);
    const env = gain(ctx);
    const lp = filter(ctx, "lowpass", 800, 1.2);
    lp.connect(env).connect(out);
    // A slow waver on every reed.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.5;
    const depth = gain(ctx, pitch * 0.012);
    lfo.connect(depth);
    const end = t + seconds + 0.7;
    const sources: AudioScheduledSourceNode[] = [lfo];
    const reeds: Array<[OscillatorType, number, number]> = [
      ["sawtooth", 1, 0.2],
      ["square", 1.004, 0.08],
      ["sawtooth", 2, 0.07],
    ];
    for (const [type, ratio, level] of reeds) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = pitch * ratio;
      depth.connect(osc.frequency);
      const g = gain(ctx, level);
      osc.connect(g).connect(lp);
      osc.start(t);
      osc.stop(end);
      sources.push(osc);
    }
    lfo.start(t);
    lfo.stop(end);
    envelope(env.gain, t, 1, 0.2, seconds, 0.5);
    return voiceOf(out, sources, end);
  },
});
