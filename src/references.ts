// The recordings a sound design was matched to (docs/sounds/references.md):
// the site plays them beside the design, the way the factory's catalog shows a
// model's photos. The audio files are excerpts kept in git under references/;
// each entry names the recording it was cut from, where it came from and its
// licence. The game never sees any of this: it is site-only.

/** A licence a reference may carry: free to keep in git and to play on the site. */
export type ReferenceLicence = "CC0 1.0" | "CC BY 4.0" | "CC BY 3.0" | "Public Domain Mark 1.0";

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
  "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
  "Public Domain Mark 1.0": "https://creativecommons.org/publicdomain/mark/1.0/",
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
  steamStarts: {
    file: "steam-starts-pulls-away.mp3",
    title: "Steam engine starting and pulling away",
    note: "The beat from about 3 a second, as it gets moving, to 5; it reaches 9-10 at speed later in the recording. 40 s of 110.",
    source: {
      title: "TRNSteam_Steam engine train starts and pulls away",
      url: archive("SSE_Library_TRAINS"),
      author: "SSE Library (archive.org)",
      licence: "CC0 1.0",
    },
  },
  steamWhistle: {
    file: "steam-whistle-pulls-out.mp3",
    title: "Steam train whistle",
    note: "The whistle's chord: partials at 516, 1446, 2080 and 2497 Hz, the top one loudest; the design's pipes keep that shape. 14 s of 60.",
    source: {
      title: "TRNSteam_Steam train whistles then pulls out",
      url: archive("SSE_Library_TRAINS"),
      author: "SSE Library (archive.org)",
      licence: "CC0 1.0",
    },
  },
  tramBellKt4: {
    file: "tram-bell-tatra-kt4dm.mp3",
    title: "Tatra KT4DM tram, its bell as the doors close",
    note: "A Czech-built tram at a stop in Frankfurt (Oder); the bell rings for 2.8 s from 5.7 s in. Its partials (1565, 3647, 6230, 9295, 12452 Hz) and 50 strikes a second are the design's. 16 s of 74.",
    source: {
      title: "Tram station \"Stadion\", Frankfurt (Oder) - Old Tatra KT4DM tram at the station",
      url: archive("aporee_64341_74254"),
      author: "Niklas Dahlmann (radio aporee)",
      licence: "CC BY 3.0",
    },
  },
  electricIdle: {
    file: "electric-loco-idle-station.mp3",
    title: "Electric locomotive idling at Kosice",
    note: "A diesel-hauled train leaves while an electric locomotive idles at the same platform: its blowers set the design's level against the rest. 25 s of 226.",
    source: { title: "Trains at Kosice Station", url: archive("aporee_54418_62243"), author: "Rastislav Gulasa (radio aporee)", licence: "Public Domain Mark 1.0" },
  },
  iceDeparting: {
    file: "electric-train-departing.mp3",
    title: "ICE pulling out of Berlin Hauptbahnhof",
    note: "The converters' cluster of tones near 1180, 1830, 2420, 2750 and 3070 Hz rising about 8 %, over a steady 620 Hz. 30 s of 329.",
    source: {
      title: "Berlin. Hauptbahnhof - ICE am Gleis 7",
      url: archive("aporee_21357_24792"),
      author: "Fritz Schlueter (radio aporee)",
      licence: "CC BY 3.0",
    },
  },
  shinkansenPassing: {
    file: "shinkansen-passing.mp3",
    title: "Shinkansen passing Odawara",
    note: "A set passing the platform without stopping, 6 s in: a flat block of broadband noise, most of it below 1.2 kHz, about six seconds long. 22 s of 386.",
    source: {
      title: "Odawara Station - Shinkansen train leaving for Nagoya",
      url: archive("aporee_70028_81566"),
      author: "Flavien Gillie (radio aporee)",
      licence: "Public Domain Mark 1.0",
    },
  },
  helicopterHover: {
    file: "helicopter-hover.mp3",
    title: "Helicopter hovering",
    note: "A light two-bladed helicopter in a steady hover: the slap at 11.8 Hz (about 350 rpm), the tail rotor's lines at 159 and 233 Hz the strongest, the rest broad from 125 Hz to 2 kHz and falling above, no turbine line standing out. 25 s of 29.",
    source: { title: "G36-19 Helicopter Constant Hover", url: archive("GOLD_TAPE_36_Helicopters"), author: USC, licence: "CC0 1.0" },
  },
  helicopterStart: {
    file: "helicopter-start-lift-off.mp3",
    title: "Helicopter starting and lifting off",
    note: "The rotor running up after the engine starts: the turbine's line near 1.5 kHz, weak (about 20 dB under the rotor). 25 s of 63.",
    source: { title: "G36-02 Helicopter Start and Lift-Off", url: archive("GOLD_TAPE_36_Helicopters"), author: USC, licence: "CC0 1.0" },
  },
  horseWalkPavement: {
    file: "horse-walk-pavement.mp3",
    title: "Horse walking on pavement",
    note: "A shod horse walking on hard ground: four nearly even footfalls about 0.3 s apart, the knock at 580-770 Hz and a sharp click (a footfall's centroid 2.6 kHz). 15 s of 84.",
    source: { title: "G38-10 Horse Walks on Pavement", url: archive("GOLD_TAPE_38_Horses"), author: USC, licence: "CC0 1.0" },
  },
  horseTrotStone: {
    file: "horse-trot-stone.mp3",
    title: "Horse trotting on stone",
    note: "The trot's diagonal pairs landing 45-60 ms apart, the knock at 540-590 Hz the loudest band, a footfall falling 20 dB in about 90 ms. 16 s of 16.",
    source: { title: "R13-53 Horse Trotting on Stone", url: archive("Red_Library_Animals_Horses_2"), author: USC, licence: "CC0 1.0" },
  },
  horseTackJingle: {
    file: "horse-tack-jingle.mp3",
    title: "Horse with its tack jingling",
    note: "A horse at a steady walk with its tack jingling: the jingle a band near 3 kHz, about 20 dB under the hooves. 12 s of 20.",
    source: { title: "R13-15 Horse Steady with Tack Jingle", url: archive("Red_Library_Animals_Horses_1"), author: USC, licence: "CC0 1.0" },
  },
  horsesPullWagon: {
    file: "horses-pull-wagon.mp3",
    title: "Two horses pulling a wagon",
    note: "A team of two out of step: denser footfalls (about 6 a second), never one doubled beat. 15 s of 34.",
    source: { title: "R22-01 Two Horses Pull Wagon", url: archive("Red_Library_Wagons"), author: USC, licence: "CC0 1.0" },
  },
  oxCart: {
    file: "ox-cart.mp3",
    title: "Ox cart",
    note: "Cloven feet: darker footfalls (centroid about 700 Hz, most of it under 400 Hz) with frequent double knocks, and a harness bell near 5.3 kHz. 15 s of 53.",
    source: { title: "G52-05 Ox Cart", url: archive("GOLD_TAPE_52_Wagons"), author: USC, licence: "CC0 1.0" },
  },
  horseWhinny: {
    file: "horse-whinny.mp3",
    title: "Horse whinny",
    note: "A whinny of 1.4 s: a near-pure tone at 1470-1580 Hz falling to about 1150 Hz, joined by a second voice near 500 falling to 360 Hz. 4.5 s of 17.",
    source: { title: "G38-15 Perfect Horse Whinny", url: archive("GOLD_TAPE_38_Horses"), author: USC, licence: "CC0 1.0" },
  },
  cowsMooing: {
    file: "cows-mooing.mp3",
    title: "Cows mooing",
    note: "A moo of 2.3 s at 185 rising to 210-220 Hz, its loudest harmonic moving from the fundamental to near 850 Hz as the mouth opens. 7.5 s of 23.",
    source: { title: "G12-16 Cows Mooing", url: archive("GOLD_TAPE_12_Animals"), author: USC, licence: "CC0 1.0" },
  },
  camelGrunt: {
    file: "camel-grunt.mp3",
    title: "Camel grunting",
    note: "A groan near 130 Hz with a subharmonic near 66 Hz, its second harmonic the strongest, dark (centroid about 350 Hz). 11 s of 23.",
    source: { title: "G12-05 Camel Grunt", url: archive("GOLD_TAPE_12_Animals"), author: USC, licence: "CC0 1.0" },
  },
  elephantTrumpeting: {
    file: "elephant-trumpeting.mp3",
    title: "Elephant trumpeting",
    note: "A trumpet at 600 rising to 735 Hz and falling to 500 Hz, bright: its energy centred near 3 kHz. 8 s of 22.",
    source: { title: "G12-17 Elephant Trumpeting", url: archive("GOLD_TAPE_12_Animals"), author: USC, licence: "CC0 1.0" },
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
  "steam-chuff": [R.steamStarts],
  "steam-whistle": [R.steamWhistle],
  "electric-engine-resistor": [R.electricIdle],
  "electric-engine-converter": [R.iceDeparting],
  "electric-engine-shinkansen": [R.shinkansenPassing],
  "tram-bell": [R.tramBellKt4],
  helicopter: [R.helicopterHover, R.helicopterStart],
  "hoof-beat": [R.horseWalkPavement, R.horseTrotStone, R.horseTackJingle, R.horsesPullWagon, R.oxCart],
  // No CC0 donkey bray or mule call could be fetched: those two species are modelled.
  "animal-call": [R.horseWhinny, R.cowsMooing, R.camelGrunt, R.elephantTrumpeting],
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
