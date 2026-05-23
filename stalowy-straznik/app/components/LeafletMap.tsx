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
        <div className="pointer-events-auto mt-4 rounded-md bg-white/10 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">
            Warstwy
          </div>
          <div className="mt-3 grid max-h-[42vh] gap-2 overflow-y-auto pr-1 text-sm">
            {infrastructureLayerKeys.map((layer) => (
              <label
                key={layer}
                className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-zinc-100 transition hover:bg-white/10"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-red-500"
                  checked={activeInfrastructureLayers[layer]}
                  onChange={() =>
                    setActiveInfrastructureLayers((currentLayers) => ({
                      ...currentLayers,
                      [layer]: !currentLayers[layer],
                    }))
                  }
                />
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: infrastructureLayers[layer].color }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {infrastructureLayers[layer].label}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                  {infrastructureLayers[layer].source === "GESUT WMS"
                    ? "GESUT"
                    : infrastructureLayers[layer].source === "Model"
                      ? "GRAF"
                      : "OSM"}
                </span>
              </label>
            ))}
          </div>
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
