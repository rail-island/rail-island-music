// The contract between a sound design here and its player in the game
// (docs/sounds/sounds.md). TYPES ONLY, and no imports: the generator writes this
// file as the declarations of the exported bundle (export/sounds/sounds.d.ts), so
// it must stay valid as a .d.ts on its own (test/sounds.test.ts checks).

/** A number the player turns: a slider on the site, a value the game derives. */
export interface NumberParam {
  name: string;
  title: string;
  kind: "number";
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

/** One of a few named values. */
export interface ChoiceParam {
  name: string;
  title: string;
  kind: "choice";
  values: Array<{ value: string; title: string }>;
  default: string;
}

export type SoundParam = NumberParam | ChoiceParam;

/** A design's parameter values, by name. Missing names take the default. */
export type SoundValues = Record<string, number | string>;

/** One sounding thing. */
export interface Voice {
  /** When it falls silent by itself, in the context's seconds (Infinity for a loop). */
  readonly endsAt: number;
  /** Fade out and release its nodes from `at` on. */
  stop(at: number): void;
}

/**
 * A sound that keeps going while its source does. It schedules only `horizon`
 * seconds ahead on each tick, so a loop nobody ticks falls silent by itself.
 */
export interface LoopVoice extends Voice {
  tick(now: number, horizon: number): void;
  /** New parameter values, from the next scheduled event on. */
  set(values: SoundValues): void;
}

/** What a sound belongs to, for grouping it in the catalog; the game ignores it. */
export type SoundCategory = "trains" | "ships" | "water" | "editor";

interface DesignBase {
  /** Permanent once the game plays it: the game names designs by id. */
  id: string;
  title: string;
  category: SoundCategory;
  /** One line: what it is and where the game plays it. */
  description: string;
  params: SoundParam[];
}

/** A sound that plays once: a horn, a knock. */
export interface OneShotDesign extends DesignBase {
  kind: "oneShot";
  play(ctx: BaseAudioContext, dest: AudioNode, t: number, values: SoundValues): Voice;
}

/** A sound that runs until stopped: an exhaust beat, a bell. */
export interface LoopDesign extends DesignBase {
  kind: "loop";
  start(ctx: BaseAudioContext, dest: AudioNode, t: number, values: SoundValues): LoopVoice;
}

export type SoundDesign = OneShotDesign | LoopDesign;

/** A design without its code: what sounds.meta.json lists. */
export interface SoundMeta {
  id: string;
  title: string;
  category: SoundCategory;
  description: string;
  kind: "oneShot" | "loop";
  params: SoundParam[];
}

/** export/sounds/sounds.meta.json. */
export interface SoundsMetaFile {
  note: string;
  format: number;
  module: string;
  sounds: SoundMeta[];
}
