"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Layer,
  LatLngExpression,
  Map as LeafletMapInstance,
  TileLayer as LeafletTileLayer,
} from "leaflet";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  Position,
} from "geojson";

type MapView = "standard" | "satellite" | "geoportal" | "nasa" | "sentinel";
type InfrastructureLayer =
  | "water"
  | "power"
  | "sewer"
  | "bts"
  | "fiber"
  | "rail"
  | "bridges"
  | "hospitals"
  | "warehouses"
  | "fuel"
  | "shelters"
  | "logistics"
  | "strategic"
  | "dependencyGraph";

type TileLayerConfig = {
  label: string;
  url: string;
  attribution: string;
  maxNativeZoom?: number;
};

type DependencyGraphNode = {
  id: string;
  type: string;
  subtype: string;
  name: string;
  source?: string;
  position?: [number, number];
};

type DependencyGraphEdge = {
  id: string;
  type: string;
  source: string;
  target: string;
  confidence: string;
};

type DependencyGraph = {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
};

type RiskScore = {
  value: number;
  level: "niski" | "średni" | "wysoki" | "krytyczny";
  reasons: string[];
  vulnerabilities?: Record<string, number>; // oceny podatności na środki rażenia
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
const utilityWmsUrl = "https://stalowawola.geoportal2.pl/map/geoportal/wms.php?typ=g&";
const graphEdgeStyles: Record<
  string,
  {
    color: string;
    dashArray?: string;
  }
> = {
  zasilany_przez: {
    color: "#facc15",
  },
  obsługuje: {
    color: "#38bdf8",
  },
  zależny_od: {
    color: "#ef4444",
    dashArray: "7 5",
  },
  redundantny_z: {
    color: "#22c55e",
    dashArray: "2 7",
  },
  połączony_z: {
    color: "#fb923c",
  },
  backup: {
    color: "#14b8a6",
    dashArray: "10 6",
  },
  zdarzenie_dotyczy: {
    color: "#f43f5e",
    dashArray: "4 8",
  },
};

const infrastructureLayers: Record<
  InfrastructureLayer,
  {
    label: string;
    color: string;
    source: "GESUT WMS" | "OpenStreetMap" | "Model";
    wmsLayer?: string;
    geojsonLayer?: string;
  }
> = {
  water: {
    label: "wodociągi",
    color: "#38bdf8",
    source: "GESUT WMS",
    wmsLayer: "siec_wodociagowa",
  },
  power: {
    label: "energetyka",
    color: "#facc15",
    source: "GESUT WMS",
    wmsLayer: "siec_elektroenergetyczna",
  },
  sewer: {
    label: "kanalizacja",
    color: "#06b6d4",
    source: "GESUT WMS",
    wmsLayer: "siec_kanalizacyjna",
  },
  bts: {
    label: "BTS",
    color: "#a78bfa",
    source: "OpenStreetMap",
    geojsonLayer: "bts",
  },
  fiber: {
    label: "światłowody",
    color: "#c084fc",
    source: "GESUT WMS",
    wmsLayer: "siec_telekomunikacyjna",
  },
  rail: {
    label: "kolej",
    color: "#fb923c",
    source: "OpenStreetMap",
    geojsonLayer: "rail",
  },
  bridges: {
    label: "mosty",
    color: "#f97316",
    source: "OpenStreetMap",
    geojsonLayer: "bridges",
  },
  hospitals: {
    label: "szpitale",
    color: "#22c55e",
    source: "OpenStreetMap",
    geojsonLayer: "hospitals",
  },
  warehouses: {
    label: "magazyny",
    color: "#94a3b8",
    source: "OpenStreetMap",
    geojsonLayer: "warehouses",
  },
  fuel: {
    label: "stacje paliw",
    color: "#ef4444",
    source: "OpenStreetMap",
    geojsonLayer: "fuel",
  },
  shelters: {
    label: "schrony",
    color: "#14b8a6",
    source: "OpenStreetMap",
    geojsonLayer: "shelters",
  },
  logistics: {
    label: "centra logistyczne",
    color: "#e879f9",
    source: "OpenStreetMap",
    geojsonLayer: "logistics",
  },
  strategic: {
    label: "obiekty strategiczne",
    color: "#f43f5e",
    source: "OpenStreetMap",
    geojsonLayer: "strategic",
  },
  dependencyGraph: {
    label: "graf zależności",
    color: "#ffffff",
    source: "Model",
  },
};

const infrastructureLayerKeys = Object.keys(
  infrastructureLayers,
) as InfrastructureLayer[];

const initialInfrastructureLayers: Record<InfrastructureLayer, boolean> = {
  water: true,
  power: true,
  sewer: true,
  bts: true,
  fiber: true,
  rail: true,
  bridges: true,
  hospitals: true,
  warehouses: true,
  fuel: true,
  shelters: true,
  logistics: true,
  strategic: true,
  dependencyGraph: true,
};

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

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getRiskLevel(score: number): RiskScore["level"] {
  if (score >= 80) return "krytyczny";
  if (score >= 60) return "wysoki";
  if (score >= 35) return "średni";

  return "niski";
}

function getFeaturePosition(feature: Feature<Geometry, GeoJsonProperties>) {
  const geometry = feature.geometry;

  if (!geometry) {
    return null;
  }

  if (geometry.type === "Point") {
    return [geometry.coordinates[1], geometry.coordinates[0]] as [number, number];
  }

  let coordinates: Position[] = [];

  if (geometry.type === "LineString") {
    coordinates = geometry.coordinates;
  }

  if (geometry.type === "Polygon") {
    coordinates = geometry.coordinates[0] ?? [];
  }

  if (geometry.type === "MultiLineString") {
    coordinates = geometry.coordinates.flat();
  }

  if (!coordinates.length) {
    return null;
  }

  const midpoint = coordinates[Math.floor(coordinates.length / 2)];

  return [midpoint[1], midpoint[0]] as [number, number];
}

function getDistanceKm(first: [number, number], second: [number, number]) {
  const earthRadiusKm = 6371;
  const degreesToRadians = Math.PI / 180;
  const deltaLat = (second[0] - first[0]) * degreesToRadians;
  const deltaLng = (second[1] - first[1]) * degreesToRadians;
  const lat1 = first[0] * degreesToRadians;
  const lat2 = second[0] * degreesToRadians;
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getCriticalClusterCount(
  position: [number, number] | null,
  features: Feature<Geometry, GeoJsonProperties>[],
) {
  if (!position) {
    return 0;
  }

  return features.filter((feature) => {
    const layer = feature.properties?.layer;

    if (
      ![
        "strategic",
        "hospitals",
        "power",
        "bts",
        "bridges",
        "rail",
        "fuel",
        "warehouses",
      ].includes(String(layer))
    ) {
      return false;
    }

    const featurePosition = getFeaturePosition(feature);

    return featurePosition ? getDistanceKm(position, featurePosition) <= 1.2 : false;
  }).length;
}

function findGraphNodeForFeature(
  feature: Feature<Geometry, GeoJsonProperties>,
  graph: DependencyGraph | null,
) {
  if (!graph) {
    return undefined;
  }

  const featureId = String(feature.id ?? feature.properties?.id ?? "");
  const featureName = String(feature.properties?.name ?? "").toLowerCase();

  return graph.nodes.find((node) => {
    const source = node.source?.toLowerCase() ?? "";
    const nodeName = node.name.toLowerCase();

    return source.includes(featureId.toLowerCase()) || nodeName === featureName;
  });
}

function calculateNodeRisk(
  node: DependencyGraphNode,
  graph: DependencyGraph,
  features: Feature<Geometry, GeoJsonProperties>[],
): RiskScore {
  const edges = graph.edges.filter(
    (edge) => edge.source === node.id || edge.target === node.id,
  );
  const dependencyCount = edges.filter((edge) =>
    ["zależny_od", "zasilany_przez"].includes(edge.type),
  ).length;
  const servesCount = edges.filter((edge) => edge.type === "obsługuje").length;
  const hasRedundancy = edges.some((edge) => edge.type === "redundantny_z");
  const hasBackup = edges.some((edge) => edge.type === "backup");
  const clusterCount = getCriticalClusterCount(node.position ?? null, features);
  const reasons: string[] = [];
  let score = 20;

  if (["gpz", "energetyka", "wodociagi", "szpital", "przemysl_obronny"].includes(node.subtype)) {
    score += 18;
    reasons.push("funkcja krytyczna");
  }

  if (dependencyCount > 0) {
    score += dependencyCount * 10;
    reasons.push(`${dependencyCount} zależności z grafu`);
  }

  if (servesCount > 0) {
    score += servesCount * 8;
    reasons.push("obsługuje zasób lub usługę");
  }

  if (!hasRedundancy && node.type === "infrastruktura") {
    score += 12;
    reasons.push("brak relacji redundancji w modelu");
  }

  if (!hasBackup && ["szpital", "wodociagi", "energetyka"].includes(node.subtype)) {
    score += 10;
    reasons.push("brak jawnego backupu w modelu");
  }

  if (clusterCount >= 5) {
    score += 14;
    reasons.push("duże skupisko ważnych obiektów w promieniu 1.2 km");
  } else if (clusterCount >= 3) {
    score += 8;
    reasons.push("skupisko ważnych obiektów w promieniu 1.2 km");
  }

  const value = clamp(Math.round(score), 0, 100);

  return {
    value,
    level: getRiskLevel(value),
    reasons,
  };
}

function calculateFeatureRisk(
  feature: Feature<Geometry, GeoJsonProperties>,
  features: Feature<Geometry, GeoJsonProperties>[],
  graph: DependencyGraph | null,
): RiskScore {
  const layer = String(feature.properties?.layer ?? "");
  const tags = (feature.properties?.tags ?? {}) as Record<string, string>;
  const graphNode = findGraphNodeForFeature(feature, graph);

  if (graphNode && graph) {
    return calculateNodeRisk(graphNode, graph, features);
  }

  const position = getFeaturePosition(feature);
  const clusterCount = getCriticalClusterCount(position, features);
  const reasons: string[] = [];
  let score = 20;

  const layerWeights: Record<string, number> = {
    strategic: 22,
    hospitals: 20,
    power: 18,
    bridges: 14,
    rail: 12,
    bts: 12,
    fuel: 10,
    warehouses: 8,
    shelters: 6,
  };

  if (layerWeights[layer]) {
    score += layerWeights[layer];
    reasons.push(`warstwa: ${layer}`);
  }

  if (tags.power === "plant" || tags.power === "substation") {
    score += 14;
    reasons.push("obiekt energetyczny");
  }

  if (tags.amenity === "hospital" || tags.healthcare === "hospital") {
    score += 14;
    reasons.push("ciągłość działania usług medycznych");
  }

  if (tags.military || tags.landuse === "military") {
    score += 10;
    reasons.push("jawnie oznaczona funkcja obronna");
  }

  if (clusterCount >= 5) {
    score += 14;
    reasons.push("duże skupisko ważnych obiektów w promieniu 1.2 km");
  } else if (clusterCount >= 3) {
    score += 8;
    reasons.push("skupisko ważnych obiektów w promieniu 1.2 km");
  }

  if (["strategic", "hospitals", "power"].includes(layer)) {
    score += 10;
    reasons.push("brak potwierdzonej redundancji w danych publicznych");
  }

  const value = clamp(Math.round(score), 0, 100);

  return {
    value,
    level: getRiskLevel(value),
    reasons,
  };
}

function getRiskPopupHtml(risk: RiskScore) {
  const reasonList = risk.reasons.length
    ? risk.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")
    : "<li>brak dodatkowych czynników w modelu</li>";

  const vulnList = risk.vulnerabilities
    ? Object.entries(risk.vulnerabilities)
        .map(([k, v]) => `<li>${escapeHtml(k)}: ${v}%</li>`)
        .join("")
    : "<li>brak oceny podatności</li>";

  return `<div class="risk-score"><div><strong>Risk score: ${risk.value}/100</strong> (${escapeHtml(risk.level)})</div><div class="risk-bar"><span style="width:${risk.value}%"></span></div><ul>${reasonList}</ul><div class="vulnerabilities"><strong>Ocena podatności:</strong><ul>${vulnList}</ul></div><small>Wskaźnik odporności: zależności, redundancja, backup, skupienie obiektów.</small></div>`;
}

function getRiskBadgeClass(risk: RiskScore) {
  return `risk-badge risk-badge-${risk.level.replace("ś", "s")}`;
}

function getRiskBadgeHtml(risk: RiskScore) {
  return `<span class="${getRiskBadgeClass(risk)}">${risk.value}</span>`;
}

export default function LeafletMap() {
  const [mapView, setMapView] = useState<MapView>("standard");
  const [activeInfrastructureLayers, setActiveInfrastructureLayers] = useState(
    initialInfrastructureLayers,
  );
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<LeafletMapInstance | null>(null);
  const tileLayerInstance = useRef<LeafletTileLayer | null>(null);
  const infrastructureLayerInstances = useRef<
    Partial<Record<InfrastructureLayer, Layer>>
  >({});
  const mapViewRef = useRef<MapView>("standard");
  const activeInfrastructureLayersRef = useRef(activeInfrastructureLayers);

  // Refs to keep latest geojson/graph for simulation outside initializeMap scope
  const geojsonRef = useRef<FeatureCollection<Geometry, GeoJsonProperties> | null>(null);
  const graphRef = useRef<DependencyGraph | null>(null);

  // Simulation state and layer
  const simulationLayerRef = useRef<Layer | null>(null);
  const simulationTimersRef = useRef<number[]>([]);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [selectedAttackType, setSelectedAttackType] = useState<string>("power");
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [showLayersPanel, setShowLayersPanel] = useState<boolean>(false);
  const [showSimPanel, setShowSimPanel] = useState<boolean>(false);
  const [warAlert, setWarAlert] = useState<{title:string; actions:string[]; targets:{name:string;prob:number;effect:string}[]} | null>(null);

  // Alarm audio refs
  const alarmCtxRef = useRef<AudioContext | null>(null);
  const alarmOscRef = useRef<OscillatorNode | null>(null);
  const alarmGainRef = useRef<GainNode | null>(null);

  function startAlarm() {
    try {
      if (!('AudioContext' in window) && !('webkitAudioContext' in window)) return;
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!alarmCtxRef.current) alarmCtxRef.current = new AudioCtx();
      const ctx = alarmCtxRef.current;
      stopAlarm();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 420;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      // ramp gain to audible
      gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.05);
      alarmOscRef.current = osc;
      alarmGainRef.current = gain;
    } catch (e) {
      // ignore if audio not available
    }
  }

  function stopAlarm() {
    try {
      if (alarmGainRef.current) {
        const g = alarmGainRef.current;
        const ctx = alarmCtxRef.current!;
        g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      }
      if (alarmOscRef.current) {
        try { alarmOscRef.current.stop(); } catch (e) {}
        alarmOscRef.current.disconnect?.();
        alarmOscRef.current = null;
      }
      if (alarmGainRef.current) { alarmGainRef.current.disconnect?.(); alarmGainRef.current = null; }
      // keep context for reuse
    } catch (e) {}
  }

  // war action tracking
  const [warActionsTaken, setWarActionsTaken] = useState<string[]>([]);

  function takeWarAction(key: string) {
    if (!warAlert) return;
    const mapping: Record<string, string> = {
      fire: 'Straż pożarna: zaangażowano zasoby',
      military: 'Mobilizacja wojskowa: ogłoszona',
      evac: 'Ewakuacja cywili: rozpoczęta',
    };
    const msg = mapping[key] ?? key;
    setWarActionsTaken((prev) => (prev.includes(msg) ? prev : [...prev, msg]));
  }

  useEffect(() => {
    mapViewRef.current = mapView;
  }, [mapView]);

  useEffect(() => {
    activeInfrastructureLayersRef.current = activeInfrastructureLayers;
  }, [activeInfrastructureLayers]);

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

      infrastructureLayerKeys.forEach((layer) => {
        const config = infrastructureLayers[layer];

        if (!config.wmsLayer) {
          infrastructureLayerInstances.current[layer] = L.layerGroup();
          return;
        }

        infrastructureLayerInstances.current[layer] = L.tileLayer.wms(utilityWmsUrl, {
          layers: config.wmsLayer,
          format: "image/png",
          transparent: true,
          opacity: 0.78,
          version: "1.3.0",
          attribution: "GESUT: Powiat Stalowowolski / Geoportal2",
        });
      });

      infrastructureLayerKeys.forEach((layer) => {
        if (activeInfrastructureLayersRef.current[layer]) {
          infrastructureLayerInstances.current[layer]?.addTo(map);
        }
      });

      mapInstance.current = map;

      const response = await fetch("/data/stalowa-wola-infrastructure.geojson");

      if (!response.ok || cancelled) {
        return;
      }

      const geojson = (await response.json()) as FeatureCollection<
        Geometry,
        GeoJsonProperties
      >;
      const graphResponse = await fetch("/data/stalowa-wola-dependency-graph.json");
      const graph =
        graphResponse.ok && !cancelled
          ? ((await graphResponse.json()) as DependencyGraph)
          : null;

      // expose for simulation controls
      geojsonRef.current = geojson;
      graphRef.current = graph;

      infrastructureLayerKeys.forEach((layer) => {
        const config = infrastructureLayers[layer];

        if (!config.geojsonLayer) {
          return;
        }

        const geoJsonLayer = L.geoJSON(geojson, {
          filter: (feature?: Feature<Geometry, GeoJsonProperties>) =>
            feature?.properties?.layer === config.geojsonLayer,
          pointToLayer: (_feature, latlng) =>
            L.circleMarker(latlng, {
              color: "#ffffff",
              fillColor: config.color,
              fillOpacity: 0.92,
              radius:
                layer === "bts" || layer === "hospitals" || layer === "strategic"
                  ? 7
                  : 5,
              weight: 1.5,
            }),
          style: () => ({
            color: config.color,
            fillColor: config.color,
            fillOpacity: 0.22,
            opacity: 0.88,
            weight: layer === "bridges" || layer === "strategic" ? 5 : 3,
            dashArray: layer === "rail" ? "7 5" : undefined,
          }),
          onEachFeature: (feature, leafletLayer) => {
            const properties = feature.properties ?? {};
            const name = properties.name ?? config.label;
            const showRiskScore = [
              "strategic",
              "hospitals",
              "power",
              "bts",
              "bridges",
              "rail",
            ].includes(String(properties.layer));
            const riskHtml = showRiskScore
              ? getRiskPopupHtml(calculateFeatureRisk(feature, geojson.features, graph))
              : "";

            leafletLayer.bindPopup(
              `<strong>${escapeHtml(config.label)}</strong><br />${escapeHtml(name)}<br /><small>${escapeHtml(config.source)}</small>${riskHtml}`,
            );
          },
        });

        const riskBadgeLayer = L.layerGroup();

        geojson.features
          .filter((feature) => feature.properties?.layer === config.geojsonLayer)
          .forEach((feature) => {
            const position = getFeaturePosition(feature);
            const showRiskScore = [
              "strategic",
              "hospitals",
              "power",
              "bts",
              "bridges",
              "rail",
            ].includes(String(feature.properties?.layer));

            if (!position || !showRiskScore) {
              return;
            }

            const risk = calculateFeatureRisk(feature, geojson.features, graph);

            L.marker(position, {
              icon: L.divIcon({
                className: "risk-badge-icon",
                html: getRiskBadgeHtml(risk),
                iconSize: [34, 22],
                iconAnchor: [17, 11],
              }),
              interactive: false,
              keyboard: false,
            }).addTo(riskBadgeLayer);
          });

        const combinedLayer = L.layerGroup([geoJsonLayer, riskBadgeLayer]);

        infrastructureLayerInstances.current[layer]?.remove();
        infrastructureLayerInstances.current[layer] = combinedLayer;

        if (activeInfrastructureLayersRef.current[layer]) {
          combinedLayer.addTo(map);
        }
      });

      if (!graph || cancelled) {
        return;
      }

      const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
      const relationLayer = L.layerGroup();

      graph.edges.forEach((edge) => {
        const sourceNode = nodeById.get(edge.source);
        const targetNode = nodeById.get(edge.target);

        if (!sourceNode?.position || !targetNode?.position) {
          return;
        }

        const style = graphEdgeStyles[edge.type] ?? { color: "#ffffff" };

        L.polyline([sourceNode.position, targetNode.position], {
          color: style.color,
          dashArray: style.dashArray,
          opacity: 0.88,
          weight: 3,
        })
          .bindPopup(
            `<strong>${escapeHtml(edge.type)}</strong><br />${escapeHtml(sourceNode.name)} → ${escapeHtml(targetNode.name)}<br /><small>pewność: ${escapeHtml(edge.confidence)}</small>`,
          )
          .addTo(relationLayer);
      });

      graph.nodes
        .filter((node) => node.position)
        .forEach((node) => {
          const risk = calculateNodeRisk(node, graph, geojson.features);
          const outgoing = graph.edges.filter((edge) => edge.source === node.id);
          const incoming = graph.edges.filter((edge) => edge.target === node.id);
          const relations = [...outgoing, ...incoming]
            .slice(0, 8)
            .map((edge) => {
              const oppositeId = edge.source === node.id ? edge.target : edge.source;
              const oppositeNode = nodeById.get(oppositeId);
              const direction = edge.source === node.id ? "→" : "←";

              return `${escapeHtml(edge.type)} ${direction} ${escapeHtml(oppositeNode?.name ?? oppositeId)}`;
            })
            .join("<br />");

          L.circleMarker(node.position as LatLngExpression, {
            color: "#18181b",
            fillColor: infrastructureLayers.dependencyGraph.color,
            fillOpacity: 0.95,
            radius: node.type === "zdarzenie" ? 9 : 7,
            weight: 2,
          })
            .bindPopup(
              `<strong>${escapeHtml(node.name)}</strong><br /><small>${escapeHtml(node.type)} / ${escapeHtml(node.subtype)}</small>${getRiskPopupHtml(risk)}${relations ? `<hr />${relations}` : ""}`,
            )
            .addTo(relationLayer);

          L.marker(node.position as LatLngExpression, {
            icon: L.divIcon({
              className: "risk-badge-icon",
              html: getRiskBadgeHtml(risk),
              iconSize: [34, 22],
              iconAnchor: [17, -4],
            }),
            interactive: false,
            keyboard: false,
          }).addTo(relationLayer);
        });

      infrastructureLayerInstances.current.dependencyGraph?.remove();
      infrastructureLayerInstances.current.dependencyGraph = relationLayer;

      if (activeInfrastructureLayersRef.current.dependencyGraph) {
        relationLayer.addTo(map);
      }
    }

    initializeMap();

    return () => {
      cancelled = true;
      tileLayerInstance.current = null;
      infrastructureLayerInstances.current = {};
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

  useEffect(() => {
    const map = mapInstance.current;

    if (!map) {
      return;
    }

    infrastructureLayerKeys.forEach((layer) => {
      const layerGroup = infrastructureLayerInstances.current[layer];

      if (!layerGroup) {
        return;
      }

      if (activeInfrastructureLayers[layer]) {
        layerGroup.addTo(map);
        return;
      }

      layerGroup.remove();
    });
  }, [activeInfrastructureLayers]);

  async function runSimulation(attackType: string = selectedAttackType) {
    const map = mapInstance.current;
    const geojson = geojsonRef.current;
    const graph = graphRef.current;

    if (!map || !geojson) return;
    if (simulationRunning) return;

    setSimulationRunning(true);

    const features = geojson.features;
    // choose initial targets based on attack type
    const targets = features.filter((feature) => {
      const tags = (feature.properties?.tags ?? {}) as Record<string, string>;
      if (attackType === "power") {
        return (
          String(feature.properties?.layer) === "power" ||
          tags.power === "plant" ||
          tags.power === "substation"
        );
      }

      if (attackType === "strategic") {
        return String(feature.properties?.layer) === "strategic";
      }

      if (attackType === "hospitals") {
        return String(feature.properties?.layer) === "hospitals";
      }

      // fallback: match layer name
      return String(feature.properties?.layer) === attackType;
    });

    const affectedSet = new Set<Feature<Geometry, GeoJsonProperties>>();
    targets.forEach((t) => affectedSet.add(t));

    // propagate via dependency graph (breadth-first up to depth 2)
    if (graph) {
      const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
      const startNodeIds = graph.nodes
        .filter((node) =>
          targets.some((f) => {
            const fid = String(f.id ?? f.properties?.id ?? "");
            const fname = String(f.properties?.name ?? "").toLowerCase();
            return (
              node.source?.toLowerCase().includes(fid.toLowerCase()) ||
              node.name.toLowerCase() === fname
            );
          }),
        )
        .map((n) => n.id);

      const queue: Array<{ id: string; depth: number }> = startNodeIds.map((id) => ({ id, depth: 0 }));
      const visited = new Set(startNodeIds);

      while (queue.length) {
        const { id, depth } = queue.shift()!;
        const node = nodeById.get(id);
        if (!node) continue;

        // match node back to features
        features.forEach((f) => {
          const fid = String(f.id ?? f.properties?.id ?? "");
          const fname = String(f.properties?.name ?? "").toLowerCase();
          if (node.source?.toLowerCase().includes(fid.toLowerCase()) || node.name.toLowerCase() === fname) {
            affectedSet.add(f);
          }
        });

        if (depth < 2) {
          graph.edges.forEach((edge) => {
            const neighbor = edge.source === id ? edge.target : edge.source === id ? edge.source : null;
            if (!neighbor) {
              // check both directions
              if (edge.source === id && !visited.has(edge.target)) {
                visited.add(edge.target);
                queue.push({ id: edge.target, depth: depth + 1 });
              }
              if (edge.target === id && !visited.has(edge.source)) {
                visited.add(edge.source);
                queue.push({ id: edge.source, depth: depth + 1 });
              }
            } else if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push({ id: neighbor, depth: depth + 1 });
            }
          });
        }
      }
    }

    const affected = Array.from(affectedSet.values());

    const L = await import("leaflet");

    // create simulation layer
    if (simulationLayerRef.current) {
      try {
        simulationLayerRef.current.remove();
      } catch (e) {
        // ignore
      }
    }

    const simLayer = L.layerGroup();
    simulationLayerRef.current = simLayer;
    simLayer.addTo(map);

    // helper to compute start point off-map
    function getStartPoint(targetLatLng: [number, number]) {
      const center = map.getCenter();
      const bounds = map.getBounds();
      const latSpan = bounds.getNorth() - bounds.getSouth();
      const lngSpan = bounds.getEast() - bounds.getWest();
      const dx = targetLatLng[1] - center.lng;
      const dy = targetLatLng[0] - center.lat;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const factor = Math.max(latSpan, lngSpan) * 1.6;
      const startLat = targetLatLng[0] + (dy / len) * factor;
      const startLng = targetLatLng[1] + (dx / len) * factor;
      return [startLat, startLng] as [number, number];
    }

    // animate projectile from start to target
    function launchProjectile(start: [number, number], target: [number, number], type: "rakieta" | "dron", severity: number) {
      const projectileIcon = L.divIcon({ html: type === "rakieta" ? "🚀" : "🛸", className: "projectile-icon" });
      const marker = L.marker(start as LatLngExpression, { icon: projectileIcon, interactive: false }).addTo(simLayer);
      const trail = L.polyline([start], { color: "#ffb86b", weight: 2, opacity: 0.9 }).addTo(simLayer);

      const distance = L.latLng(start).distanceTo(L.latLng(target)); // meters
      const speed = type === "rakieta" ? 600 : 60; // m/s
      const durationMs = Math.max(500, (distance / speed) * 1000);
      const steps = Math.max(20, Math.ceil(durationMs / 40));
      let step = 0;

      const intervalId = window.setInterval(() => {
        step += 1;
        const t = step / steps;
        const curLat = start[0] + (target[0] - start[0]) * t;
        const curLng = start[1] + (target[1] - start[1]) * t;
        const cur = [curLat, curLng] as [number, number];
        marker.setLatLng(cur as LatLngExpression);
        trail.addLatLng(cur as LatLngExpression);

        if (step >= steps) {
          window.clearInterval(intervalId);
          try {
            simLayer.removeLayer(marker);
          } catch (e) {}

          // explosion
          const exp = L.circle(target as LatLngExpression, {
            radius: 8 + severity * 30,
            color: "#ff5f5f",
            fillColor: "#ff9b9b",
            fillOpacity: 0.9,
            weight: 2,
          }).addTo(simLayer);

          let r = 8 + severity * 30;
          const expInterval = window.setInterval(() => {
            r += 6;
            try {
              (exp as any).setRadius(r);
              exp.setStyle({ fillOpacity: Math.max(0, 0.9 - r / 120) });
            } catch (e) {}

            if (r > 80 + severity * 40) {
              window.clearInterval(expInterval);
              try {
                simLayer.removeLayer(exp);
              } catch (e) {}
            }
          }, 60);

          // mark damaged object briefly
          const damaged = L.circleMarker(target as LatLngExpression, {
            radius: 6 + severity * 8,
            color: "#a11",
            fillColor: "#a11",
            fillOpacity: 0.95,
            weight: 2,
          }).addTo(simLayer);

          const toId = window.setTimeout(() => {
            try {
              simLayer.removeLayer(damaged);
            } catch (e) {}
          }, 4500);

          simulationTimersRef.current.push(expInterval as unknown as number, toId as unknown as number);
        }
      }, Math.max(20, Math.round(durationMs / steps)));

      simulationTimersRef.current.push(intervalId as unknown as number);
    }

    // launch projectiles with small stagger
    affected.forEach((feature, i) => {
      const pos = getFeaturePosition(feature);
      if (!pos) return;
      const risk = calculateFeatureRisk(feature, features, graph);
      const severity = (risk?.value ?? 0) / 100;
    const delay = i * 350 / (simulationSpeed || 1);

    let type: "rakieta" | "dron" = attackType === "strategic" || attackType === "war" ? "rakieta" : "dron";

      const timeoutId = window.setTimeout(() => {
        const start = getStartPoint(pos);
        launchProjectile(start, pos, type as "rakieta" | "dron", severity);
      }, delay);

      simulationTimersRef.current.push(timeoutId as unknown as number);
    });

    // if war, also animate troop convoys and show large alert popup
    if (attackType === "war") {
    // helper: find nearest road feature (LineString) and return its first coord as start
    function getNearestRoadStart(targetPos:[number,number]) {
      let best: Feature<Geometry, GeoJsonProperties> | null = null;
      let bestDist = Infinity;
      features.forEach((f) => {
        if (f.geometry?.type === "LineString") {
          const tags = (f.properties?.tags ?? {}) as Record<string,string>;
          if (tags.highway || tags.road || String(f.properties?.layer).includes("rail")) {
            // compute distance to first coordinate
            const coords = (f.geometry as any).coordinates as [number,number][];
            const c = coords[0];
            const d = getDistanceKm(targetPos, [c[1], c[0]]);
            if (d < bestDist) { bestDist = d; best = f; }
          }
        }
      });
      if (!best) return getStartPoint(targetPos);
      const coords = (best.geometry as any).coordinates as [number,number][];
      const c = coords[0];
      return [c[1], c[0]] as [number,number];
    }

    // animate convoy along a simple path (start -> via -> target)
    async function animateConvoy(start:[number,number], via:[number,number] | null, target:[number,number]) {
      const L = await import("leaflet");
      const simLayer = simulationLayerRef.current as any;
      const path = [start, via ?? target, target];
      const marker = L.marker(start as LatLngExpression, { interactive: false, icon: L.divIcon({ html: '🚚', className: 'convoy-icon' }) }).addTo(simLayer);
      const trail = L.polyline([start], { color: "#ffd86b", weight: 3, opacity: 0.9 }).addTo(simLayer);

      const totalSteps = 200;
      let step = 0;
      const intervalId = window.setInterval(() => {
        step += 1;
        const t = step / totalSteps;
        // simple linear interpolation along path
        const seg = Math.min(1, t);
        const curLat = start[0] + (target[0] - start[0]) * seg;
        const curLng = start[1] + (target[1] - start[1]) * seg;
        const cur:[number,number] = [curLat, curLng];
        marker.setLatLng(cur as LatLngExpression);
        trail.addLatLng(cur as LatLngExpression);
        if (step >= totalSteps) {
          window.clearInterval(intervalId);
          try { simLayer.removeLayer(marker); } catch(e){}
        }
      }, 40 / (simulationSpeed || 1));
      simulationTimersRef.current.push(intervalId as unknown as number);
    }

    // pick top 3 affected targets by risk
    const sorted = affected
      .map((f) => ({ f, r: calculateFeatureRisk(f, features, graph) }))
      .sort((a,b)=> (b.r.value - a.r.value))
      .slice(0,3);

    sorted.forEach((s, idx) => {
      const pos = getFeaturePosition(s.f);
      if (!pos) return;
      const start = getNearestRoadStart(pos);
      const via = null; // could compute via road network
      const t = window.setTimeout(() => animateConvoy(start, via, pos), 800 + idx * 1200 / (simulationSpeed || 1));
      simulationTimersRef.current.push(t as unknown as number);
    });

    // prepare war alert popup content
    let targetsInfo = affected.slice(0,5).map((f) => {
      const risk = calculateFeatureRisk(f, features, graph);
      const name = String(f.properties?.name ?? f.properties?.label ?? 'Obiekt');
      let effect = "Niekontrolowane uszkodzenia";
      const layer = String(f.properties?.layer ?? "");
      if (layer.includes('bridge') || layer.includes('bridges')) effect = 'Most odcięty';
      if (layer === 'power') effect = 'Brak prądu';
      if (layer === 'hospitals') effect = 'Szpital na rezerwie lub offline';
      return { name, prob: (risk.value/100), effect };
    });

    // fallback: if no affected features found, use top critical features by risk
    if (!targetsInfo.length) {
      const rows = features
        .map((f) => ({ f, r: calculateFeatureRisk(f, features, graph) }))
        .sort((a,b) => b.r.value - a.r.value)
        .slice(0,5)
        .map(({f,r}) => {
          const name = String(f.properties?.name ?? f.properties?.label ?? 'Obiekt');
          const layer = String(f.properties?.layer ?? "");
          let effect = 'Niekontrolowane uszkodzenia';
          if (layer.includes('bridge') || layer.includes('bridges')) effect = 'Most odcięty';
          if (layer === 'power') effect = 'Brak prądu';
          if (layer === 'hospitals') effect = 'Szpital na rezerwie lub offline';
          return { name, prob: (r.value/100), effect };
        });
      targetsInfo = rows;
    }

    const actions = [
      'Aktywuj procedury awaryjne',
      'Włącz backupy i przełączniki',
      'Ewakuuj miejsca o najwyższym ryzyku',
      'Zabezpiecz mosty i szlaki komunikacyjne'
    ];

    // start alarm sound and show alert
    startAlarm();
    setWarAlert({ title: 'ALERT: Wojna — atak w toku', actions, targets: targetsInfo });
    }

    // cleanup after all animations
    const totalDuration = Math.max(3000, affected.length * 350 + 2500);
    const cleanupId = window.setTimeout(() => {
      try {
        simulationLayerRef.current?.remove();
      } catch (e) {}
      simulationLayerRef.current = null;
      // clear timers
      simulationTimersRef.current.forEach((id) => {
        try {
          window.clearInterval(id);
          window.clearTimeout(id);
        } catch (e) {}
      });
      simulationTimersRef.current = [];
      setSimulationRunning(false);
    }, totalDuration + 500);

    simulationTimersRef.current.push(cleanupId as unknown as number);
  }

  function stopSimulation() {
    try {
      simulationLayerRef.current?.remove();
    } catch (e) {}

    simulationLayerRef.current = null;
    setSimulationRunning(false);
    // stop alarm if running
    stopAlarm();
    setWarAlert(null);
    setWarActionsTaken([]);
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-900/95 border-b border-white/10">
        <div className="text-sm font-semibold">City Resilience & Infrastructure Awareness Platform</div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2"><span className="font-semibold">Status miasta:</span><span className="text-green-400">Operational</span></div>
          <div className="flex items-center gap-2"><span className="font-semibold">Alerty:</span><span className="text-yellow-400">2</span></div>
          <div className="flex items-center gap-2"><span className="font-semibold">Pogoda:</span><span>Sunny 22°C</span></div>
          <div className="flex items-center gap-2"><span className="font-semibold">Łączność:</span><span className="text-green-400">OK</span></div>
        </div>
      </header>

      {/* War alert modal */}
      {warAlert && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center pointer-events-auto">
          <div className="bg-black/80 p-6 rounded-lg max-w-3xl text-white">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold">{warAlert.title}</h2>
              <button onClick={() => { stopAlarm(); setWarAlert(null); }} className="ml-4 text-sm bg-white/10 px-2 py-1 rounded">Zamknij</button>
            </div>
            <div className="mt-4">
              <div className="font-semibold">Zalecane działania</div>
              <ul className="list-disc list-inside mt-2">
                {warAlert.actions.map((a,i)=>(<li key={i}>{a}</li>))}
              </ul>

              <div className="mt-3">
                <div className="font-semibold">Podejmij działania</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => takeWarAction('fire')}
                    className="bg-red-600 px-3 py-2 rounded text-sm flex items-center gap-2">
                    <span>🚒</span> <span>Zaangażuj straż pożarną</span>
                  </button>
                  <button onClick={() => takeWarAction('military')}
                    className="bg-zinc-700 px-3 py-2 rounded text-sm flex items-center gap-2">
                    <span>🪖</span> <span>Mobilizacja wojskowa</span>
                  </button>
                  <button onClick={() => takeWarAction('evac')}
                    className="bg-yellow-600 px-3 py-2 rounded text-sm flex items-center gap-2">
                    <span>🏃‍♀️</span> <span>Ewakuacja cywili</span>
                  </button>
                </div>

                {warActionsTaken.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-semibold">Wykonane działania</div>
                    <ul className="list-disc list-inside mt-2">
                      {warActionsTaken.map((a,i)=>(<li key={i}>{a}</li>))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4">
              <div className="font-semibold">Potencjalne cele</div>
              <table className="w-full mt-2 text-sm">
                <thead><tr><th className="text-left">Cel</th><th className="text-left">Prob.</th><th className="text-left">Skutki</th></tr></thead>
                <tbody>
                  {warAlert.targets.map((t,i)=>(<tr key={i}><td className="py-1">{t.name}</td><td>{Math.round(t.prob*100)}%</td><td>{t.effect}</td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="w-2/3 border-r border-white/10 relative h-full overflow-hidden">
          <div ref={mapElement} className="w-full h-full" aria-label="Mapa główna" />

          <div className="absolute right-6 top-6 z-[1000] pointer-events-auto">
            <div className="bg-zinc-900/95 text-white p-2 rounded shadow-md flex space-x-1">
              {(Object.keys(tileLayers) as MapView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setMapView(view)}
                  className={`px-2 py-1 rounded text-sm transition ${mapView === view ? "bg-white text-zinc-900" : "bg-white/10 text-white hover:bg-white/20"}`}
                >
                  {tileLayers[view].label}
                </button>
              ))}
            </div>
          </div>

          <div className="absolute left-6 top-6 z-[1000] pointer-events-auto">
            <div className="flex flex-col gap-2">
              <div>
                <button
                  type="button"
                  onClick={() => setShowLayersPanel((s) => !s)}
                  className="bg-zinc-800/95 text-white px-3 py-2 rounded shadow"
                >
                  Warstwy
                </button>

                {showLayersPanel && (
                  <div className="bg-zinc-900/95 text-white p-3 rounded mt-2 text-sm shadow-2xl border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">Warstwy</div>
                      <button type="button" onClick={() => setShowLayersPanel(false)} className="text-xs text-zinc-300">Zamknij</button>
                    </div>
                    <div className="flex flex-col gap-2 text-zinc-100">
                      {infrastructureLayerKeys.map((layer) => (
                        <label key={layer} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={activeInfrastructureLayers[layer]}
                            onChange={() =>
                              setActiveInfrastructureLayers((cur) => ({ ...cur, [layer]: !cur[layer] }))
                            }
                            className="h-4 w-4 accent-red-500"
                          />
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: infrastructureLayers[layer].color }}
                          />
                          <span className="truncate">{infrastructureLayers[layer].label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowSimPanel((s) => !s)}
                  className="bg-zinc-800/95 text-white px-3 py-2 rounded shadow"
                >
                  Symulacje
                </button>

                {showSimPanel && (
                  <div className="bg-zinc-900/95 text-white p-3 rounded mt-2 text-sm shadow-2xl border border-white/10 w-[280px]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">Symulacje</div>
                      <button type="button" onClick={() => setShowSimPanel(false)} className="text-xs text-zinc-300">Zamknij</button>
                    </div>

                    <div className="flex flex-col gap-2">
                      <select
                        value={selectedAttackType}
                        onChange={(e) => setSelectedAttackType(e.target.value)}
                        className="rounded bg-white/5 p-2 text-sm text-white"
                      >
                        <option value="power">Atak na elektrownie</option>
                        <option value="strategic">Atak na obiekty strategiczne</option>
                        <option value="hospitals">Atak na szpitale</option>
                        <option value="war">Wojna — rakiety i wojska</option>
                      </select>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={simulationRunning}
                          onClick={() => runSimulation()}
                          className={`rounded px-3 py-2 ${simulationRunning ? "bg-gray-500" : "bg-red-600 hover:bg-red-700"}`}
                        >
                          {simulationRunning ? "Symulacja..." : "Uruchom"}
                        </button>
                        <button type="button" onClick={stopSimulation} className="rounded px-3 py-2 bg-white/5">
                          Stop
                        </button>
                      </div>

                      <label className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-zinc-300">Szybkość:</span>
                        <input
                          type="range"
                          min={0.25}
                          max={4}
                          step={0.25}
                          value={simulationSpeed}
                          onChange={(e) => setSimulationSpeed(Number(e.target.value))}
                          className="flex-1"
                        />
                        <span className="ml-2 font-mono text-sm">{simulationSpeed.toFixed(2)}x</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="w-1/3 p-4 overflow-auto pointer-events-auto bg-zinc-900/80 h-full">
          <h2 className="text-lg font-semibold">City Status</h2>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-white/5 p-3 rounded">
              <div className="text-sm text-zinc-300">Resilience Score</div>
              <div className="text-2xl font-bold">{(() => { const f=geojsonRef.current?.features; if(!f) return '—'; const vals=f.map(fe=>calculateFeatureRisk(fe,f,graphRef.current).value); const avg = Math.round(vals.reduce((a,b)=>a+b,0)/Math.max(1,vals.length)); return `${avg}/100`; })()}</div>
            </div>
            <div className="bg-white/5 p-3 rounded">
              <div className="text-sm text-zinc-300">Active Alerts</div>
              <div className="text-2xl font-bold">2</div>
            </div>
            <div className="bg-white/5 p-3 rounded">
              <div className="text-sm text-zinc-300">Critical Nodes</div>
              <div className="text-2xl font-bold">{(() => { const f=geojsonRef.current?.features; if(!f) return '—'; const vals=f.map(fe=>({v:calculateFeatureRisk(fe,f,graphRef.current).value, name:fe.properties?.name})).filter(x=>x.v>=80); return vals.length; })()}</div>
            </div>
            <div className="bg-white/5 p-3 rounded">
              <div className="text-sm text-zinc-300">Infrastructure Availability</div>
              <div className="text-2xl font-bold">97.2%</div>
            </div>
          </div>

          <h3 className="mt-4 font-semibold">Top Critical Objects</h3>
          <table className="w-full text-sm mt-2 table-auto">
            <thead><tr className="text-left"><th className="pb-2">Obiekt</th><th className="pb-2">Risk</th><th className="pb-2">Zależności</th><th className="pb-2">Backup</th></tr></thead>
            <tbody>
              {(() => { const f=geojsonRef.current?.features; if(!f) return null; const rows=f.map(fe=>({name:fe.properties?.name||'?', risk:calculateFeatureRisk(fe,f,graphRef.current).value, deps: (fe.properties?.tags?.dependency_count)||0, backup: fe.properties?.tags?.backup? '✅':'❌'})).sort((a,b)=>b.risk-a.risk).slice(0,6); return rows.map((r,i)=>(<tr key={i}><td className="py-1">{r.name}</td><td>{r.risk}</td><td>{r.deps}</td><td>{r.backup}</td></tr>)) })()
              }
            </tbody>
          </table>

          <h3 className="mt-4 font-semibold">Impact Analysis</h3>
          <div className="bg-white/5 p-3 rounded text-sm mt-2">Kliknij obiekt na mapie, by zobaczyć analizę wpływu.</div>

          <div className="mt-4">
            <div className="text-sm font-semibold">Cascading Failure Simulation</div>
            <div className="mt-2 text-sm">Kliknij obiekt na mapie, następnie użyj symulacji (panel na mapie) aby zobaczyć propagację awarii.</div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold">Timeline / Event Stream</div>
            <div className="bg-white/5 p-2 rounded mt-2 text-sm max-h-40 overflow-auto">
              <ul>
                <li>12:01 - Water pressure anomaly</li>
                <li>12:04 - Backup power activated</li>
                <li>12:08 - Network rerouted</li>
                <li>12:15 - Incident resolved</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

    </main>
  );
}
