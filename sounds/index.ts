// Every sound design of Rail Island, in the order the site lists them
// (docs/sounds/sounds.md). The generator bundles this module into
// export/sounds/sounds.js, which the game imports with `pnpm import:sounds`; the
// site's Sounds page plays the same designs from source.

import { bigBen, churchBell, notreDameBell } from "./designs/bells.ts";
import { editBuild, editDemolish } from "./designs/editor.ts";
import { shipHorn } from "./designs/ships.ts";
import { crossingBell, locoHorn, steamChuff, steamWhistle } from "./designs/trains.ts";
import {
  dieselEngineBus,
  dieselEngineMainline,
  dieselEngineRailcar,
  dieselEngineShunter,
  dieselEngineTruck,
  dieselEngineTwoStroke,
} from "./designs/diesel.ts";
import { woods } from "./designs/nature.ts";
import { riverRapids, seaSurf, springFountain, waterfall } from "./designs/water.ts";
import { resolve } from "./nodes.ts";
import type { SoundCategory, SoundCategoryInfo, SoundDesign, SoundMeta } from "./types.ts";

/** The bundle's format: bumped when the contract in types.ts changes incompatibly. */
export const SOUNDS_FORMAT = 1;

export const SOUNDS: readonly SoundDesign[] = [
  locoHorn,
  steamWhistle,
  steamChuff,
  dieselEngineRailcar,
  dieselEngineShunter,
  dieselEngineMainline,
  dieselEngineTwoStroke,
  dieselEngineBus,
  dieselEngineTruck,
  crossingBell,
  shipHorn,
  riverRapids,
  waterfall,
  springFountain,
  seaSurf,
  woods,
  churchBell,
  bigBen,
  notreDameBell,
  editBuild,
  editDemolish,
];

/** Every category, in list order; SOUNDS keeps each category's designs together in this order. */
export const CATEGORIES: readonly SoundCategoryInfo[] = [
  { id: "trains", title: "Trains", description: "Locomotives and the railway: horns, whistles, the exhaust beat, diesel engines (railcars, shunters, mainline locomotives, buses and trucks) running, starting and stopping, the level crossing's bell." },
  { id: "ships", title: "Ships", description: "Vessels in port and at sea." },
  { id: "water", title: "Water", description: "Ambient water, played while it is in view: rivers, waterfalls, springs and the sea." },
  { id: "nature", title: "Nature", description: "Ambient life of the land: woods and their birds." },
  { id: "bells", title: "Bells", description: "Tower bells tolling: a village church, Westminster's Great Bell and Notre-Dame's bourdon." },
  { id: "editor", title: "Editor", description: "Feedback of the map editor: building and demolishing." },
];

export function categoryById(id: string): SoundCategoryInfo | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** The designs of one category, in list order. */
export function soundsIn(category: SoundCategory): SoundDesign[] {
  return SOUNDS.filter((s) => s.category === category);
}

export function soundById(id: string): SoundDesign | undefined {
  return SOUNDS.find((s) => s.id === id);
}

/** A design without its code. */
export function soundMeta(s: SoundDesign): SoundMeta {
  return { id: s.id, title: s.title, category: s.category, description: s.description, kind: s.kind, params: s.params };
}

export { resolve as resolveValues };
export type * from "./types.ts";
