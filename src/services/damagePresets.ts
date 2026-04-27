/**
 * Common roof damage categories. Tagging a photo with one of these keys lets
 * the report and quote screens show aggregated counts (e.g. "4 broken tiles
 * across 12 photos") instead of forcing the inspector to read every note.
 */
export interface DamagePreset {
  key: string;
  label: string;
  /** Plural form used in the report summary, e.g. "broken tiles" */
  plural: string;
  /** Short emoji icon for the picker chip */
  icon: string;
}

export const DAMAGE_PRESETS: DamagePreset[] = [
  { key: 'broken_tile',       label: 'Broken tile',       plural: 'broken tiles',         icon: '🧱' },
  { key: 'missing_tile',      label: 'Missing tile',      plural: 'missing tiles',        icon: '⬜' },
  { key: 'missing_flashing',  label: 'Missing flashing',  plural: 'missing flashings',    icon: '⚡' },
  { key: 'lifted_flashing',   label: 'Lifted flashing',   plural: 'lifted flashings',     icon: '↗️' },
  { key: 'moss',              label: 'Moss / lichen',     plural: 'areas of moss/lichen', icon: '🌿' },
  { key: 'staining',          label: 'Water staining',    plural: 'areas of staining',    icon: '💧' },
  { key: 'crack',             label: 'Crack',             plural: 'cracks',               icon: '⚠️' },
  { key: 'water_damage',      label: 'Water damage',      plural: 'areas of water damage',icon: '🌧️' },
  { key: 'rusted_fixing',     label: 'Rusted fixing',     plural: 'rusted fixings',       icon: '🔩' },
  { key: 'sagging',           label: 'Sagging structure', plural: 'sagging areas',        icon: '📉' },
  { key: 'gutter_blocked',    label: 'Blocked gutter',    plural: 'blocked gutter sections', icon: '🪣' },
  { key: 'pointing_eroded',   label: 'Eroded pointing',   plural: 'sections of eroded pointing', icon: '🧱' },
];

export function damagePresetFor(key: string): DamagePreset | undefined {
  return DAMAGE_PRESETS.find((d) => d.key === key);
}

/**
 * Aggregate damage tags across all photos and return a human-readable summary
 * line. Returns empty string if no tags found.
 */
export function summariseDamage(photos: Array<{ damageTags?: string[] }>): string {
  const counts = new Map<string, number>();
  for (const p of photos) {
    for (const t of p.damageTags ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return '';
  const parts: string[] = [];
  for (const [key, count] of counts) {
    const preset = damagePresetFor(key);
    if (!preset) continue;
    parts.push(`${count} ${preset.plural}`);
  }
  return parts.join(', ');
}
