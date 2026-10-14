import { enrichCareOptions } from "./careInsights.js";

const NOMINATIM_BASE_URL =
  process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
const OVERPASS_API_URL =
  process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter";
const OSM_USER_AGENT =
  process.env.OSM_USER_AGENT || "PulsePathEmergencyTriage/1.0 (hackathon prototype)";
const OSM_CONTACT_EMAIL = process.env.OSM_CONTACT_EMAIL || "";
const LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_SEARCH_RADIUS_METERS = 10000;
const EMERGENCY_SEARCH_RADIUS_METERS = 15000;
const MAX_RESULTS = 6;

const lookupCache = new Map();

function getCachedValue(key) {
  const cached = lookupCache.get(key);

  if (!cached) {
    return null;
  }

  if (Date.now() - cached.createdAt > LOOKUP_CACHE_TTL_MS) {
    lookupCache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue(key, value) {
  lookupCache.set(key, {
    createdAt: Date.now(),
    value
  });

  return value;
}

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function isFiniteCoordinate(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function roundCoordinate(value) {
  return Number(value.toFixed(6));
}

function getInputCoordinates(location) {
  const lat = Number(location?.coords?.lat);
  const lng = Number(location?.coords?.lng);

  if (!isFiniteCoordinate(lat) || !isFiniteCoordinate(lng)) {
    return null;
  }

  return {
    lat: roundCoordinate(lat),
    lng: roundCoordinate(lng),
    accuracyMeters:
      Number.isFinite(Number(location?.coords?.accuracyMeters))
        ? Math.round(Number(location.coords.accuracyMeters))
        : null
  };
}

function getLocationQuery(location) {
  if (typeof location === "string") {
    return normalizeText(location);
  }

  return normalizeText(location?.city || location?.label || "");
}

function haversineDistanceKm(origin, destination) {
  const earthRadiusKm = 6371;
  const latDelta = ((destination.lat - origin.lat) * Math.PI) / 180;
  const lngDelta = ((destination.lng - origin.lng) * Math.PI) / 180;
  const originLat = (origin.lat * Math.PI) / 180;
  const destinationLat = (destination.lat * Math.PI) / 180;
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(lngDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildGoogleDirectionsUrl(origin, destination) {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
}

function buildGoogleSearchUrl(coords) {
  return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
}

function buildRequestHeaders(extraHeaders = {}) {
  return {
    Accept: "application/json",
    "User-Agent": OSM_USER_AGENT,
    ...extraHeaders
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: buildRequestHeaders(options.headers)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

function buildNominatimUrl(pathname, params) {
  const url = new URL(pathname, NOMINATIM_BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  if (OSM_CONTACT_EMAIL) {
    url.searchParams.set("email", OSM_CONTACT_EMAIL);
  }

  return url;
}

function extractLocationParts(address = {}, fallbackLabel = "") {
  const label =
    address.neighbourhood ||
    address.suburb ||
    address.city_district ||
    address.city ||
    address.town ||
    address.village ||
    fallbackLabel ||
    "Current location";

  const region = address.city || address.town || address.village || address.state_district || address.state;

  const compact = [label, region].filter(Boolean).filter((item, index, list) => list.indexOf(item) === index);

  return compact.join(", ");
}

async function reverseGeocode(coords, fallbackLabel) {
  const cacheKey = `reverse:${coords.lat}:${coords.lng}`;
  const cached = getCachedValue(cacheKey);

  if (cached) {
    return cached;
  }

  const url = buildNominatimUrl("/reverse", {
    format: "jsonv2",
    lat: coords.lat,
    lon: coords.lng,
    zoom: 18,
    addressdetails: 1
  });
  const data = await fetchJson(url);
  const value = {
    label: extractLocationParts(data?.address, fallbackLabel),
    displayName: data?.display_name || fallbackLabel || "Current location"
  };

  return setCachedValue(cacheKey, value);
}

async function geocodeLocation(query) {
  const safeQuery = normalizeText(query);

  if (!safeQuery) {
    return null;
  }

  const cacheKey = `search:${safeQuery.toLowerCase()}`;
  const cached = getCachedValue(cacheKey);

  if (cached) {
    return cached;
  }

  const url = buildNominatimUrl("/search", {
    q: safeQuery,
    format: "jsonv2",
    limit: 1,
    addressdetails: 1
  });
  const results = await fetchJson(url);
  const match = Array.isArray(results) ? results[0] : null;

  if (!match) {
    return null;
  }

  const value = {
    coordinates: {
      lat: roundCoordinate(Number(match.lat)),
      lng: roundCoordinate(Number(match.lon)),
      accuracyMeters: null
    },
    label: extractLocationParts(match.address, safeQuery),
    displayName: match.display_name || safeQuery
  };

  return setCachedValue(cacheKey, value);
}

function buildOverpassQuery(coords, radiusMeters) {
  return `
[out:json][timeout:20];
(
  node["amenity"~"^(hospital|clinic)$"](around:${radiusMeters},${coords.lat},${coords.lng});
  way["amenity"~"^(hospital|clinic)$"](around:${radiusMeters},${coords.lat},${coords.lng});
  relation["amenity"~"^(hospital|clinic)$"](around:${radiusMeters},${coords.lat},${coords.lng});
  node["healthcare"~"^(hospital|clinic)$"](around:${radiusMeters},${coords.lat},${coords.lng});
  way["healthcare"~"^(hospital|clinic)$"](around:${radiusMeters},${coords.lat},${coords.lng});
  relation["healthcare"~"^(hospital|clinic)$"](around:${radiusMeters},${coords.lat},${coords.lng});
);
out center tags qt;
  `.trim();
}

function normalizeFacilityType(tags = {}) {
  const rawType = tags.amenity || tags.healthcare || "";
  return rawType === "clinic" ? "Clinic" : "Hospital";
}

function buildFacilityAddress(tags = {}) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const area = [
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:district"],
    tags["addr:state"]
  ].filter(Boolean);

  return [street, ...area].filter(Boolean).join(", ");
}

function buildFacilityTags(tags = {}, type) {
  const explicitSpecialties = String(tags["healthcare:speciality"] || "")
    .split(/[;,]/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
  const normalizedSpecialties = explicitSpecialties.map((item) =>
    item
      .split(" ")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(" ")
  );

  const tagsList = new Set(normalizedSpecialties.slice(0, 3));

  if (
    tags.emergency === "yes" ||
    tags.emergency_department === "yes" ||
    tags["emergency:department"] === "yes"
  ) {
    tagsList.add("Emergency");
  }

  if (!tagsList.size) {
    tagsList.add(type);
  }

  return Array.from(tagsList);
}

function toFacilityRecord(element, origin) {
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);

  if (!isFiniteCoordinate(lat) || !isFiniteCoordinate(lng)) {
    return null;
  }

  const coords = {
    lat: roundCoordinate(lat),
    lng: roundCoordinate(lng)
  };
  const type = normalizeFacilityType(element.tags);
  const distanceKm = haversineDistanceKm(origin, coords);
  const address = buildFacilityAddress(element.tags);
  const emergencyReady =
    element.tags?.emergency === "yes" ||
    element.tags?.emergency_department === "yes" ||
    element.tags?.["emergency:department"] === "yes" ||
    type === "Hospital";

  return {
    id: `${element.type}-${element.id}`,
    name: element.tags?.name || `${type} nearby`,
    type,
    address,
    area: address,
    emergencyReady,
    distanceKm: Number(distanceKm.toFixed(1)),
    coordinates: coords,
    specialties: buildFacilityTags(element.tags, type),
    mapUrl: buildGoogleDirectionsUrl(origin, coords),
    source: "OpenStreetMap live"
  };
}

function dedupeFacilities(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = `${item.name.toLowerCase()}|${item.coordinates.lat}|${item.coordinates.lng}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function lookupFacilities(origin, radiusMeters, { urgencyLevel = "Normal", recommendedSpecialty = "" } = {}) {
  const cacheKey = `facilities:${origin.lat.toFixed(4)}:${origin.lng.toFixed(4)}:${radiusMeters}:${urgencyLevel}:${normalizeText(recommendedSpecialty)}`;
  const cached = getCachedValue(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await fetchJson(OVERPASS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8"
    },
    body: buildOverpassQuery(origin, radiusMeters)
  });
  const records = Array.isArray(response?.elements)
    ? enrichCareOptions(
        dedupeFacilities(
          response.elements
            .map((element) => toFacilityRecord(element, origin))
            .filter(Boolean)
        ),
        { urgencyLevel, recommendedSpecialty }
      )
        .sort((left, right) => left.distanceKm - right.distanceKm)
        .slice(0, MAX_RESULTS)
    : [];

  return setCachedValue(cacheKey, records);
}

function buildFallbackLocationContext(location, radiusMeters) {
  const coords = getInputCoordinates(location);
  const label = getLocationQuery(location) || (coords ? "Current location" : "Location unavailable");

  return {
    label,
    displayName: label,
    coordinates: coords ? { lat: coords.lat, lng: coords.lng } : null,
    accuracyMeters: coords?.accuracyMeters ?? null,
    mapUrl: coords ? buildGoogleSearchUrl(coords) : "",
    dataSource: "Input fallback",
    searchRadiusKm: Math.round(radiusMeters / 1000),
    mode: coords ? "gps" : "manual"
  };
}

export async function resolveNearbyCare({
  location,
  urgencyLevel = "Normal",
  recommendedSpecialty = ""
}) {
  const gpsCoords = getInputCoordinates(location);
  const manualQuery = getLocationQuery(location);
  const radiusMeters =
    urgencyLevel === "Emergency" ? EMERGENCY_SEARCH_RADIUS_METERS : DEFAULT_SEARCH_RADIUS_METERS;
  let origin = gpsCoords;
  let label = manualQuery || "Current location";
  let displayName = manualQuery || "Current location";
  let mode = gpsCoords ? "gps" : "manual";

  try {
    if (gpsCoords) {
      const reverseMatch = await reverseGeocode(gpsCoords, manualQuery);
      label = reverseMatch.label || label;
      displayName = reverseMatch.displayName || displayName;
    } else if (manualQuery) {
      const searchMatch = await geocodeLocation(manualQuery);

      if (searchMatch?.coordinates) {
        origin = searchMatch.coordinates;
        label = searchMatch.label || label;
        displayName = searchMatch.displayName || displayName;
        mode = "search";
      }
    }

    if (!origin) {
      return {
        nearbyHospitals: [],
        locationContext: buildFallbackLocationContext(location, radiusMeters)
      };
    }

    const nearbyHospitals = await lookupFacilities(origin, radiusMeters, {
      urgencyLevel,
      recommendedSpecialty
    });

    return {
      nearbyHospitals,
      locationContext: {
        label,
        displayName,
        coordinates: {
          lat: origin.lat,
          lng: origin.lng
        },
        accuracyMeters: gpsCoords?.accuracyMeters ?? null,
        mapUrl: buildGoogleSearchUrl(origin),
        dataSource: nearbyHospitals.length ? "OpenStreetMap live lookup" : "Location resolved",
        searchRadiusKm: Math.round(radiusMeters / 1000),
        mode
      }
    };
  } catch {
    return {
      nearbyHospitals: [],
      locationContext: buildFallbackLocationContext(location, radiusMeters)
    };
  }
}
