/**
 * Google Maps helpers used at PDF generation time:
 *   1. Geocode a free-text address → { lat, lng }
 *   2. Fetch a satellite PNG → base64 data URI for embedding in PDFs
 *
 * The API key is loaded from `Constants.expoConfig.extra.googleMapsApiKey`,
 * populated at build time from the GOOGLE_MAPS_API_KEY env var (locally via
 * `.env`, in production via EAS Secrets). The key MUST be restricted in the
 * GCP console to the app bundle id and to the Maps Static + Geocoding APIs.
 */

import Constants from 'expo-constants';
import { getRegionCountryName } from './locale';

function getApiKey(): string {
  const extra = (Constants.expoConfig?.extra ?? (Constants as any).manifest?.extra) as
    | { googleMapsApiKey?: string }
    | undefined;
  return extra?.googleMapsApiKey ?? '';
}

/** Geocode an address string. Region-aware: appends the user's country. */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    const country = await getRegionCountryName();
    const lower = address.toLowerCase();
    const query =
      country && !lower.includes(country.toLowerCase())
        ? `${address}, ${country}`
        : address;
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(query)}&key=${apiKey}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== 'OK' || !json.results?.length) return null;
    const { lat, lng } = json.results[0].geometry.location;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Fetch a satellite image from Google Maps Static API and return it as a
 * base64 data URI ready to embed in an <img> tag.
 *
 * @param lat Latitude
 * @param lng Longitude
 * @param zoom 18 = roof-level for most residential; 17 for large commercial
 * @param width Image width in pixels (max 640 on free tier)
 * @param height Image height in pixels (max 640 on free tier)
 */
export async function fetchSatelliteImageUri(
  lat: number,
  lng: number,
  zoom = 19,
  width = 600,
  height = 380
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) return '';
  try {
    const url =
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${lat},${lng}` +
      `&zoom=${zoom}` +
      `&size=${width}x${height}` +
      `&maptype=satellite` +
      `&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

/**
 * Convenience: geocode an address then return the satellite image URI.
 * Returns empty string silently if geocoding or image fetch fails (report
 * will simply omit the map section).
 */
export async function addressToSatelliteUri(address: string): Promise<string> {
  const coords = await geocodeAddress(address);
  if (!coords) return '';
  return fetchSatelliteImageUri(coords.lat, coords.lng);
}
