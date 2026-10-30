// The synth's instruments (docs/music/synth.md). Sampled instruments play the
// nearest recorded note of samples/<instrument>/ re-pitched; oscillator
// instruments (the chiptune ensemble) are generated in WebAudio. The settings
// here are the only place an instrument's sound is tuned.

export interface SampledInstrument {
  kind: "sampled";
  /** Seconds the note fades after it ends. */
  release: number;
  /** Sustained instruments loop the middle of their sample for long notes. */
  loop: boolean;
  /** Overall level of the instrument before track gain. */
  level: number;
}

export interface OscillatorInstrument {
  kind: "oscillator";
  wave: "square" | "pulse" | "triangle";
  release: number;
  level: number;
}

export interface DrumInstrument {
  kind: "drums";
  /** "sampled": the drum samples; "chip": generated noise and sine drums. */
  style: "sampled" | "chip";
  level: number;
}

export type Instrument = SampledInstrument | OscillatorInstrument | DrumInstrument;

export const INSTRUMENTS: Record<string, Instrument> = {
  piano: { kind: "sampled", release: 0.25, loop: false, level: 0.9 },
  clarinet: { kind: "sampled", release: 0.12, loop: true, level: 0.8 },
  trumpet: { kind: "sampled", release: 0.1, loop: true, level: 0.75 },
  trombone: { kind: "sampled", release: 0.12, loop: true, level: 0.8 },
  tuba: { kind: "sampled", release: 0.08, loop: false, level: 1 },
  bass: { kind: "sampled", release: 0.08, loop: false, level: 1.2 },
  drums: { kind: "drums", style: "sampled", level: 0.9 },
  square: { kind: "oscillator", wave: "square", release: 0.04, level: 0.5 },
  pulse: { kind: "oscillator", wave: "pulse", release: 0.04, level: 0.5 },
  triangle: { kind: "oscillator", wave: "triangle", release: 0.03, level: 1 },
  noise: { kind: "drums", style: "chip", level: 0.7 },
};

/** The sample files: samples/<instrument>/<midi>.mp3 for pitched ones, samples/drums/<name>.mp3 for drums. */
export interface SampleManifest {
  pitched: Record<string, number[]>;
  /** General MIDI percussion number -> drum sample name. */
  drums: Record<string, string>;
}
