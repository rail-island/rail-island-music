// The ensembles (the `ensemble` parameter; docs/music/arrangement.md): which
// synth instrument plays each role, in which range, how loud and where in the
// stereo field, and how the chords and drums are played.

export type Role = "melody" | "harmony" | "bass" | "chords" | "drums";

export interface EnsembleTrack {
  role: Role;
  name: string;
  /** A synth instrument id (synth/instruments.ts). */
  instrument: string;
  /** MIDI range the line is shifted into by octaves. */
  range: [number, number];
  /** Multiplies every note's velocity. */
  velocity: number;
  gain: number;
  pan: number;
}

export interface Ensemble {
  id: string;
  tracks: EnsembleTrack[];
  chordStyle: "block" | "arpeggio";
  /** `kit`: drum set; `march`: bass drum, snare and cymbal only; `none`: no drums. */
  drums: "kit" | "march" | "none";
}

const track = (
  role: Role,
  name: string,
  instrument: string,
  range: [number, number],
  gain: number,
  pan = 0,
  velocity = 1,
): EnsembleTrack => ({ role, name, instrument, range, gain, pan, velocity });

export const ENSEMBLES: Record<string, Ensemble> = {
  piano: {
    id: "piano",
    chordStyle: "block",
    drums: "none",
    tracks: [
      track("melody", "Piano", "piano", [60, 96], 0.9, 0.1),
      track("harmony", "Piano", "piano", [52, 84], 0.55, 0.1, 0.85),
      track("chords", "Piano", "piano", [52, 76], 0.5, -0.05, 0.85),
      track("bass", "Piano", "piano", [28, 55], 0.75, -0.15),
    ],
  },
  "ragtime-band": {
    id: "ragtime-band",
    chordStyle: "block",
    drums: "kit",
    tracks: [
      track("melody", "Clarinet", "clarinet", [58, 88], 0.75, 0.2),
      track("harmony", "Trombone", "trombone", [43, 67], 0.5, -0.3),
      track("chords", "Piano", "piano", [52, 76], 0.45, 0.35),
      track("bass", "Tuba", "tuba", [29, 53], 0.8, -0.1),
      track("drums", "Drums", "drums", [0, 127], 0.45, 0),
    ],
  },
  "brass-band": {
    id: "brass-band",
    chordStyle: "block",
    drums: "march",
    tracks: [
      track("melody", "Trumpet", "trumpet", [58, 82], 0.75, 0.15),
      track("harmony", "Trombone", "trombone", [46, 70], 0.5, -0.25),
      track("chords", "Horns", "trombone", [50, 72], 0.3, 0.3, 0.8),
      track("bass", "Tuba", "tuba", [29, 53], 0.85, -0.05),
      track("drums", "Drums", "drums", [0, 127], 0.5, 0),
    ],
  },
  "jazz-band": {
    id: "jazz-band",
    chordStyle: "block",
    drums: "kit",
    tracks: [
      track("melody", "Trumpet", "trumpet", [58, 82], 0.7, -0.15),
      track("harmony", "Clarinet", "clarinet", [62, 89], 0.5, 0.3),
      track("chords", "Piano", "piano", [52, 76], 0.45, 0.2),
      track("bass", "Bass", "bass", [28, 52], 0.95, -0.1),
      track("drums", "Drums", "drums", [0, 127], 0.45, 0),
    ],
  },
  chiptune: {
    id: "chiptune",
    chordStyle: "arpeggio",
    drums: "kit",
    tracks: [
      track("melody", "Square lead", "square", [60, 88], 0.35, 0),
      track("harmony", "Pulse", "pulse", [55, 84], 0.18, -0.4),
      track("chords", "Arpeggio", "pulse", [55, 91], 0.14, 0.4),
      track("bass", "Triangle bass", "triangle", [33, 57], 0.5, 0),
      track("drums", "Noise drums", "noise", [0, 127], 0.3, 0),
    ],
  },
};
