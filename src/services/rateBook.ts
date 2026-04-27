/**
 * Built-in price guide for common roofing line items, broken down by region.
 * Prices are *suggestions only* — installers should adjust based on access,
 * pitch, materials, and local labour costs. All prices are ex-VAT.
 *
 * Currency comes from the user's locale (locale.currency); the numbers below
 * are nominal in the region's primary currency.
 *
 * Last reviewed: April 2026.
 */
import { Region } from './locale';

export interface RateItem {
  /** Stable id, used to reference templates */
  id: string;
  /** Display label */
  label: string;
  /** Quantity unit displayed in the quote ("m²", "m", "No.", "Allow") */
  unit: string;
  /** Unit price (ex-VAT) in the region's primary currency */
  unitPrice: number;
  /** Pre-filled description when added to a quote */
  description: string;
  /** Grouping for the picker */
  category: 'tiles' | 'flashing' | 'gutters' | 'access' | 'general';
}

const IE: RateItem[] = [
  { id: 'slate-repair-m2',    label: 'Slate repair (per m²)',          unit: 'm²',   unitPrice: 95,   category: 'tiles',    description: 'Localised slate repair: replace cracked/missing slates and re-bed adjacent units.' },
  { id: 'slate-strip-recover', label: 'Strip & re-cover, natural slate', unit: 'm²',  unitPrice: 220,  category: 'tiles',    description: 'Strip existing slates, replace battens and underlay, re-cover with reclaimed/new natural slate.' },
  { id: 'concrete-tile-m2',   label: 'Concrete tile re-cover (per m²)', unit: 'm²',  unitPrice: 165,  category: 'tiles',    description: 'Strip existing tiles, replace battens and breathable underlay, re-tile with concrete interlocking tiles.' },
  { id: 'flat-felt-m2',       label: 'Felt flat-roof recover (per m²)', unit: 'm²',  unitPrice: 110,  category: 'tiles',    description: 'Torch-on three-layer felt system to flat roof, including primer and dressing into existing details.' },
  { id: 'ridge-tile-each',    label: 'Ridge tile re-bed (each)',         unit: 'No.',  unitPrice: 28,   category: 'tiles',    description: 'Lift, re-bed and point ridge tile in flexible mortar; replace if cracked.' },
  { id: 'lead-flashing-m',    label: 'Lead flashing (per m)',            unit: 'm',    unitPrice: 75,   category: 'flashing', description: 'Code 4 lead step/cover flashing, dressed and pointed into masonry chase.' },
  { id: 'chimney-flashing',   label: 'Full chimney re-flash',            unit: 'No.',  unitPrice: 650,  category: 'flashing', description: 'Strip existing flashings; install new lead apron, soakers, step flashings and back gutter.' },
  { id: 'gutter-clean-m',     label: 'Gutter clean (per m)',             unit: 'm',    unitPrice: 8,    category: 'gutters',  description: 'Clear gutters and downpipes of debris, flush-test downpipes for free flow.' },
  { id: 'gutter-replace-m',   label: 'Gutter replacement (per m)',       unit: 'm',    unitPrice: 38,   category: 'gutters',  description: 'Remove existing gutter, replace with new uPVC half-round on existing brackets.' },
  { id: 'downpipe-each',      label: 'Downpipe replacement (each)',      unit: 'No.',  unitPrice: 95,   category: 'gutters',  description: 'Replace downpipe with matching uPVC, including all clips and shoe.' },
  { id: 'scaffold-day',       label: 'Scaffold (per day)',               unit: 'days', unitPrice: 75,   category: 'access',   description: 'Independent scaffold to access elevation; per-day hire after week 1.' },
  { id: 'scaffold-erect',     label: 'Scaffold erect / dismantle',       unit: 'No.',  unitPrice: 850,  category: 'access',   description: 'Erect, certify and later dismantle scaffold to one elevation.' },
  { id: 'cherry-picker-day',  label: 'MEWP / cherry picker (per day)',   unit: 'days', unitPrice: 350,  category: 'access',   description: 'Self-propelled boom lift hire; insurance and fuel included.' },
  { id: 'survey-allow',       label: 'Survey & report allowance',        unit: 'Allow', unitPrice: 250, category: 'general',  description: 'Detailed survey, photographic record and written report.' },
  { id: 'rubbish-skip',       label: 'Skip / waste removal',             unit: 'No.',  unitPrice: 320,  category: 'general',  description: '6-yard skip, including permit and disposal of construction waste.' },
];

// Approximate currency-converted versions. Adjust as you go.
const UK = scale(IE, 0.86); // EUR -> GBP
const US = scale(IE, 1.08); // EUR -> USD  (US often higher labour)
const CA = scale(IE, 1.45); // EUR -> CAD
const AU = scale(IE, 1.65); // EUR -> AUD
const ES = IE;              // Spain shares EUR; pricing differs but use IE as baseline

function scale(items: RateItem[], factor: number): RateItem[] {
  return items.map((i) => ({ ...i, unitPrice: Math.round(i.unitPrice * factor) }));
}

const BY_REGION: Record<Region, RateItem[]> = { IE, UK, US, CA, AU, ES };

export function getRateBook(region: Region): RateItem[] {
  return BY_REGION[region] ?? IE;
}

export function getRateItem(region: Region, id: string): RateItem | undefined {
  return getRateBook(region).find((i) => i.id === id);
}

export const CATEGORIES: Array<{ key: RateItem['category']; label: string }> = [
  { key: 'tiles', label: 'Tiles & slates' },
  { key: 'flashing', label: 'Flashings' },
  { key: 'gutters', label: 'Gutters & rainwater' },
  { key: 'access', label: 'Access' },
  { key: 'general', label: 'General' },
];
