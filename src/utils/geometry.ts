/** Spherical polygon area in square metres (geodesic, accurate for roof-sized polygons). */
export function polygonAreaSqM(points: Array<{ latitude: number; longitude: number }>): number {
  if (points.length < 3) return 0;
  const R = 6_378_137;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += toRad(p2.longitude - p1.longitude) * (2 + Math.sin(toRad(p1.latitude)) + Math.sin(toRad(p2.latitude)));
  }
  return Math.abs((area * R * R) / 2);
}

export function sqMtoSqFt(m2: number): number {
  return m2 * 10.7639;
}

/** Roofing "squares" — 100 sq ft each. */
export function sqMtoSquares(m2: number): number {
  return sqMtoSqFt(m2) / 100;
}

/**
 * Apply pitch correction to a flat/satellite-measured area to get the true
 * sloped surface area. Pitch is in degrees from horizontal.
 */
export function applyPitch(flatM2: number, pitchDegrees: number): number {
  const rad = (pitchDegrees * Math.PI) / 180;
  return flatM2 / Math.max(0.001, Math.cos(rad));
}
