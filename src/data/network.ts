/**
 * Delhi pilot network - derived from REAL agency data.
 *
 * Metro lines and bus corridors are generated from the official
 * Delhi Open Transit Data GTFS snapshots by `scripts/ingest-gtfs.mjs`
 * (see LIMITATIONS.md for provenance). The curated arrays at the bottom are
 * a fallback used only if the generated files are missing or malformed.
 *
 * All vehicle movement simulated on top of this network is synthetic (DEMO).
 */
import metroLinesJson from "./generated/metro-lines.json";
import busCorridorsJson from "./generated/bus-corridors.json";
import { BUS_BASES, METRO_BASES } from "@/lib/route-palette";

export interface NetworkStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface MetroLine {
  id: string;
  name: string;
  shortName: string;
  color: string;
  speedKmh: number; // effective incl. dwell
  stations: NetworkStop[]; // ordered along the line
}

export interface BusRoute {
  id: string;
  number: string;
  name: string;
  color: string;
  speedKmh: number; // effective incl. traffic + dwell
  cycleMinutes: number; // full out-and-back round trip for simulation
  vehicles: number;
  stops: NetworkStop[]; // ordered along the route
}

export const WALK_KMH = 4.8;
export const BUS_BOARD_MIN = 2.5; // average wait to board a bus
export const METRO_BOARD_MIN = 3.5; // security + platform wait
export const TRANSFER_PENALTY_MIN = 2;
/** Average time a bus loses at an intermediate stop. */
export const BUS_DWELL_MIN = 0.6;
/**
 * Central Delhi (roughly south of the Ring North / Connaught Place grid)
 * traffic penalty applied to bus segment speeds — buses crawl there at rush
 * hour while the metro is unaffected. Disclosed in LIMITATIONS.md.
 */
export const CENTRAL_DELHI_LAT = 28.6;
export const CENTRAL_BUS_SPEED_FACTOR = 0.8;

export const AUTO_SPEED_KMH = 20; // effective Delhi auto speed incl. traffic
export const AUTO_BOARD_MIN = 3; // average wait hailing an auto
export const AUTO_BASE_FARE_INR = 30; // covers the first 1.5 km
export const AUTO_BASE_KM = 1.5;
export const AUTO_PER_KM_INR = 11; // charged beyond the base slab
/** Direct walks longer than this trigger the auto-rickshaw fallback. */
export const AUTO_WALK_THRESHOLD_MIN = 15;
/**
 * How far an auto will reasonably carry a rider to reach the network. Used
 * only for first/last-mile assist, never for the whole trip.
 */
export const AUTO_ACCESS_MAX_METERS = 6000;
/**
 * An access or egress walk longer than this is worth replacing with an auto.
 * ~10 minutes on foot.
 */
export const AUTO_SWITCH_METERS = 800;
/**
 * Total walking above which we proactively offer an auto-assisted variant
 * alongside the all-walking itinerary.
 */
export const AUTO_ASSIST_TRIGGER_METERS = 1400;

// ------------------------------------------------------------- Loading ----

function isStopArray(v: unknown): v is NetworkStop[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (s) =>
        typeof (s as NetworkStop).id === "string" &&
        typeof (s as NetworkStop).name === "string" &&
        typeof (s as NetworkStop).lat === "number",
    )
  );
}

const BUS_PALETTE = BUS_BASES.map((p) => p.light);

function loadMetroLines(): MetroLine[] {
  if (!Array.isArray(metroLinesJson) || metroLinesJson.length === 0) {
    return CURATED_METRO_LINES;
  }
  const lines: MetroLine[] = [];
  for (const raw of metroLinesJson as unknown as Array<Record<string, unknown>>) {
    if (!isStopArray(raw.stations)) continue;
    const name = typeof raw.name === "string" ? raw.name : "Line";
    lines.push({
      id: typeof raw.id === "string" ? raw.id : name.toLowerCase().replace(/\s+/g, "-"),
      name,
      shortName: name.replace(/\s*Line.*$/u, "").trim() || name,
      color: typeof raw.color === "string" ? raw.color : BUS_BASES[0].light,
      speedKmh: typeof raw.speedKmh === "number" ? raw.speedKmh : 33,
      stations: raw.stations,
    });
  }
  return lines.length ? lines : CURATED_METRO_LINES;
}

function loadBusRoutes(): BusRoute[] {
  if (!Array.isArray(busCorridorsJson) || busCorridorsJson.length === 0) {
    return CURATED_BUS_ROUTES;
  }
  const routes: BusRoute[] = [];
  let i = 0;
  for (const raw of busCorridorsJson as unknown as Array<Record<string, unknown>>) {
    if (!isStopArray(raw.stops)) continue;
    const number = typeof raw.number === "string" ? raw.number : String(i + 1);
    routes.push({
      id: typeof raw.id === "string" ? raw.id : `bus:${number}`,
      number,
      name: typeof raw.name === "string" ? raw.name : `Corridor ${number}`,
      color: BUS_PALETTE[i % BUS_PALETTE.length],
      speedKmh: typeof raw.speedKmh === "number" ? raw.speedKmh : 16,
      cycleMinutes:
        typeof raw.cycleMinutes === "number" ? raw.cycleMinutes : 60,
      vehicles: typeof raw.vehicles === "number" ? raw.vehicles : 4,
      stops: raw.stops,
    });
    i++;
  }
  return routes.length ? routes : CURATED_BUS_ROUTES;
}

// ------------------------------------------- Real-data network (primary) ---

export const METRO_LINES: MetroLine[] = loadMetroLines();
export const BUS_ROUTES: BusRoute[] = loadBusRoutes();

/** The corridor used by the scripted demo disruption. */
export const PRIMARY_BUS_NUMBER = BUS_ROUTES[0]?.number ?? "620";

// ------------------------------------------------------------ Landmarks ---

export interface Landmark {
  id: string;
  name: string;
  lat: number;
  lon: number;
  aliases?: string[];
}

export const LANDMARKS: Landmark[] = [
  {
    id: "lm:connaught-place",
    name: "Connaught Place",
    lat: 28.6315,
    lon: 77.2167,
    aliases: ["CP", "कनॉट प्लेस", "Rajiv Chowk", "Regal"],
  },
  {
    id: "lm:india-gate",
    name: "India Gate",
    lat: 28.6129,
    lon: 77.2295,
    aliases: ["इंडिया गेट"],
  },
  {
    id: "lm:red-fort",
    name: "Red Fort",
    lat: 28.6562,
    lon: 77.241,
    aliases: ["Lal Qila", "लाल किला"],
  },
  {
    id: "lm:jama-masjid",
    name: "Jama Masjid",
    lat: 28.6507,
    lon: 77.2334,
    aliases: ["जामा मस्जिद"],
  },
  {
    id: "lm:new-delhi-railway",
    name: "New Delhi Railway Station",
    lat: 28.6425,
    lon: 77.2199,
    aliases: ["NDLS", "नई दिल्ली रेलवे स्टेशन"],
  },
  {
    id: "lm:aiims-hospital",
    name: "AIIMS Hospital",
    lat: 28.5672,
    lon: 77.21,
    aliases: ["एम्स", "All India Institute of Medical Sciences"],
  },
  {
    id: "lm:iit-delhi",
    name: "IIT Delhi Main Gate",
    lat: 28.547,
    lon: 77.17,
    aliases: ["IIT", "आईआईटी दिल्ली"],
  },
  {
    id: "lm:munirka-market",
    name: "Munirka",
    lat: 28.558,
    lon: 77.1765,
    aliases: ["Munirka Village", "मुनिरका"],
  },
  {
    id: "lm:nehru-place-market",
    name: "Nehru Place Tech Market",
    lat: 28.5495,
    lon: 77.251,
    aliases: ["नेहरू प्लेस"],
  },
  {
    id: "lm:kashmere-gate-isbt",
    name: "Kashmere Gate ISBT",
    lat: 28.6672,
    lon: 77.2282,
    aliases: ["ISBT", "कश्मीरी गेट"],
  },
  {
    id: "lm:lotus-temple",
    name: "Lotus Temple",
    lat: 28.5535,
    lon: 77.2588,
    aliases: ["Bahai Temple", "बहाई मंदिर"],
  },
  {
    id: "lm:hauz-khas-village",
    name: "Hauz Khas Village",
    lat: 28.5535,
    lon: 77.1947,
    aliases: ["HKV", "हौज़ ख़ास"],
  },
  // ---- Pilot-area landmarks (added so search covers more than metro
  // stations). Coordinates for names that exist in the DMRC feed are taken
  // straight from it; the rest are approximate area centroids. The router
  // walks up to DEFAULT_MAX_WALK_METERS to reach the network, so a centroid
  // within ~1.5 km of a station still plans a real transit journey.
  {
    id: "lm:saket-citywalk",
    name: "Saket",
    lat: 28.52064,
    lon: 77.19938,
    aliases: ["Select Citywalk", "साकेत"],
  },
  {
    id: "lm:lajpat-nagar",
    name: "Lajpat Nagar Central Market",
    lat: 28.57071,
    lon: 77.23312,
    aliases: ["Lajpat Nagar", "लाजपत नगर"],
  },
  {
    id: "lm:karol-bagh",
    name: "Karol Bagh Market",
    lat: 28.64392,
    lon: 77.18842,
    aliases: ["Karol Bagh", "करोल बाग"],
  },
  {
    id: "lm:sarojini-nagar",
    name: "Sarojini Nagar Market",
    lat: 28.57021,
    lon: 77.18787,
    aliases: ["Sarojini", "सरोजिनी नगर"],
  },
  {
    id: "lm:chandni-chowk",
    name: "Chandni Chowk",
    lat: 28.656,
    lon: 77.2303,
    aliases: ["चांदनी चौक"],
  },
  {
    id: "lm:khan-market",
    name: "Khan Market",
    lat: 28.60268,
    lon: 77.2281,
    aliases: ["खान मार्केट"],
  },
  {
    id: "lm:dilli-haat",
    name: "Dilli Haat INA",
    lat: 28.5752,
    lon: 77.20947,
    aliases: ["Dilli Haat", "दिल्ली हाट"],
  },
  {
    id: "lm:rajouri-garden",
    name: "Rajouri Garden",
    lat: 28.64916,
    lon: 77.12275,
    aliases: ["राजौरी गार्डन"],
  },
  {
    id: "lm:janakpuri",
    name: "Janakpuri",
    lat: 28.6219,
    lon: 77.0878,
    aliases: ["जनकपुरी"],
  },
  {
    id: "lm:dwarka-sec21",
    name: "Dwarka Sector 21",
    lat: 28.55232,
    lon: 77.0562,
    aliases: ["Dwarka", "द्वारका"],
  },
  {
    id: "lm:rohini",
    name: "Rohini",
    lat: 28.74019,
    lon: 77.13557,
    aliases: ["रोहिणी"],
  },
  {
    id: "lm:pitampura",
    name: "Pitampura",
    lat: 28.70318,
    lon: 77.13236,
    aliases: ["पीतमपुरा"],
  },
  {
    id: "lm:model-town",
    name: "Model Town",
    lat: 28.70283,
    lon: 77.19376,
    aliases: ["मॉडल टाउन"],
  },
  {
    id: "lm:civil-lines",
    name: "Civil Lines",
    lat: 28.6772,
    lon: 77.225,
    aliases: ["सिविल लाइंस"],
  },
  {
    id: "lm:du-north-campus",
    name: "Delhi University North Campus",
    lat: 28.6889,
    lon: 77.2094,
    aliases: ["DU", "North Campus", "दिल्ली विश्वविद्यालय"],
  },
  {
    id: "lm:jnu",
    name: "Jawaharlal Nehru University",
    lat: 28.5383,
    lon: 77.1641,
    aliases: ["JNU", "जेएनयू"],
  },
  {
    id: "lm:jamia",
    name: "Jamia Millia Islamia",
    lat: 28.56294,
    lon: 77.28621,
    aliases: ["Jamia", "जामिया"],
  },
  {
    id: "lm:okhla",
    name: "Okhla Industrial Area",
    lat: 28.5303,
    lon: 77.2731,
    aliases: ["Okhla", "ओखला"],
  },
  {
    id: "lm:kalkaji",
    name: "Kalkaji",
    lat: 28.5487,
    lon: 77.2596,
    aliases: ["कालकाजी"],
  },
  {
    id: "lm:greater-kailash",
    name: "Greater Kailash M Block Market",
    lat: 28.54184,
    lon: 77.23824,
    aliases: ["GK", "Greater Kailash", "ग्रेटर कैलाश"],
  },
  {
    id: "lm:defence-colony",
    name: "Defence Colony",
    lat: 28.5719,
    lon: 77.2296,
    aliases: ["डिफेंस कॉलोनी"],
  },
  {
    id: "lm:green-park",
    name: "Green Park",
    lat: 28.56,
    lon: 77.2065,
    aliases: ["ग्रीन पार्क"],
  },
  {
    id: "lm:safdarjung-hospital",
    name: "Safdarjung Hospital",
    lat: 28.568,
    lon: 77.207,
    aliases: ["सफदरजंग अस्पताल"],
  },
  {
    id: "lm:apollo-sarita-vihar",
    name: "Apollo Hospital Sarita Vihar",
    lat: 28.541,
    lon: 77.283,
    aliases: ["Apollo", "अपोलो अस्पताल"],
  },
  {
    id: "lm:max-saket",
    name: "Max Hospital Saket",
    lat: 28.528,
    lon: 77.2145,
    aliases: ["Max Saket"],
  },
  {
    id: "lm:vasant-kunj",
    name: "Vasant Kunj",
    lat: 28.52,
    lon: 77.1591,
    aliases: ["वसंत कुंज"],
  },
  {
    id: "lm:vasant-vihar",
    name: "Vasant Vihar",
    lat: 28.55838,
    lon: 77.16077,
    aliases: ["वसंत विहार"],
  },
  {
    id: "lm:chanakyapuri",
    name: "Chanakyapuri",
    lat: 28.59,
    lon: 77.187,
    aliases: ["चाणक्यपुरी"],
  },
  {
    id: "lm:rashtrapati-bhavan",
    name: "Rashtrapati Bhavan",
    lat: 28.6143,
    lon: 77.1994,
    aliases: ["राष्ट्रपति भवन"],
  },
  {
    id: "lm:parliament",
    name: "Parliament House",
    lat: 28.6172,
    lon: 77.2082,
    aliases: ["Sansad Bhavan", "संसद भवन"],
  },
  {
    id: "lm:qutub-minar",
    name: "Qutub Minar",
    lat: 28.5245,
    lon: 77.1855,
    aliases: ["क़ुतुब मीनार"],
  },
  {
    id: "lm:humayuns-tomb",
    name: "Humayun's Tomb",
    lat: 28.5933,
    lon: 77.2507,
    aliases: ["हुमायूँ का मक़बरा"],
  },
  {
    id: "lm:akshardham",
    name: "Akshardham Temple",
    lat: 28.61836,
    lon: 77.27982,
    aliases: ["अक्षरधाम"],
  },
  {
    id: "lm:nizamuddin-railway",
    name: "Hazrat Nizamuddin Railway Station",
    lat: 28.5885,
    lon: 77.251,
    aliases: ["Nizamuddin", "निज़ामुद्दीन"],
  },
  {
    id: "lm:old-delhi-railway",
    name: "Old Delhi Railway Station",
    lat: 28.6614,
    lon: 77.2276,
    aliases: ["Purani Dilli", "पुरानी दिल्ली रेलवे स्टेशन"],
  },
  {
    id: "lm:anand-vihar-isbt",
    name: "Anand Vihar ISBT",
    lat: 28.6469,
    lon: 77.316,
    aliases: ["Anand Vihar", "आनंद विहार"],
  },
  {
    id: "lm:sarai-kale-khan",
    name: "Sarai Kale Khan ISBT",
    lat: 28.589,
    lon: 77.257,
    aliases: ["सराय काले खां"],
  },
  {
    id: "lm:igi-t3",
    name: "IGI Airport Terminal 3",
    lat: 28.55487,
    lon: 77.08792,
    aliases: ["Airport", "T3", "हवाई अड्डा"],
  },
  {
    id: "lm:pragati-maidan",
    name: "Pragati Maidan",
    lat: 28.618,
    lon: 77.243,
    aliases: ["प्रगति मैदान"],
  },
  {
    id: "lm:lodhi-garden",
    name: "Lodhi Garden",
    lat: 28.5931,
    lon: 77.2197,
    aliases: ["लोधी गार्डन"],
  },
  {
    id: "lm:malviya-nagar",
    name: "Malviya Nagar",
    lat: 28.5285,
    lon: 77.2065,
    aliases: ["मालवीय नगर"],
  },
  {
    id: "lm:rk-puram",
    name: "R K Puram",
    lat: 28.564,
    lon: 77.175,
    aliases: ["RK Puram", "आर के पुरम"],
  },
  {
    id: "lm:netaji-subhash-place",
    name: "Netaji Subhash Place",
    lat: 28.695,
    lon: 77.152,
    aliases: ["NSP", "नेताजी सुभाष प्लेस"],
  },
  {
    id: "lm:shalimar-bagh",
    name: "Shalimar Bagh",
    lat: 28.70182,
    lon: 77.16518,
    aliases: ["शालीमार बाग"],
  },
  {
    id: "lm:ashok-vihar",
    name: "Ashok Vihar",
    lat: 28.69,
    lon: 77.176,
    aliases: ["अशोक विहार"],
  },
  {
    id: "lm:punjabi-bagh",
    name: "Punjabi Bagh",
    lat: 28.67275,
    lon: 77.13918,
    aliases: ["पंजाबी बाग"],
  },
  {
    id: "lm:paschim-vihar",
    name: "Paschim Vihar",
    lat: 28.67854,
    lon: 77.10212,
    aliases: ["पश्चिम विहार"],
  },
  {
    id: "lm:uttam-nagar",
    name: "Uttam Nagar",
    lat: 28.622,
    lon: 77.056,
    aliases: ["उत्तम नगर"],
  },
  {
    id: "lm:tilak-nagar",
    name: "Tilak Nagar",
    lat: 28.637,
    lon: 77.096,
    aliases: ["तिलक नगर"],
  },
  {
    id: "lm:mayur-vihar",
    name: "Mayur Vihar",
    lat: 28.6066,
    lon: 77.29633,
    aliases: ["मयूर विहार"],
  },
  {
    id: "lm:preet-vihar",
    name: "Preet Vihar",
    lat: 28.641,
    lon: 77.295,
    aliases: ["प्रीत विहार"],
  },
  {
    id: "lm:laxmi-nagar",
    name: "Laxmi Nagar",
    lat: 28.63,
    lon: 77.277,
    aliases: ["लक्ष्मी नगर"],
  },
  {
    id: "lm:shahdara",
    name: "Shahdara",
    lat: 28.67353,
    lon: 77.28727,
    aliases: ["शाहदरा"],
  },
  {
    id: "lm:dilshad-garden",
    name: "Dilshad Garden",
    lat: 28.676,
    lon: 77.321,
    aliases: ["दिलशाद गार्डन"],
  },
  {
    id: "lm:badarpur",
    name: "Badarpur",
    lat: 28.4932,
    lon: 77.30085,
    aliases: ["बदरपुर"],
  },
  {
    id: "lm:tughlakabad",
    name: "Tughlakabad",
    lat: 28.50223,
    lon: 77.29866,
    aliases: ["तुग़लकाबाद"],
  },
  {
    id: "lm:govindpuri",
    name: "Govindpuri",
    lat: 28.544,
    lon: 77.263,
    aliases: ["गोविंदपुरी"],
  },
  {
    id: "lm:chirag-delhi",
    name: "Chirag Delhi",
    lat: 28.54123,
    lon: 77.22938,
    aliases: ["चिराग दिल्ली"],
  },
  {
    id: "lm:mandi-house",
    name: "Mandi House",
    lat: 28.6255,
    lon: 77.2345,
    aliases: ["मंडी हाउस"],
  },
  {
    id: "lm:ito",
    name: "ITO",
    lat: 28.62721,
    lon: 77.24095,
    aliases: ["आईटीओ"],
  },
  {
    id: "lm:daryaganj",
    name: "Daryaganj",
    lat: 28.643,
    lon: 77.241,
    aliases: ["दरियागंज"],
  },
  {
    id: "lm:paharganj",
    name: "Paharganj",
    lat: 28.645,
    lon: 77.212,
    aliases: ["पहाड़गंज"],
  },
  {
    id: "lm:noida-sec18",
    name: "Noida Sector 18",
    lat: 28.571,
    lon: 77.326,
    aliases: ["Atta Market", "नोएडा सेक्टर 18"],
  },
  {
    id: "lm:botanical-garden-noida",
    name: "Botanical Garden Noida",
    lat: 28.564,
    lon: 77.334,
    aliases: ["बॉटनिकल गार्डन"],
  },
  {
    id: "lm:saket-max",
    name: "Siri Fort",
    lat: 28.551,
    lon: 77.22,
    aliases: ["सिरी फोर्ट"],
  },
  {
    id: "lm:panchsheel-park",
    name: "Panchsheel Park",
    lat: 28.54234,
    lon: 77.22051,
    aliases: ["पंचशील पार्क"],
  },
  {
    id: "lm:barakhamba",
    name: "Barakhamba Road",
    lat: 28.63,
    lon: 77.225,
    aliases: ["बाराखंबा रोड"],
  },
  {
    id: "lm:delhi-zoo",
    name: "National Zoological Park",
    lat: 28.6096,
    lon: 77.246,
    aliases: ["Delhi Zoo", "चिड़ियाघर"],
  },
  {
    id: "lm:nehru-park",
    name: "Nehru Park",
    lat: 28.5895,
    lon: 77.189,
    aliases: ["नेहरू पार्क"],
  },
];

// ------------------------------------------------------------- Helpers ----

/** Fare slabs (indicative Delhi metro-style), returns INR estimate. */
export function metroFare(km: number): number {
  if (km <= 2) return 10;
  if (km <= 5) return 20;
  if (km <= 12) return 30;
  if (km <= 21) return 40;
  if (km <= 32) return 50;
  return 60;
}

/** Flat indicative bus fare estimate. */
export const BUS_FARE_INR = 20;

/** Indicative metered auto fare estimate, rounded up to the whole rupee. */
export function autoFare(km: number): number {
  return Math.ceil(
    km <= AUTO_BASE_KM
      ? AUTO_BASE_FARE_INR
      : AUTO_BASE_FARE_INR + (km - AUTO_BASE_KM) * AUTO_PER_KM_INR,
  );
}

export const DEFAULT_MAX_WALK_METERS = 900;
export const LESS_WALK_MAX_METERS = 800;
/** Max meters between two stops to treat as an in-person walking transfer. */
export const INTERCHANGE_WALK_MAX_METERS = 700;
/** Max meters from an arbitrary origin/destination point to the network. */
export const CONNECTOR_MAX_METERS = 1800;

export function allStops(): NetworkStop[] {
  const seen = new Map<string, NetworkStop>();
  for (const line of METRO_LINES) for (const s of line.stations) seen.set(s.id, s);
  for (const route of BUS_ROUTES) for (const s of route.stops) seen.set(s.id, s);
  return [...seen.values()];
}

// ------------------------------------------------- Curated fallback data --

export const CURATED_METRO_LINES: MetroLine[] = [
  {
    id: "metro:yellow",
    name: "Yellow Line",
    shortName: "Yellow",
    color: METRO_BASES["metro:yellow"].light,
    speedKmh: 33,
    stations: [
      { id: "m:y:hauz-khas", name: "Hauz Khas", lat: 28.5434, lon: 77.2068 },
      { id: "m:y:green-park", name: "Green Park", lat: 28.558, lon: 77.2067 },
      { id: "m:y:aiims", name: "AIIMS", lat: 28.5687, lon: 77.2076 },
      { id: "m:y:central-secretariat", name: "Central Secretariat", lat: 28.6148, lon: 77.2115 },
      { id: "m:y:rajiv-chowk", name: "Rajiv Chowk", lat: 28.6328, lon: 77.2197 },
      { id: "m:y:kashmere-gate", name: "Kashmere Gate", lat: 28.667, lon: 77.2282 },
    ],
  },
  {
    id: "metro:magenta",
    name: "Magenta Line",
    shortName: "Magenta",
    color: METRO_BASES["metro:magenta"].light,
    speedKmh: 34,
    stations: [
      { id: "m:g:hauz-khas", name: "Hauz Khas", lat: 28.5434, lon: 77.2068 },
      { id: "m:g:nehru-place", name: "Nehru Place", lat: 28.5505, lon: 77.267 },
    ],
  },
];

export const CURATED_BUS_ROUTES: BusRoute[] = [
  {
    id: "bus:620",
    number: "620",
    name: "Munirka - Connaught Place",
    color: BUS_BASES[0].light,
    speedKmh: 16,
    cycleMinutes: 74,
    vehicles: 4,
    stops: [
      { id: "b:munirka", name: "Munirka", lat: 28.5578, lon: 77.1875 },
      { id: "b:hauz-khas", name: "Hauz Khas", lat: 28.545, lon: 77.203 },
      { id: "b:aiims", name: "AIIMS", lat: 28.5685, lon: 77.209 },
      { id: "b:connaught-place", name: "Regal (Connaught Place)", lat: 28.6315, lon: 77.2167 },
    ],
  },
];
