import { mkdir, writeFile } from "node:fs/promises";

const overpassUrl = "https://overpass-api.de/api/interpreter";
const outputPath = new URL("../public/data/stalowa-wola-infrastructure.geojson", import.meta.url);

const bbox = "50.50,21.94,50.66,22.16";

const query = `
[out:json][timeout:60];
(
  nwr["amenity"="hospital"](${bbox});
  nwr["amenity"="fuel"](${bbox});
  nwr["amenity"="shelter"](${bbox});
  nwr["building"="warehouse"](${bbox});
  nwr["industrial"~"warehouse|logistics"](${bbox});
  nwr["landuse"="industrial"]["name"~"logist|Logist|park|Park|EURO|Euro|Panattoni"](${bbox});
  nwr["name"~"Huta Stalowa Wola|Elektrownia Stalowa Wola|Miejski Zakład Komunalny|MZK|Zakład Wodociągów|WITU|Wojskowy Instytut|Jednostka Wojskowa|18 Pułk|18\\. Pułk|18 Brygada|18\\. Brygada|Euro-Park|EURO-PARK", i](${bbox});
  nwr["military"](${bbox});
  nwr["landuse"="military"](${bbox});
  nwr["power"~"substation|plant|generator|line|minor_line"](${bbox});
  nwr["man_made"~"mast|tower"]["tower:type"~"communication|telecommunication"](${bbox});
  nwr["communication:mobile_phone"="yes"](${bbox});
  nwr["telecom"](${bbox});
  way["railway"~"rail|narrow_gauge|tram|spur|siding|yard"](${bbox});
  way["bridge"]["highway"](${bbox});
  way["bridge"]["railway"](${bbox});
);
out body geom;
`;

function getFeatureType(tags = {}) {
  if (tags.public_transport || tags.highway === "bus_stop") {
    return "other";
  }

  if (
    tags.military ||
    tags.landuse === "military" ||
    /Huta Stalowa Wola|Elektrownia Stalowa Wola|Miejski Zakład Komunalny|MZK|Zakład Wodociągów|WITU|Wojskowy Instytut|Jednostka Wojskowa|18 Pułk|18\. Pułk|18 Brygada|18\. Brygada|Euro-Park|EURO-PARK/i.test(
      tags.name ?? "",
    )
  ) {
    return "strategic";
  }

  if (tags.amenity === "hospital") return "hospitals";
  if (tags.amenity === "fuel") return "fuel";
  if (tags.amenity === "shelter") return "shelters";
  if (tags.building === "warehouse" || tags.industrial === "warehouse") {
    return "warehouses";
  }
  if (tags.industrial === "logistics") return "logistics";
  if (tags.landuse === "industrial" && /logist|park|euro|panattoni/i.test(tags.name ?? "")) {
    return "logistics";
  }
  if (tags.power) return "power";
  if (
    tags["communication:mobile_phone"] === "yes" ||
    tags.telecom ||
    /communication|telecommunication/.test(tags["tower:type"] ?? "")
  ) {
    return "bts";
  }
  if (tags.bridge) return "bridges";
  if (tags.railway) return "rail";

  return "other";
}

function getCoordinates(element) {
  if (element.type === "node") {
    return [element.lon, element.lat];
  }

  if (element.type === "way" && element.geometry?.length) {
    const coordinates = element.geometry.map((point) => [point.lon, point.lat]);
    const first = coordinates[0];
    const last = coordinates.at(-1);

    if (first?.[0] === last?.[0] && first?.[1] === last?.[1]) {
      return [coordinates];
    }

    return coordinates;
  }

  if (element.type === "relation" && element.members?.length) {
    const lines = element.members
      .filter((member) => member.geometry?.length)
      .map((member) => member.geometry.map((point) => [point.lon, point.lat]));

    if (lines.length === 1) {
      return lines[0];
    }

    return lines;
  }

  return null;
}

function getGeometryType(element, coordinates) {
  if (element.type === "node") return "Point";
  if (element.type === "relation" && Array.isArray(coordinates?.[0]?.[0])) {
    return "MultiLineString";
  }
  if (Array.isArray(coordinates?.[0]?.[0])) return "Polygon";

  return "LineString";
}

const response = await fetch(overpassUrl, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "user-agent": "stalowy-straznik/0.1 data import",
  },
  body: new URLSearchParams({ data: query }),
});

if (!response.ok) {
  const errorBody = await response.text();
  throw new Error(
    `Overpass request failed: ${response.status} ${response.statusText}\n${errorBody}`,
  );
}

const data = await response.json();
const seen = new Set();
const features = data.elements
  .map((element) => {
    const coordinates = getCoordinates(element);

    if (!coordinates) {
      return null;
    }

    const key = `${element.type}/${element.id}`;

    if (seen.has(key)) {
      return null;
    }

    seen.add(key);

    const layer = getFeatureType(element.tags);

    return {
      type: "Feature",
      id: key,
      properties: {
        id: key,
        layer,
        name:
          element.tags?.name ??
          element.tags?.operator ??
          (layer === "strategic" ? "Obiekt strategiczny (OSM)" : key),
        source: "OpenStreetMap",
        osmType: element.type,
        osmId: element.id,
        tags: element.tags ?? {},
      },
      geometry: {
        type: getGeometryType(element, coordinates),
        coordinates,
      },
    };
  })
  .filter(Boolean);

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      type: "FeatureCollection",
      name: "stalowa-wola-infrastructure",
      generatedAt: new Date().toISOString(),
      bbox: [21.94, 50.5, 22.16, 50.66],
      features,
    },
    null,
    2,
  ),
);

const counts = features.reduce((accumulator, feature) => {
  accumulator[feature.properties.layer] = (accumulator[feature.properties.layer] ?? 0) + 1;
  return accumulator;
}, {});

console.log(`Saved ${features.length} features to ${outputPath.pathname}`);
console.log(counts);
