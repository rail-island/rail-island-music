// The recordings a sound design was matched to (docs/sounds/references.md):
// the site plays them beside the design, the way the factory's catalog shows a
// model's photos. The audio files are excerpts kept in git under references/;
// each entry names the recording it was cut from, where it came from and its
// licence. The game never sees any of this: it is site-only.

/** A licence a reference may carry: free to keep in git and to play on the site. */
export type ReferenceLicence = "CC0 1.0" | "CC BY 4.0";

export interface Reference {
  /** The excerpt's file name in references/. */
  file: string;
  title: string;
  /** What it is and what the design took from it. */
  note: string;
  /** The recording it was cut from. */
  source: { title: string; url: string; author: string; licence: ReferenceLicence };
}

const LICENCE_URLS: Record<ReferenceLicence, string> = {
  "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
};

export function licenceUrl(l: ReferenceLicence): string {
  return LICENCE_URLS[l];
}

const USC = "USC Cinema / Sunset Editorial collection";
const archive = (item: string) => `https://archive.org/details/${item}`;

/** Every excerpt, by file name. */
const R = {
  railcarTrolley: {
    file: "diesel-railcar-trolley.mp3",
    title: "Diesel trolley idling and revving",
    note: "A small diesel railcar: clean harmonic lines and the once-a-cycle lope. 30 s of 95.",
    source: { title: "G49-10 Diesel Trolly", url: archive("GOLD_TAPE_47_48_49_Trains"), author: USC, licence: "CC0 1.0" },
  },
  mineLoco: {
    file: "diesel-mine-loco-idle.mp3",
    title: "Mine diesel locomotive idling",
    note: "A small diesel locomotive at idle, recorded close and full range. 25 s of 62.",
    source: {
      title: "WWS Bediadiesellocomotiveidling.ogg",
      url: "https://commons.wikimedia.org/wiki/File:WWS_Bediadiesellocomotiveidling.ogg",
      author: "Work With Sounds / Technical Museum of Slovenia",
      licence: "CC BY 4.0",
    },
  },
  trainIdle: {
    file: "diesel-train-idle.mp3",
    title: "Diesel train arriving and idling",
    note: "An American road diesel (a two-stroke) idling at a platform; the reel cuts below about 100 Hz. 30 s of 49.",
    source: { title: "R20-43 Diesel Train In and Stop", url: archive("Red_Library_Trains"), author: USC, licence: "CC0 1.0" },
  },
  trainPassing: {
    file: "diesel-train-passing.mp3",
    title: "Diesel train passing",
    note: "A diesel train going by under power. 25 s of 139.",
    source: { title: "G48-17 Diesel Train Approaches By", url: archive("GOLD_TAPE_47_48_49_Trains"), author: USC, licence: "CC0 1.0" },
  },
  trainHorn: {
    file: "diesel-train-horn.mp3",
    title: "Diesel train with air horn",
    note: "A diesel working past, with its air horn. 30 s of 67.",
    source: { title: "R20-24 Diesel Train with Air Horn", url: archive("Red_Library_Trains"), author: USC, licence: "CC0 1.0" },
  },
  busStart: {
    file: "bus-start.mp3",
    title: "Old bus starting",
    note: "Cranking, catching and the first revs; the start's coughs and flare come from here. 30 s of 103.",
    source: { title: "G14-13 Old Bus Complete Sequence", url: archive("GOLD_TAPE_14_Trucks"), author: USC, licence: "CC0 1.0" },
  },
  busRevStop: {
    file: "bus-rev-stop.mp3",
    title: "Old bus revving and stopping",
    note: "Held revs, then the engine shut down and running out. 35 s of 103.",
    source: { title: "G14-13 Old Bus Complete Sequence", url: archive("GOLD_TAPE_14_Trucks"), author: USC, licence: "CC0 1.0" },
  },
  busCity: {
    file: "bus-city.mp3",
    title: "Bus in the street",
    note: "A bus pulling away in traffic. The whole recording, 15 s.",
    source: { title: "R05-19 Bus Sounds", url: archive("Red_Library_Trucks"), author: USC, licence: "CC0 1.0" },
  },
  truckIdleStop: {
    file: "truck-idle-stop.mp3",
    title: "Truck idling and stopping",
    note: "Idle, a blip of revs and the shutdown; the knock band and the stop's run-down come from here. 42 s of 44.",
    source: { title: "G14-25 Truck Idling and Stop", url: archive("GOLD_TAPE_14_Trucks"), author: USC, licence: "CC0 1.0" },
  },
  truckFireIdle: {
    file: "truck-fire-idle.mp3",
    title: "Fire truck idling",
    note: "A heavy truck revved, then settling to idle. 26 s of 28.",
    source: { title: "G14-22 Fire Truck Idle", url: archive("GOLD_TAPE_14_Trucks"), author: USC, licence: "CC0 1.0" },
  },
  truckRevs: {
    file: "truck-diesel-revs.mp3",
    title: "Diesel truck revving",
    note: "Revs held and dropped; bright and open. 34 s of 35.",
    source: { title: "G14-08 Diesel Truck", url: archive("GOLD_TAPE_14_Trucks"), author: USC, licence: "CC0 1.0" },
  },
  truckWorking: {
    file: "truck-working.mp3",
    title: "Old truck working hard",
    note: "An engine under load, labouring. 25 s of 33.",
    source: { title: "R03-32 Old Truck Engine Working Hard", url: archive("Red_Library_Trucks"), author: USC, licence: "CC0 1.0" },
  },
  truckStart: {
    file: "truck-start-idle.mp3",
    title: "Large truck starting and idling",
    note: "Started, then idling. 30 s of 97.",
    source: { title: "R19-48 Old Large Truck Start Idle Out", url: archive("Red_Library_Trucks"), author: USC, licence: "CC0 1.0" },
  },
} satisfies Record<string, Reference>;

/** The references of each sound id, in the order the page lists them. */
export const REFERENCES: Readonly<Record<string, readonly Reference[]>> = {
  "diesel-engine-railcar": [R.railcarTrolley],
  "diesel-engine-shunter": [R.mineLoco],
  // No recording of a V12 was found: the nearest are mainline diesels of another kind.
  "diesel-engine-mainline": [R.trainPassing, R.trainHorn],
  "diesel-engine-two-stroke": [R.trainIdle, R.trainPassing, R.trainHorn],
  "diesel-engine-bus": [R.busStart, R.busRevStop, R.busCity],
  "diesel-engine-truck": [R.truckIdleStop, R.truckFireIdle, R.truckRevs, R.truckWorking, R.truckStart],
};

export function referencesFor(soundId: string): readonly Reference[] {
  return REFERENCES[soundId] ?? [];
}

/** Every excerpt listed, once each, by file name. */
export function allReferences(): Reference[] {
  const out = new Map<string, Reference>();
  for (const id of Object.keys(REFERENCES).sort()) for (const r of REFERENCES[id]!) out.set(r.file, r);
  return [...out.values()].sort((a, b) => a.file.localeCompare(b.file));
}

// The excerpts as URLs the site serves: Vite copies each file into the build.
const URLS = import.meta.glob("../references/*.mp3", { query: "?url", import: "default", eager: true }) as Record<string, string>;

/** The URL of an excerpt, or undefined if its file is missing. */
export function referenceUrl(r: Reference): string | undefined {
  return URLS[`../references/${r.file}`];
}
