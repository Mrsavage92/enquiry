/**
 * Where an owner works, and where a job is.
 *
 * Deliberately small and conservative. A region is only one this file knows,
 * and a place in an enquiry is only one on its known-place list: a place
 * Enquiry cannot place is never guessed to be inside or outside, it is asked
 * about. The lists cover South East Queensland, where the first trial
 * businesses work; a region outside them is kept as the owner's note, exactly
 * as before, never read as an area Enquiry cannot check.
 */

type Region = {
  /** How the reply and the owner's read-back name it. */
  label: string;
  /** The wider region it is part of: Brisbane northside is part of Brisbane. */
  parent?: string;
  /** Ways an owner or a customer writes the region itself. */
  names: string[];
};

export const REGIONS: Record<string, Region> = {
  "sunshine coast": { label: "the Sunshine Coast", names: ["sunshine coast", "sunny coast"] },
  "sunshine coast hinterland": {
    label: "the Sunshine Coast Hinterland",
    names: ["sunshine coast hinterland"],
  },
  noosa: { label: "Noosa", parent: "sunshine coast", names: ["noosa"] },
  brisbane: { label: "Brisbane", names: ["brisbane", "brissy", "brisvegas"] },
  "brisbane northside": {
    label: "Brisbane northside",
    parent: "brisbane",
    names: [
      "brisbane northside",
      "northside",
      "north brisbane",
      "brisbane north",
      "northern suburbs",
    ],
  },
  "brisbane southside": {
    label: "Brisbane southside",
    parent: "brisbane",
    names: ["brisbane southside", "southside", "south brisbane suburbs", "brisbane south"],
  },
  "moreton bay": { label: "Moreton Bay", names: ["moreton bay"] },
  "gold coast": { label: "the Gold Coast", names: ["gold coast", "goldy"] },
  logan: { label: "Logan", names: ["logan"] },
  ipswich: { label: "Ipswich", names: ["ipswich"] },
  redlands: { label: "the Redlands", names: ["redlands", "redland city", "redland bay"] },
  "scenic rim": { label: "the Scenic Rim", names: ["scenic rim"] },
  toowoomba: { label: "Toowoomba", names: ["toowoomba"] },
};

/**
 * Known places, each with the regions it is in. A place on two lists (Albany
 * Creek is Moreton Bay council and Brisbane northside) is inside an area that
 * names either. Kept short on purpose: a place missing here is asked about.
 */
const PLACES: Record<string, string[]> = {
  // Sunshine Coast
  maroochydore: ["sunshine coast"],
  mooloolaba: ["sunshine coast"],
  caloundra: ["sunshine coast"],
  "noosa heads": ["noosa"],
  noosaville: ["noosa"],
  tewantin: ["noosa"],
  "sunshine beach": ["noosa"],
  peregian: ["sunshine coast"],
  "peregian beach": ["sunshine coast"],
  coolum: ["sunshine coast"],
  "coolum beach": ["sunshine coast"],
  buderim: ["sunshine coast"],
  "sippy downs": ["sunshine coast"],
  kawana: ["sunshine coast"],
  "kawana waters": ["sunshine coast"],
  "alexandra headland": ["sunshine coast"],
  marcoola: ["sunshine coast"],
  mudjimba: ["sunshine coast"],
  "twin waters": ["sunshine coast"],
  "pelican waters": ["sunshine coast"],
  "golden beach": ["sunshine coast"],
  "kings beach": ["sunshine coast"],
  currimundi: ["sunshine coast"],
  birtinya: ["sunshine coast"],
  "mountain creek": ["sunshine coast"],
  "bli bli": ["sunshine coast"],
  nambour: ["sunshine coast", "sunshine coast hinterland"],
  yaroomba: ["sunshine coast"],
  // Sunshine Coast Hinterland
  maleny: ["sunshine coast hinterland"],
  montville: ["sunshine coast hinterland"],
  mapleton: ["sunshine coast hinterland"],
  flaxton: ["sunshine coast hinterland"],
  eumundi: ["sunshine coast hinterland"],
  yandina: ["sunshine coast hinterland"],
  palmwoods: ["sunshine coast hinterland"],
  woombye: ["sunshine coast hinterland"],
  kenilworth: ["sunshine coast hinterland"],
  pomona: ["sunshine coast hinterland"],
  cooroy: ["sunshine coast hinterland"],
  peachester: ["sunshine coast hinterland"],
  landsborough: ["sunshine coast hinterland"],
  beerwah: ["sunshine coast hinterland"],
  "glass house mountains": ["sunshine coast hinterland"],
  conondale: ["sunshine coast hinterland"],
  witta: ["sunshine coast hinterland"],
  cooran: ["sunshine coast hinterland"],
  // Gold Coast
  burleigh: ["gold coast"],
  "burleigh heads": ["gold coast"],
  "surfers paradise": ["gold coast"],
  surfers: ["gold coast"],
  southport: ["gold coast"],
  broadbeach: ["gold coast"],
  coolangatta: ["gold coast"],
  robina: ["gold coast"],
  nerang: ["gold coast"],
  "palm beach": ["gold coast"],
  currumbin: ["gold coast"],
  coomera: ["gold coast"],
  helensvale: ["gold coast"],
  "mermaid beach": ["gold coast"],
  "varsity lakes": ["gold coast"],
  "main beach": ["gold coast"],
  tugun: ["gold coast"],
  mudgeeraba: ["gold coast"],
  tamborine: ["gold coast", "scenic rim"],
  "tamborine mountain": ["gold coast", "scenic rim"],
  // Brisbane northside
  chermside: ["brisbane northside"],
  aspley: ["brisbane northside"],
  kedron: ["brisbane northside"],
  nundah: ["brisbane northside"],
  stafford: ["brisbane northside"],
  "everton park": ["brisbane northside"],
  "bracken ridge": ["brisbane northside"],
  sandgate: ["brisbane northside"],
  "wavell heights": ["brisbane northside"],
  geebung: ["brisbane northside"],
  zillmere: ["brisbane northside"],
  carseldine: ["brisbane northside"],
  boondall: ["brisbane northside"],
  northgate: ["brisbane northside"],
  clayfield: ["brisbane northside"],
  ascot: ["brisbane northside"],
  lutwyche: ["brisbane northside"],
  "gordon park": ["brisbane northside"],
  wilston: ["brisbane northside"],
  alderley: ["brisbane northside"],
  enoggera: ["brisbane northside"],
  mitchelton: ["brisbane northside"],
  "ferny grove": ["brisbane northside"],
  keperra: ["brisbane northside"],
  "albany creek": ["brisbane northside", "moreton bay"],
  strathpine: ["brisbane northside", "moreton bay"],
  // Brisbane southside
  sunnybank: ["brisbane southside"],
  "mount gravatt": ["brisbane southside"],
  "mt gravatt": ["brisbane southside"],
  carindale: ["brisbane southside"],
  coorparoo: ["brisbane southside"],
  woolloongabba: ["brisbane southside"],
  annerley: ["brisbane southside"],
  moorooka: ["brisbane southside"],
  "acacia ridge": ["brisbane southside"],
  inala: ["brisbane southside"],
  wynnum: ["brisbane southside"],
  "holland park": ["brisbane southside"],
  greenslopes: ["brisbane southside"],
  "camp hill": ["brisbane southside"],
  bulimba: ["brisbane southside"],
  yeronga: ["brisbane southside"],
  tarragindi: ["brisbane southside"],
  calamvale: ["brisbane southside"],
  "eight mile plains": ["brisbane southside"],
  rochedale: ["brisbane southside"],
  mansfield: ["brisbane southside"],
  // Brisbane, neither side
  paddington: ["brisbane"],
  toowong: ["brisbane"],
  "red hill": ["brisbane"],
  bardon: ["brisbane"],
  milton: ["brisbane"],
  auchenflower: ["brisbane"],
  taringa: ["brisbane"],
  indooroopilly: ["brisbane"],
  "st lucia": ["brisbane"],
  kenmore: ["brisbane"],
  ashgrove: ["brisbane"],
  "kelvin grove": ["brisbane"],
  "spring hill": ["brisbane"],
  "fortitude valley": ["brisbane"],
  "new farm": ["brisbane"],
  teneriffe: ["brisbane"],
  newstead: ["brisbane"],
  "west end": ["brisbane"],
  // Moreton Bay
  redcliffe: ["moreton bay"],
  "north lakes": ["moreton bay"],
  caboolture: ["moreton bay"],
  morayfield: ["moreton bay"],
  "deception bay": ["moreton bay"],
  petrie: ["moreton bay"],
  kallangur: ["moreton bay"],
  narangba: ["moreton bay"],
  burpengary: ["moreton bay"],
  scarborough: ["moreton bay"],
  margate: ["moreton bay"],
  "woody point": ["moreton bay"],
  // Logan, Ipswich, Redlands, Scenic Rim
  springwood: ["logan"],
  beenleigh: ["logan"],
  "browns plains": ["logan"],
  loganholme: ["logan"],
  "shailer park": ["logan"],
  "slacks creek": ["logan"],
  woodridge: ["logan"],
  springfield: ["ipswich"],
  goodna: ["ipswich"],
  redbank: ["ipswich"],
  capalaba: ["redlands"],
  cleveland: ["redlands"],
  "victoria point": ["redlands"],
  "wellington point": ["redlands"],
  thornlands: ["redlands"],
  beaudesert: ["scenic rim"],
  boonah: ["scenic rim"],
};

export function isRegion(key: string): boolean {
  return key in REGIONS;
}

export function regionLabel(key: string): string {
  return REGIONS[key]?.label ?? key;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Found = { name: string; regions: string[]; index: number };

/** Places that are also people's names or surnames. */
const ALSO_A_NAME = new Set(["logan", "milton", "stafford", "cleveland", "petrie", "scarborough"]);
const PLACE_LEAD = /\b(?:in|at|from|to|near|around|out|over|up)\s+(?:the\s+)?$/;

/** Every known place or region named in a text, longest name first, never twice for one span. */
export function placesIn(text: string): Found[] {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const names: [string, string[]][] = [
    ...Object.entries(PLACES),
    ...Object.entries(REGIONS).flatMap(([key, r]) =>
      r.names.map((n): [string, string[]] => [n, [key]]),
    ),
  ].sort((a, b) => b[0].length - a[0].length);
  const taken: [number, number][] = [];
  const out: Found[] = [];
  for (const [name, regions] of names) {
    const re = new RegExp(String.raw`\b${escape(name)}\b`, "g");
    for (const m of lower.matchAll(re)) {
      const at = m.index ?? 0;
      const end = at + name.length;
      if (taken.some(([a, b]) => at < b && end > a)) continue;
      // "Hi it's Logan": a name that is also a person's is a place only after "in", "at", "from".
      if (ALSO_A_NAME.has(name) && !PLACE_LEAD.test(lower.slice(Math.max(0, at - 14), at))) {
        continue;
      }
      taken.push([at, end]);
      out.push({ name, regions, index: at });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * The regions an owner names in "We cover the Sunshine Coast and Hinterland",
 * or null when any part of it is a place Enquiry does not know as a region:
 * an area half-read would flag jobs the owner does take.
 */
export function readAreas(said: string): string[] | null {
  const parts = said
    .toLowerCase()
    .replace(/\b(?:the|only|areas?|region|suburbs?|surrounds|surrounding|and\s+surrounds)\b/g, " ")
    .split(/\s*(?:,|&|\/|\band\b|\bplus\b|\bor\b)\s*/)
    .map((p) =>
      p
        .replace(/[^a-z' ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  if (parts.length === 0) return null;
  const out: string[] = [];
  for (const part of parts) {
    // "Sunshine Coast and Hinterland": the hinterland of the coast just named.
    if (/^hinterland$/.test(part) && out.includes("sunshine coast")) {
      out.push("sunshine coast hinterland");
      continue;
    }
    const key = Object.entries(REGIONS).find(([, r]) => r.names.includes(part))?.[0];
    if (!key) return null;
    out.push(key);
  }
  return [...new Set(out)];
}

export type AreaFit =
  | { fit: "inside" }
  | { fit: "outside"; place: string; region: string }
  | { fit: "unclear"; place: string }
  | { fit: "unknown" };

function within(region: string, areas: readonly string[]): boolean {
  if (areas.includes(region)) return true;
  const parent = REGIONS[region]?.parent;
  return parent ? areas.includes(parent) : false;
}

/** A wider region holding part of the area: "Brisbane" when only the northside is covered. */
function holdsPartOf(region: string, areas: readonly string[]): boolean {
  return areas.some((a) => REGIONS[a]?.parent === region);
}

/**
 * Where a job stands against the owner's area. Outside only when every region
 * the place is in is clearly not theirs; a place in a wider region that holds
 * part of the area ("Paddington", Brisbane, against "northside only") is
 * unclear, and so is a message naming places on both sides.
 */
export function areaFit(message: string, areas: readonly string[]): AreaFit {
  const found = placesIn(message);
  if (found.length === 0) return { fit: "unknown" };
  let unclear: Found | undefined;
  let outside: { place: Found; region: string } | undefined;
  let inside = false;
  for (const f of found) {
    if (f.regions.some((r) => within(r, areas))) {
      inside = true;
      continue;
    }
    if (f.regions.some((r) => holdsPartOf(r, areas))) {
      unclear ??= f;
      continue;
    }
    outside ??= { place: f, region: f.regions[0]! };
  }
  if (outside && !inside && !unclear) {
    return { fit: "outside", place: titleCase(outside.place.name), region: outside.region };
  }
  if (outside || unclear) {
    return { fit: "unclear", place: titleCase((outside?.place ?? unclear)!.name) };
  }
  return inside ? { fit: "inside" } : { fit: "unknown" };
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
