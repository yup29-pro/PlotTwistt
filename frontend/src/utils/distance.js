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
    const approx = `~${km.toFixed(1)} km`;
    return {
      known: true,
      text: flag.distance_within_locality ? `Within locality · ${approx} from centre` : `${approx} away`,
      basis: basis ? `Based on mention of '${basis}'` : 'Based on a place named in the story',
    };
  }
  return { known: false, text: 'Distance unknown', basis: 'No specific place is named in this story' };
}
