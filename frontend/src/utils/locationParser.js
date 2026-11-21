/**
 * locationParser.js
 * Comprehensive location, coordinate, and Google Maps URL parser for PlotTwistt.
 */

// ---------------------------------------------------------------------------
// 1. Raw Coordinates Parsing
// ---------------------------------------------------------------------------

/**
 * Checks and extracts lat/lng from raw coordinate formats:
 * - "12.8456, 77.6489"
 * - "12.8456,77.6489"
 * - "12.8456° N, 77.6489° E"
 * - "12.8456 N 77.6489 E"
 * - "-12.8456, -77.6489"
 */
export function parseCoordinates(input) {
  if (!input || typeof input !== "string") return null;
  const str = input.trim();

  // Regex for latitude, longitude with optional degree signs and cardinal directions
  const coordRegex =
    /^\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSns])?\s*[,;\s/]\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([EWew])?\s*$/;

  const match = str.match(coordRegex);
  if (!match) return null;

  let lat = parseFloat(match[1]);
  const latDir = match[2]?.toUpperCase();
  let lng = parseFloat(match[3]);
  const lngDir = match[4]?.toUpperCase();

  if (isNaN(lat) || isNaN(lng)) return null;

  if (latDir === "S") lat = -Math.abs(lat);
  if (lngDir === "W") lng = -Math.abs(lng);

  // Validate bounds
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    mode: "coords",
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  };
}

// ---------------------------------------------------------------------------
// 2. Google Maps URLs Parsing
// ---------------------------------------------------------------------------

/**
 * Parses Google Maps URLs:
 * - standard desktop/mobile URLs with coordinates:
 *   - /@12.8456,77.6489,17z
 *   - ?q=12.8456,77.6489
 *   - ?query=12.8456,77.6489
 *   - !3d12.8456!4d77.6489
 * - place name extraction: /place/Prestige+Sunrise+Park/
 * - shortlinks (maps.app.goo.gl or goo.gl/maps)
 */
export function parseGoogleMapsUrl(input) {
  if (!input || typeof input !== "string") return null;
  const str = input.trim();

  const isMapsUrl =
    str.includes("google.com/maps") ||
    str.includes("maps.google.") ||
    str.includes("maps.app.goo.gl") ||
    str.includes("goo.gl/maps");

  if (!isMapsUrl) return null;

  // Extract place name from /place/<name>/ if present
  let placeName = null;
  const placeMatch = str.match(/\/place\/([^/@?#]+)/);
  if (placeMatch && placeMatch[1]) {
    try {
      placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    } catch {
      placeName = placeMatch[1].replace(/\+/g, " ");
    }
  }

  // 1. Try @lat,lng
  const atMatch = str.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return {
        mode: "maps_link",
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        label: placeName || `Google Maps Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        rawUrl: str,
      };
    }
  }

  // 2. Try query params: ?q=lat,lng or ?query=lat,lng or ?ll=lat,lng
  const queryMatch = str.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return {
        mode: "maps_link",
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        label: placeName || `Google Maps Target (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        rawUrl: str,
      };
    }
  }

  // 3. Try data protobuf params: !3d<lat>!4d<lng>
  const protoMatch = str.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
  if (protoMatch) {
    const lat = parseFloat(protoMatch[1]);
    const lng = parseFloat(protoMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return {
        mode: "maps_link",
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        label: placeName || `Google Maps Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        rawUrl: str,
      };
    }
  }

  // 4. Shortlink or unresolved redirect link (maps.app.goo.gl or goo.gl/maps)
  if (str.includes("maps.app.goo.gl") || str.includes("goo.gl/maps")) {
    return {
      mode: "maps_link_unresolved",
      rawUrl: str,
      label: placeName || "Google Maps Shortlink",
    };
  }

  // URL was identified as Google Maps but coordinates weren't directly embedded in the text
  return {
    mode: "maps_link_unresolved",
    rawUrl: str,
    label: placeName || "Google Maps Link",
  };
}

// ---------------------------------------------------------------------------
// 3. Fast Input Classifier
// ---------------------------------------------------------------------------

/**
 * Returns input classification mode without making network calls.
 * @returns { "coords" | "maps_link" | "maps_link_unresolved" | "place" }
 */
export function classifyInput(input) {
  if (!input || !input.trim()) return "place";

  const coords = parseCoordinates(input);
  if (coords) return "coords";

  const maps = parseGoogleMapsUrl(input);
  if (maps) return maps.mode;

  return "place";
}

// ---------------------------------------------------------------------------
// 4. OpenStreetMap Nominatim Geocoding & Reverse Geocoding
// ---------------------------------------------------------------------------

/**
 * Searches OpenStreetMap Nominatim for apartment/flat/locality text.
 * E.g., "Prestige Sunrise Park, Neeladri Nagar"
 */
export async function searchNominatim(query, signal) {
  if (!query || query.trim().length < 3) return [];

  const cleanQuery = query.trim();
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    cleanQuery
  )}&limit=5&addressdetails=1`;

  try {
    const res = await fetch(url, {
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`Nominatim search returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    return data.map((item) => ({
      id: item.place_id,
      name: item.name || item.display_name.split(",")[0],
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      category: item.class,
    }));
  } catch (err) {
    if (err.name === "AbortError") return [];
    console.warn("Nominatim search request failed:", err);
    return [];
  }
}

/**
 * Reverse geocodes lat/lng into a clean readable place address when clicking on the map.
 */
export async function reverseGeocodeNominatim(lat, lng, signal) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

  try {
    const res = await fetch(url, {
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.display_name) return null;

    const parts = data.display_name.split(",").map((s) => s.trim());
    const shortLabel = parts.slice(0, 3).join(", ");

    return {
      full_address: data.display_name,
      short_label: shortLabel,
      suburb: data.address?.suburb || data.address?.neighbourhood || data.address?.residential,
      city: data.address?.city || data.address?.state_district,
    };
  } catch (err) {
    if (err.name === "AbortError") return null;
    console.warn("Nominatim reverse geocode failed:", err);
    return null;
  }
}
