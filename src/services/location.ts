/**
 * Geolocation service — best-effort GPS lookup for tagging photos and
 * pre-filling roof measurement maps. Silently fails if permission is denied
 * so the camera flow is never blocked by location.
 */
import * as Location from 'expo-location';

let permissionRequested = false;
let permissionGranted = false;

/** Request foreground location permission once. Cached for the session. */
export async function ensureLocationPermission(): Promise<boolean> {
  if (permissionRequested) return permissionGranted;
  permissionRequested = true;
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.granted) {
      permissionGranted = true;
      return true;
    }
    const req = await Location.requestForegroundPermissionsAsync();
    permissionGranted = req.granted;
    return req.granted;
  } catch {
    permissionGranted = false;
    return false;
  }
}

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
}

/**
 * Best-effort current location with a short timeout. Returns null on any
 * failure (permission denied, GPS off, indoors with no signal, timeout).
 */
export async function getCurrentLocation(timeoutMs = 4000): Promise<GpsFix | null> {
  const ok = await ensureLocationPermission();
  if (!ok) return null;
  try {
    const result = await Promise.race<Location.LocationObject | null>([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!result) return null;
    return {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
      accuracy: result.coords.accuracy ?? undefined,
      altitude: result.coords.altitude ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Distance in metres between two GPS coords (haversine). */
export function distanceBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}
