// Every sound design of Rail Island, in the order the site lists them
// (docs/sounds/sounds.md). The generator bundles this module into
// export/sounds/sounds.js, which the game imports with `pnpm import:sounds`; the
// site's Sounds page plays the same designs from source.

import { helicopter } from "./designs/aircraft.ts";
import { animalCall, hoofBeat } from "./designs/animals.ts";
import { bigBen, churchBell, notreDameBell } from "./designs/bells.ts";
import { trainCrash } from "./designs/crash.ts";
import { editBuild, editDemolish } from "./designs/editor.ts";
import { shipHorn } from "./designs/ships.ts";
import { crossingBell, locoHorn, steamChuff, steamWhistle, tramBell } from "./designs/trains.ts";
import { electricEngineConverter, electricEngineResistor, electricEngineShinkansen } from "./designs/electric.ts";
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
  electricEngineResistor,
  electricEngineConverter,
  electricEngineShinkansen,
  crossingBell,
  tramBell,
  trainCrash,
  shipHorn,
  helicopter,
  hoofBeat,
  animalCall,
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
  { id: "trains", title: "Trains", description: "Locomotives and the railway: horns, whistles, the exhaust beat, diesel engines (railcars, shunters, mainline locomotives, buses and trucks) running, starting and stopping, electric locomotives and trains old and new, the Shinkansen, the level crossing's bell, the tram bell and a crash." },
  { id: "ships", title: "Ships", description: "Vessels in port and at sea." },
  { id: "aircraft", title: "Aircraft", description: "Aircraft in the air and on the pad: the helicopter's rotor and turbine." },
  { id: "animals", title: "Animals", description: "Draft animals: their hooves and their calls." },
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
