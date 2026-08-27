"use client";

import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Leg, Vehicle } from "@/lib/types";

type MaplibreModule = typeof import("maplibre-gl");

const DELHI_CENTER: [number, number] = [77.216, 28.6]; // lon, lat
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

interface MapViewProps {
  legs?: Leg[];
  vehicles?: Vehicle[];
  highlightVehicleId?: string | null;
  className?: string;
}

function legsToGeojson(legs: Leg[]) {
  return {
    type: "FeatureCollection" as const,
    features: legs
      .map((leg) => ({
        type: "Feature" as const,
        properties: {
          color: leg.mode === "WALK" ? "#64748b" : (leg.routeColor ?? "#2563eb"),
          kind: leg.mode === "WALK" ? "walk" : "transit",
          name:
            leg.mode === "WALK"
              ? "Walk"
              : `${leg.routeNumber ?? ""} ${leg.routeName ?? ""}`.trim(),
        },
        geometry: {
          type: "LineString" as const,
          coordinates: leg.polyline.map(([lat, lon]) => [lon, lat] as [number, number]),
        },
      }))
      .filter((f) => f.geometry.coordinates.length >= 2),
  };
}

function stopsGeojson(legs: Leg[]) {
  const seen = new Set<string>();
  const features: GeoJSON.Feature[] = [];
  for (const leg of legs) {
    for (const s of [leg.from, ...leg.intermediateStops, leg.to]) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      features.push({
        type: "Feature",
        properties: { name: s.name, id: s.id },
        geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      });
    }
  }
  return { type: "FeatureCollection" as const, features };
}

function vehiclesGeojson(vehicles: Vehicle[], highlightId: string | null) {
  return {
    type: "FeatureCollection" as const,
    features: vehicles.map((v) => ({
      type: "Feature" as const,
      properties: {
        id: v.id,
        routeNumber: v.routeNumber,
        headsign: v.headsign,
        nextStopName: v.nextStopName,
        delayMinutes: v.delayMinutes,
        selected: v.id === highlightId ? 1 : 0,
      },
      geometry: { type: "Point" as const, coordinates: [v.lon, v.lat] },
    })),
  };
}

type PopupFactory = MaplibreModule["Popup"];

export default function MapView({
  legs = [],
  vehicles = [],
  highlightVehicleId = null,
  className = "",
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const popupFactoryRef = useRef<PopupFactory | null>(null);
  const styleFallbackRef = useRef(false);
  const animRef = useRef<{
    prev: Map<string, Vehicle>;
    next: Vehicle[];
    t0: number;
  } | null>(null);
  // Bumped on every successful style load. A plain boolean cannot tell
  // "map A is ready" from "map B is ready": under StrictMode React remounts,
  // so map A loads (ready=true), gets removed, and map B's load sets ready to
  // true again - an identical value, so no re-render happens and the effects
  // that push route/stop data never re-run against map B. The route silently
  // never gets drawn. An epoch always changes, so they always re-run.
  const [mapEpoch, setMapEpoch] = useState(0);
  const ready = mapEpoch > 0;
  const [tilesFailed, setTilesFailed] = useState(false);
  const styleLoadedRef = useRef(false);

  // Initialize once.
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      popupFactoryRef.current = maplibregl.Popup;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: DELHI_CENTER,
        zoom: 11.5,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      // If the primary style fails to load, retry once with the positron
      // fallback before showing the offline notice.
      map.on("error", () => {
        if (!styleLoadedRef.current && !styleFallbackRef.current) {
          styleFallbackRef.current = true;
          mapRef.current?.setStyle(
            "https://tiles.openfreemap.org/styles/positron",
          );
        } else if (!tilesFailed) {
          setTilesFailed(true);
        }
      });
      map.on("style.load", () => {
        if (cancelled || !map) return;
        styleLoadedRef.current = true;
      });
      map.on("load", () => {
        if (cancelled || !map) return;
        const empty = { type: "FeatureCollection" as const, features: [] };

        map.addSource("tb-lines", { type: "geojson", data: empty });
        map.addLayer({
          id: "tb-line-walk",
          type: "line",
          source: "tb-lines",
          filter: ["==", ["get", "kind"], "walk"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": 3,
            "line-dasharray": [1.5, 1.5],
          },
        });
        map.addLayer({
          id: "tb-line-transit",
          type: "line",
          source: "tb-lines",
          filter: ["==", ["get", "kind"], "transit"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": 5,
            "line-opacity": 0.9,
          },
        });

        map.addSource("tb-stops", { type: "geojson", data: empty });
        map.addLayer({
          id: "tb-stop-dot",
          type: "circle",
          source: "tb-stops",
          paint: {
            "circle-radius": 5,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#334155",
            "circle-stroke-width": 2,
          },
        });

        map.addSource("tb-vehicles", { type: "geojson", data: empty });
        map.addLayer({
          id: "tb-vehicle-halo",
          type: "circle",
          source: "tb-vehicles",
          filter: ["==", ["get", "selected"], 1],
          paint: { "circle-radius": 14, "circle-color": "#3b82f6", "circle-opacity": 0.25 },
        });
        map.addLayer({
          id: "tb-vehicle-dot",
          type: "circle",
          source: "tb-vehicles",
          paint: {
            "circle-radius": ["case", ["==", ["get", "selected"], 1], 9, 7],
            "circle-color": "#ffffff",
            "circle-stroke-color": "#1d4ed8",
            "circle-stroke-width": 3.5,
          },
        });

        setMapEpoch((e) => e + 1);
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setMapEpoch(0);
    };
  }, []);

  // Click popups.
  useEffect(() => {
    const map = mapRef.current;
    const PopupCtor = popupFactoryRef.current;
    if (!map || !ready) return;

    function htmlFrom(props: Record<string, unknown>): string {
      return `<strong>${String(props.name ?? props.routeNumber)}</strong><br/>
        ${
          props.nextStopName !== undefined
            ? `Next stop: ${String(props.nextStopName)}${
                Number(props.delayMinutes) > 0
                  ? ` · +${String(props.delayMinutes)} min delay`
                  : ""
              } · DEMO`
            : "Stop"
        }`;
    }

    function onClick(e: {
      point: { x: number; y: number };
      lngLat: { lng: number; lat: number };
    }) {
      const layers = ["tb-stop-dot", "tb-vehicle-dot"];
      const hits = map!.queryRenderedFeatures([e.point.x, e.point.y], {
        layers: layers.filter((l) => map!.getLayer(l)),
      }) as unknown as { properties: Record<string, unknown> }[];
      if (!hits.length || !PopupCtor) return;
      const f = hits[0];
      new PopupCtor({ closeButton: false, offset: 10 })
        .setLngLat(e.lngLat)
        .setHTML(htmlFrom(f.properties))
        .addTo(map!);
    }

    function onEnter() {
      if (map) map.getCanvas().style.cursor = "pointer";
    }
    function onLeave() {
      if (map) map.getCanvas().style.cursor = "";
    }

    map.on("click", onClick);
    map.on("mouseenter", "tb-stop-dot", onEnter);
    map.on("mouseleave", "tb-stop-dot", onLeave);
    map.on("mouseenter", "tb-vehicle-dot", onEnter);
    map.on("mouseleave", "tb-vehicle-dot", onLeave);

    return () => {
      // React runs cleanups in declaration order, so the init effect above has
      // already called map.remove() by the time we get here on unmount. A
      // removed map has no .style, and every getLayer/off call throws. remove()
      // drops its own listeners anyway, so there is nothing left to detach.
      if (mapRef.current !== map) return;
      map.off("click", onClick);
      if (map.getLayer("tb-stop-dot")) {
        map.off("mouseenter", "tb-stop-dot", onEnter);
        map.off("mouseleave", "tb-stop-dot", onLeave);
      }
      if (map.getLayer("tb-vehicle-dot")) {
        map.off("mouseenter", "tb-vehicle-dot", onEnter);
        map.off("mouseleave", "tb-vehicle-dot", onLeave);
      }
    };
  }, [mapEpoch]);

  // Route + stop data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("tb-lines") as GeoJSONSource | undefined)?.setData(
      legsToGeojson(legs),
    );
    (map.getSource("tb-stops") as GeoJSONSource | undefined)?.setData(
      stopsGeojson(legs),
    );
  }, [mapEpoch, legs]);

  // Vehicle positions - smoothly interpolated between poll snapshots.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function setData(list: Vehicle[], highlightId: string | null) {
      (map!.getSource("tb-vehicles") as GeoJSONSource | undefined)?.setData(
        vehiclesGeojson(list, highlightId),
      );
    }

    if (reducedMotion || vehicles.length === 0) {
      animRef.current = null;
      setData(vehicles, highlightVehicleId);
      return;
    }

    // Start an interpolation from the previous snapshot to this one.
    const prev = new Map<string, Vehicle>();
    for (const v of animRef.current?.next ?? []) prev.set(v.id, v);
    animRef.current = { prev, next: vehicles, t0: performance.now() };

    let raf = 0;
    const DURATION_MS = 3800; // slightly shorter than the 4 s poll interval
    const tick = () => {
      const state = animRef.current;
      const src = map.getSource("tb-vehicles") as GeoJSONSource | undefined;
      if (!state || !src) return;
      const alpha = Math.min(1, (performance.now() - state.t0) / DURATION_MS);
      const eased = alpha * alpha * (3 - 2 * alpha); // smoothstep
      const interpolated: Vehicle[] = state.next.map((v) => {
        const p = state.prev.get(v.id);
        if (!p) return v;
        return {
          ...v,
          lat: p.lat + (v.lat - p.lat) * eased,
          lon: p.lon + (v.lon - p.lon) * eased,
          bearing:
            Math.abs(v.bearing - p.bearing) < 90
              ? p.bearing + (v.bearing - p.bearing) * eased
              : v.bearing,
        };
      });
      src.setData(vehiclesGeojson(interpolated, highlightVehicleId));
      if (alpha < 1) raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mapEpoch, vehicles, highlightVehicleId]);

  // Fit bounds when route data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || legs.length === 0) return;
    let minLon = 180;
    let minLat = 90;
    let maxLon = -180;
    let maxLat = -90;
    for (const leg of legs) {
      for (const [lat, lon] of leg.polyline) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      {
        padding: 48,
        maxZoom: 13.5,
        duration: reduceMotion ? 0 : 500,
        essential: true,
      },
    );
  }, [mapEpoch, legs]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200 ${className}`}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label="Journey map"
        role="application"
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-sm text-slate-400">
          Loading map…
        </div>
      )}
      {tilesFailed && (
        <div className="absolute inset-x-0 bottom-0 bg-white/95 px-3 py-2 text-xs text-slate-600">
          Map tiles are unavailable right now — journey directions remain fully
          usable.
        </div>
      )}
    </div>
  );
}
