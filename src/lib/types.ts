export type Mode = "WALK" | "AUTO" | "BUS" | "SUBWAY";

/**
 * Data provenance states. This is the core product differentiator:
 * every realtime-looking datum carries exactly one of these.
 */
export type Provenance = "LIVE" | "SCHEDULED" | "STALE" | "DEMO";

export interface LatLng {
  lat: number;
  lon: number;
}

export interface JourneyLocation extends LatLng {
  name: string;
  /** Distinguishes a user-selected geocoder result from device geolocation. */
  kind?: "place";
}

export interface StopRef {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Leg {
  mode: Mode;
  routeId?: string;
  routeNumber?: string;
  routeName?: string;
  routeColor?: string;
  headsign?: string;
  from: StopRef;
  to: StopRef;
  intermediateStops: StopRef[];
  /** ISO timestamp */
  departAt: string;
  /** ISO timestamp */
  arriveAt: string;
  durationMinutes: number;
  /** Minutes spent waiting to board (included in durationMinutes). */
  waitMinutes?: number;
  /** Exact estimated fare for this leg (INR). */
  fareInr?: number;
  walkingMeters?: number;
  /** [lat, lon] pairs */
  polyline: [number, number][];
  /** How closely the displayed line follows real transport infrastructure. */
  geometrySource?: "ROUTED" | "NETWORK" | "APPROXIMATE";
  provenance: Provenance;
  /** Set when a demo disruption affects this leg. */
  delayMinutes?: number;
}

export type JourneyLabel = "RECOMMENDED" | "FASTEST" | "CHEAPEST" | "ALTERNATIVE";

export interface JourneyQuery {
  fromId?: string;
  toId?: string;
  fromLocation?: JourneyLocation;
  toLocation?: JourneyLocation;
  maxWalkMeters?: number;
}

export interface Journey {
  id: string;
  label: JourneyLabel;
  departAt: string;
  arriveAt: string;
  durationMinutes: number;
  fareInr: number;
  walkingMeters: number;
  transfers: number;
  legs: Leg[];
  provenance: Provenance;
  disrupted: boolean;
  /** Short deterministic reasons this option was surfaced. */
  why?: string[];
  /** Attached when served, so GO mode can refetch after disruption. */
  query?: JourneyQuery;
}

export interface Vehicle {
  id: string;
  routeId: string;
  routeNumber: string;
  headsign: string;
  lat: number;
  lon: number;
  bearing: number;
  nextStopName: string;
  progress: number; // 0..1 within current direction
  direction: 1 | -1;
  updatedAt: string;
  ageSeconds: number;
  provenance: Provenance;
  delayMinutes: number;
}

export interface PlaceResult {
  id: string;
  name: string;
  type: "landmark" | "stop" | "station" | "current" | "address";
  lat: number;
  lon: number;
  detail?: string;
}

export interface ScenarioState {
  active: boolean;
  triggeredAt: number | null;
  routeNumber: string | null;
  delayMinutes: number;
}
