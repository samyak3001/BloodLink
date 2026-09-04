/**
 * Geospatial distance and location formatting utilities
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the great-circle distance between two points on Earth using the Haversine formula
 * @param coords1 [longitude, latitude] of first location
 * @param coords2 [longitude, latitude] of second location
 * @returns Distance in kilometers
 */
export function calculateDistanceKm(
  coords1: [number, number],
  coords2: [number, number]
): number {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;

  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = EARTH_RADIUS_KM * c;
  return Math.round(distance * 100) / 100; // Rounded to 2 decimal places
}

/**
 * Format a distance in kilometers into a human-readable string
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Estimate transit time based on average urban emergency transit velocity (~35 km/h)
 */
export function estimateTransitTimeMinutes(distanceKm: number): number {
  const averageSpeedKmH = 35;
  const transitMinutes = Math.round((distanceKm / averageSpeedKmH) * 60);
  return Math.max(5, transitMinutes); // Minimum 5-minute buffer
}
