// Every sound design of Rail Island, in the order the site lists them
// (docs/sounds/sounds.md). The generator bundles this module into
// export/sounds/sounds.js, which the game imports with `pnpm import:sounds`; the
// site's Sounds page plays the same designs from source.

import { editBuild, editDemolish } from "./designs/editor.ts";
import { shipHorn } from "./designs/ships.ts";
import { crossingBell, locoHorn, steamChuff, steamWhistle } from "./designs/trains.ts";
import { riverRapids, springFountain, waterfall } from "./designs/water.ts";
import { resolve } from "./nodes.ts";
import type { SoundDesign, SoundMeta } from "./types.ts";

/** The bundle's format: bumped when the contract in types.ts changes incompatibly. */
export const SOUNDS_FORMAT = 1;

export const SOUNDS: readonly SoundDesign[] = [
  locoHorn,
  steamWhistle,
  steamChuff,
  crossingBell,
  shipHorn,
  riverRapids,
  waterfall,
  springFountain,
  editBuild,
  editDemolish,
];

export function soundById(id: string): SoundDesign | undefined {
  return SOUNDS.find((s) => s.id === id);
}

/** A design without its code. */
export function soundMeta(s: SoundDesign): SoundMeta {
  return { id: s.id, title: s.title, description: s.description, kind: s.kind, params: s.params };
}

export { resolve as resolveValues };
export type * from "./types.ts";
