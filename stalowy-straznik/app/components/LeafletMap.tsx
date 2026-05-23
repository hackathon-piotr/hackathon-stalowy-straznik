"use client";

import { useEffect, useRef, useState } from "react";
import type {
  LatLngExpression,
  Map as LeafletMapInstance,
  TileLayer as LeafletTileLayer,
} from "leaflet";

type MapView = "standard" | "satellite" | "geoportal" | "nasa" | "sentinel";

type TileLayerConfig = {
  label: string;
  url: string;
  attribution: string;
  maxNativeZoom?: number;
};

const tileLayers: Record<MapView, TileLayerConfig> = {
  standard: {
    label: "OSM",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    label: "ArcGIS",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  },
  geoportal: {
    label: "Geoportal",
    url: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}",
    attribution:
      '&copy; <a href="https://www.geoportal.gov.pl/">GUGiK Geoportal</a>',
  },
  nasa: {
    label: "NASA",
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-05-20/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    attribution:
      '&copy; <a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs">NASA GIBS</a>',
    maxNativeZoom: 9,
  },
  sentinel: {
    label: "Sentinel",
    url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
    attribution:
      'Sentinel-2 cloudless by <a href="https://s2maps.eu/">EOX</a>, contains modified Copernicus Sentinel data',
    maxNativeZoom: 13,
  },
};

const center: LatLngExpression = [50.5826, 22.0536];

const posts = [
  {
    name: "Stalowa Wola Centrum",
    status: "Aktywny patrol",
    position: [50.5715, 22.0621] as LatLngExpression,
  },
  {
    name: "Huta Stalowa Wola",
    status: "Monitoring",
    position: [50.6009, 22.0568] as LatLngExpression,
  },
  {
    name: "Rozwadow",
    status: "Kontrola trasy",
    position: [50.6168, 22.0475] as LatLngExpression,
  },
];

export default function LeafletMap() {
  const [mapView, setMapView] = useState<MapView>("standard");
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<LeafletMapInstance | null>(null);
  const tileLayerInstance = useRef<LeafletTileLayer | null>(null);
  const mapViewRef = useRef<MapView>("standard");

  useEffect(() => {
    mapViewRef.current = mapView;
  }, [mapView]);

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) {
      return;
    }

    let cancelled = false;

    async function initializeMap() {
      const L = await import("leaflet");

      if (!mapElement.current || cancelled) {
        return;
      }

      const markerIcon = L.divIcon({
        className: "guardian-marker",
        html: "<span></span>",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const map = L.map(mapElement.current, {
        center,
        zoom: 12,
        zoomControl: false,
        scrollWheelZoom: true,
      });

      const selectedTileLayer = tileLayers[mapViewRef.current];
      tileLayerInstance.current = L.tileLayer(selectedTileLayer.url, {
        attribution: selectedTileLayer.attribution,
        maxNativeZoom: selectedTileLayer.maxNativeZoom,
        maxZoom: 19,
      }).addTo(map);

      L.circle(center, {
        radius: 4200,
        color: "#ef4444",
        fillColor: "#ef4444",
        fillOpacity: 0.08,
        opacity: 0.55,
        weight: 2,
      }).addTo(map);

      posts.forEach((post) => {
        L.marker(post.position, { icon: markerIcon })
          .addTo(map)
          .bindPopup(`<strong>${post.name}</strong><br />${post.status}`);
      });

      mapInstance.current = map;
    }

    initializeMap();

    return () => {
      cancelled = true;
      tileLayerInstance.current = null;
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    async function updateTileLayer() {
      const map = mapInstance.current;

      if (!map) {
        return;
      }

      const L = await import("leaflet");
      const selectedTileLayer = tileLayers[mapView];

      tileLayerInstance.current?.remove();
      tileLayerInstance.current = L.tileLayer(selectedTileLayer.url, {
        attribution: selectedTileLayer.attribution,
        maxNativeZoom: selectedTileLayer.maxNativeZoom,
        maxZoom: 19,
      }).addTo(map);
    }

    updateTileLayer();
  }, [mapView]);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-stone-950">
      <div ref={mapElement} className="h-screen w-full" aria-label="Mapa" />

      <section className="pointer-events-none absolute left-4 top-4 z-[500] w-[min(360px,calc(100vw-2rem))] rounded-lg border border-white/20 bg-zinc-950/88 p-4 text-white shadow-xl backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
          Stalowy Straznik
        </div>
        <h1 className="mt-2 text-2xl font-semibold">Mapa operacyjna</h1>
        <div className="pointer-events-auto mt-4 grid grid-cols-2 gap-1 rounded-md bg-white/10 p-1 text-sm font-medium sm:grid-cols-3">
          {(Object.keys(tileLayers) as MapView[]).map((view) => (
            <button
              key={view}
              type="button"
              className={`rounded px-3 py-2 transition ${
                mapView === view
                  ? "bg-white text-zinc-950 shadow"
                  : "text-zinc-200 hover:bg-white/10"
              }`}
              aria-pressed={mapView === view}
              onClick={() => setMapView(view)}
            >
              {tileLayers[view].label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-md bg-white/10 p-3">
            <div className="text-xl font-semibold">3</div>
            <div className="text-zinc-300">posterunki</div>
          </div>
          <div className="rounded-md bg-white/10 p-3">
            <div className="text-xl font-semibold">4.2 km</div>
            <div className="text-zinc-300">strefa</div>
          </div>
          <div className="rounded-md bg-white/10 p-3">
            <div className="text-xl font-semibold">12</div>
            <div className="text-zinc-300">zoom</div>
          </div>
        </div>
      </section>
    </main>
  );
}
