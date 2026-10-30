// The WebAudio player for the exported note data (docs/music/synth.md). The
// catalog site uses it, and it is exported as export/synth/synth.js for the
// game. It schedules notes a short time ahead from a timer, so a whole piece
// never creates thousands of audio nodes at once.

import { type Performance, tickToSeconds } from "../lib/performance.ts";
import { INSTRUMENTS, type Instrument, type SampleManifest } from "./instruments.ts";

interface ScheduledNote {
  time: number;
  end: number;
  track: number;
  pitch: number;
  vel: number;
}

const LOOKAHEAD = 0.25;
const TICK_MS = 40;

export interface PlayerOptions {
  /** URL of the folder holding samples.json and the sample files, ending in "/". */
  samplesUrl: string;
  /** An OfflineAudioContext renders with render() instead of playing. */
  context?: BaseAudioContext;
}

export class Player {
  readonly ctx: BaseAudioContext;
  private manifest: Promise<SampleManifest> | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private decoded = new Map<string, AudioBuffer>();
  private master: GainNode;
  private bus: AudioNode;
  private noise: AudioBuffer;
  private pulseWave: PeriodicWave;

  private perf: Performance | null = null;
  private notes: ScheduledNote[] = [];
  private trackOut: AudioNode[] = [];
  private next = 0;
  private startedAt = 0;
  private offset = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = new Set<AudioScheduledSourceNode>();
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  /** Called when a performance plays to its end. */
  onEnded: (() => void) | null = null;

  constructor(readonly options: PlayerOptions) {
    this.ctx = options.context ?? new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(this.ctx.destination);

    // A short room: a convolver with a decaying noise impulse, mixed in quietly.
    const dry = this.ctx.createGain();
    const wet = this.ctx.createGain();
    wet.gain.value = 0.18;
    const reverb = this.ctx.createConvolver();
    reverb.buffer = this.impulse(1.6);
    dry.connect(this.master);
    reverb.connect(wet).connect(this.master);
    const split = this.ctx.createGain();
    split.connect(dry);
    split.connect(reverb);
    this.bus = split;

    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    // A 25 % pulse for the chiptune's second voice.
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    this.pulseWave = this.ctx.createPeriodicWave(real, imag);
  }

  /** 0..1 */
  setVolume(v: number): void {
    this.master.gain.value = Math.max(0, Math.min(1, v)) * 0.8;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  /** Seconds into the current performance. */
  get position(): number {
    if (!this.perf) return 0;
    if (!this.playing) return this.offset;
    return Math.min(this.perf.duration, this.offset + this.ctx.currentTime - this.startedAt);
  }

  get performance(): Performance | null {
    return this.perf;
  }

  /** Load every sample a performance needs. Safe to call more than once. */
  async prepare(perf: Performance): Promise<void> {
    const manifest = await this.loadManifest();
    const jobs: Promise<unknown>[] = [];
    for (const t of perf.tracks) {
      const inst = INSTRUMENTS[t.instrument];
      if (!inst) throw new Error(`Unknown instrument ${t.instrument}`);
      if (inst.kind === "sampled") {
        const pitches = new Set<number>();
        for (let i = 2; i < t.notes.length; i += 4) pitches.add(nearestSample(manifest.pitched[t.instrument] ?? [], t.notes[i]!));
        for (const p of pitches) jobs.push(this.buffer(`${t.instrument}/${p}.mp3`));
      } else if (inst.kind === "drums" && inst.style === "sampled") {
        for (const name of new Set(Object.values(manifest.drums))) jobs.push(this.buffer(`drums/${name}.mp3`));
      }
    }
    await Promise.all(jobs);
  }

  /** Start `perf` at `from` seconds (resumes the audio context; call from a user gesture). */
  async play(perf: Performance, from = 0): Promise<void> {
    this.stop();
    if (this.ctx instanceof AudioContext) await this.ctx.resume();
    const manifest = await this.setup(perf);
    this.offset = Math.max(0, Math.min(from, perf.duration));
    this.next = this.notes.findIndex((n) => n.time >= this.offset);
    if (this.next < 0) this.next = this.notes.length;
    this.startedAt = this.ctx.currentTime + 0.05;
    const pump = () => this.schedule(manifest);
    pump();
    this.timer = setInterval(pump, TICK_MS);
  }

  /**
   * Render a whole performance into an AudioBuffer; the player must have been
   * made with an OfflineAudioContext long enough for it.
   */
  async render(perf: Performance): Promise<AudioBuffer> {
    const ctx = this.ctx;
    if (!(ctx instanceof OfflineAudioContext)) throw new Error("render() needs an OfflineAudioContext");
    const manifest = await this.setup(perf);
    this.offset = 0;
    this.startedAt = 0.05;
    for (const n of this.notes) {
      const t = perf.tracks[n.track]!;
      this.voice(INSTRUMENTS[t.instrument]!, t.instrument, n, this.startedAt + n.time, this.trackOut[n.track]!, manifest);
    }
    return ctx.startRendering();
  }

  private async setup(perf: Performance): Promise<SampleManifest> {
    await this.prepare(perf);
    const manifest = await this.loadManifest();
    this.perf = perf;
    this.notes = flatten(perf);
    this.trackOut = perf.tracks.map((t) => {
      const g = this.ctx.createGain();
      g.gain.value = t.gain;
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = t.pan;
      g.connect(pan).connect(this.bus);
      return g;
    });
    return manifest;
  }

  /** Stop and remember the position. */
  pause(): void {
    const at = this.position;
    this.halt();
    this.offset = at;
  }

  /** Stop and rewind. */
  stop(): void {
    this.halt();
    this.offset = 0;
  }

  private halt(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = null;
    const now = this.ctx.currentTime;
    for (const s of this.active) {
      try {
        s.stop(now + 0.02);
      } catch {
        // already stopped
      }
    }
    this.active.clear();
    for (const o of this.trackOut) {
      const g = o as GainNode;
      g.gain.setTargetAtTime(0, now, 0.01);
    }
  }

  private schedule(manifest: SampleManifest): void {
    const perf = this.perf!;
    const horizon = this.ctx.currentTime - this.startedAt + this.offset + LOOKAHEAD;
    while (this.next < this.notes.length && this.notes[this.next]!.time < horizon) {
      const n = this.notes[this.next++]!;
      const when = this.startedAt + (n.time - this.offset);
      if (when < this.ctx.currentTime - 0.05) continue;
      const t = perf.tracks[n.track]!;
      this.voice(INSTRUMENTS[t.instrument]!, t.instrument, n, when, this.trackOut[n.track]!, manifest);
    }
    if (this.next >= this.notes.length && !this.endTimer) {
      const left = (this.startedAt + perf.duration - this.offset - this.ctx.currentTime) * 1000;
      this.endTimer = setTimeout(() => {
        this.halt();
        this.offset = 0;
        this.onEnded?.();
      }, Math.max(0, left) + 300);
    }
  }

  private voice(inst: Instrument, id: string, n: ScheduledNote, when: number, out: AudioNode, manifest: SampleManifest): void {
    const ctx = this.ctx;
    const vel = Math.pow(n.vel / 127, 1.6) * inst.level;
    const dur = Math.max(0.03, n.end - n.time);
    const env = ctx.createGain();
    env.connect(out);
    let src: AudioScheduledSourceNode;
    let release = 0.05;

    if (inst.kind === "sampled") {
      const samplePitch = nearestSample(manifest.pitched[id] ?? [], n.pitch);
      const buf = this.decoded.get(`${id}/${samplePitch}.mp3`);
      if (!buf) return;
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = Math.pow(2, (n.pitch - samplePitch) / 12);
      if (inst.loop && dur > buf.duration * 0.6) {
        s.loop = true;
        s.loopStart = buf.duration * 0.35;
        s.loopEnd = buf.duration * 0.85;
      }
      src = s;
      release = inst.release;
    } else if (inst.kind === "oscillator") {
      const o = ctx.createOscillator();
      if (inst.wave === "pulse") o.setPeriodicWave(this.pulseWave);
      else o.type = inst.wave;
      o.frequency.value = 440 * Math.pow(2, (n.pitch - 69) / 12);
      src = o;
      release = inst.release;
    } else {
      this.drum(inst.style, n, when, env, vel, manifest);
      return;
    }
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(vel, when + 0.006);
    env.gain.setValueAtTime(vel, when + dur);
    env.gain.exponentialRampToValueAtTime(0.0005, when + dur + release);
    src.connect(env);
    src.start(when);
    src.stop(when + dur + release + 0.05);
    this.track(src);
  }

  private drum(style: "sampled" | "chip", n: ScheduledNote, when: number, env: GainNode, vel: number, manifest: SampleManifest): void {
    const ctx = this.ctx;
    const name = manifest.drums[String(n.pitch)];
    if (style === "sampled" && name) {
      const buf = this.decoded.get(`drums/${name}.mp3`);
      if (!buf) return;
      const s = ctx.createBufferSource();
      s.buffer = buf;
      env.gain.value = vel;
      s.connect(env);
      s.start(when);
      this.track(s);
      return;
    }
    if (n.pitch === 36 && style === "chip") {
      // A sine that drops in pitch.
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, when);
      o.frequency.exponentialRampToValueAtTime(45, when + 0.12);
      env.gain.setValueAtTime(vel, when);
      env.gain.exponentialRampToValueAtTime(0.0005, when + 0.18);
      o.connect(env);
      o.start(when);
      o.stop(when + 0.2);
      this.track(o);
      return;
    }
    // Noise: snare, hat, cymbals.
    const long = n.pitch === 49 ? 0.9 : n.pitch === 51 ? 0.35 : n.pitch === 38 ? 0.14 : 0.05;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = n.pitch === 38 ? "bandpass" : "highpass";
    filter.frequency.value = n.pitch === 38 ? 1800 : 7000;
    env.gain.setValueAtTime(vel * (n.pitch === 38 ? 0.8 : 0.45), when);
    env.gain.exponentialRampToValueAtTime(0.0005, when + long);
    s.connect(filter).connect(env);
    s.start(when, (n.time * 7.31) % 0.5);
    s.stop(when + long + 0.02);
    this.track(s);
  }

  private track(src: AudioScheduledSourceNode): void {
    this.active.add(src);
    src.onended = () => this.active.delete(src);
  }

  private loadManifest(): Promise<SampleManifest> {
    this.manifest ??= fetch(this.options.samplesUrl + "samples.json").then((r) => {
      if (!r.ok) throw new Error(`samples.json: HTTP ${r.status}`);
      return r.json() as Promise<SampleManifest>;
    });
    return this.manifest;
  }

  private buffer(path: string): Promise<AudioBuffer> {
    let p = this.buffers.get(path);
    if (!p) {
      p = fetch(this.options.samplesUrl + path)
        .then((r) => {
          if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((b) => this.ctx.decodeAudioData(b))
        .then((buf) => {
          this.decoded.set(path, buf);
          return buf;
        });
      this.buffers.set(path, p);
    }
    return p;
  }

  private impulse(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    let seed = 7;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        seed = (seed * 16807) % 2147483647;
        d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 3);
      }
    }
    return buf;
  }
}

/** The recorded pitch closest to `pitch` (ties take the lower sample, re-pitched up). */
export function nearestSample(pitches: number[], pitch: number): number {
  let best = pitches[0] ?? pitch;
  for (const p of pitches) if (Math.abs(p - pitch) < Math.abs(best - pitch)) best = p;
  return best;
}

/** Every note of a performance in seconds, sorted by start time. */
export function flatten(perf: Performance): ScheduledNote[] {
  const out: ScheduledNote[] = [];
  perf.tracks.forEach((t, track) => {
    for (let i = 0; i < t.notes.length; i += 4) {
      const tick = t.notes[i]!;
      const time = tickToSeconds(perf, tick);
      const end = tickToSeconds(perf, tick + t.notes[i + 1]!);
      out.push({ time, end, track, pitch: t.notes[i + 2]!, vel: t.notes[i + 3]! });
    }
  });
  out.sort((a, b) => a.time - b.time || a.track - b.track || a.pitch - b.pitch);
  return out;
}
