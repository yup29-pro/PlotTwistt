/** Chip text and explanation for a flag's distance, matching how the backend derived it. */
export function describeDistance(flag) {
  const km = typeof flag?.distance_km === 'number' ? flag.distance_km : null;
  const method = flag?.distance_method;
  const basis = flag?.distance_basis;

  if (method === 'osm_feature' && km !== null) {
    const metres = Math.round(km * 1000);
    return {
      known: true,
      text: metres < 1000 ? `${metres} m away` : `${km.toFixed(1)} km away`,
      basis: basis ? `Measured from OpenStreetMap (${basis})` : 'Measured from OpenStreetMap',
    };
  }
  if (method === 'mentioned_place' && km !== null) {
    if (flag.distance_within_locality && basis) {
      return {
        known: true,
        // Measured to the locality's centre, so a small figure only says "inside it".
        text: km < 1.5 ? `In ${basis} (under 1.5 km)` : `~${km.toFixed(1)} km · within ${basis}`,
        basis: `Based on mention of '${basis}', measured from the pin to its centre`,
      };
    }
    return {
      known: true,
      text: `~${km.toFixed(1)} km away`,
      basis: basis ? `Based on mention of '${basis}'` : 'Based on a place named in the story',
    };
  }
  if (method === 'search_area' && basis) {
    return {
      known: true,
      text: `In ${basis} area`,
      basis: `Found by a search for '${basis}'; the story names no more specific place`,
    };
  }
  return { known: false, text: 'Distance unknown', basis: 'No specific place is named in this story' };
}
