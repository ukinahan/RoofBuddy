/**
 * Locale settings: region (country), language, units, currency.
 * Persisted alongside the company profile but kept in its own module so
 * non-profile code (geocoding, formatters, i18n) doesn't depend on company.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

export type Region = 'IE' | 'UK' | 'US' | 'CA' | 'AU' | 'ES';
export type Language = 'en' | 'ga' | 'es';
export type Units = 'metric' | 'imperial';
export type CurrencyCode = 'EUR' | 'GBP' | 'USD' | 'CAD' | 'AUD';

export interface LocaleSettings {
  region: Region;
  language: Language;
  units: Units;
  currency: CurrencyCode;
}

const KEY = '@roof_inspector:locale';

const REGION_DEFAULTS: Record<Region, { currency: CurrencyCode; units: Units; postcodeLabel: string; country: string }> = {
  IE: { currency: 'EUR', units: 'metric',   postcodeLabel: 'Eircode',  country: 'Ireland' },
  UK: { currency: 'GBP', units: 'imperial', postcodeLabel: 'Postcode', country: 'United Kingdom' },
  US: { currency: 'USD', units: 'imperial', postcodeLabel: 'ZIP Code', country: 'United States' },
  CA: { currency: 'CAD', units: 'metric',   postcodeLabel: 'Postal Code', country: 'Canada' },
  AU: { currency: 'AUD', units: 'metric',   postcodeLabel: 'Postcode', country: 'Australia' },
  ES: { currency: 'EUR', units: 'metric',   postcodeLabel: 'Código Postal', country: 'Spain' },
};

function detectDefault(): LocaleSettings {
  const tag = Localization.getLocales()[0]?.regionCode || 'IE';
  const region: Region = (['IE', 'UK', 'GB', 'US', 'CA', 'AU', 'ES'].includes(tag)
    ? (tag === 'GB' ? 'UK' : (tag as Region))
    : 'IE');
  const langTag = Localization.getLocales()[0]?.languageCode || 'en';
  const language: Language = langTag === 'ga' ? 'ga' : langTag === 'es' ? 'es' : 'en';
  const def = REGION_DEFAULTS[region];
  return { region, language, units: def.units, currency: def.currency };
}

let cached: LocaleSettings | null = null;

export async function loadLocale(): Promise<LocaleSettings> {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      cached = { ...detectDefault(), ...(JSON.parse(raw) as Partial<LocaleSettings>) };
      return cached;
    }
  } catch { /* ignore */ }
  cached = detectDefault();
  return cached;
}

export async function saveLocale(s: LocaleSettings): Promise<void> {
  cached = s;
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}

export function getPostcodeLabel(region: Region): string {
  return REGION_DEFAULTS[region].postcodeLabel;
}

export function getRegionDefaults(region: Region) {
  return REGION_DEFAULTS[region];
}

/** Used by maps.ts for region-aware geocoding. */
export async function getRegionCountryName(): Promise<string> {
  const l = await loadLocale();
  return REGION_DEFAULTS[l.region].country;
}

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  EUR: '€', GBP: '£', USD: '$', CAD: 'C$', AUD: 'A$',
};

export function formatCurrencySync(amount: number, currency: CurrencyCode): string {
  const sym = CURRENCY_SYMBOL[currency] ?? '';
  const n = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sym}${n}`;
}

/** Async helper that picks up the saved locale automatically. */
export async function formatCurrency(amount: number): Promise<string> {
  const l = await loadLocale();
  return formatCurrencySync(amount, l.currency);
}

/** Synchronous version for hot paths once locale is loaded into state. */
export function formatCurrencyWith(amount: number, locale: LocaleSettings): string {
  return formatCurrencySync(amount, locale.currency);
}

export function formatLength(meters: number, units: Units): string {
  if (units === 'imperial') {
    const feet = meters * 3.28084;
    return feet < 100 ? `${feet.toFixed(1)} ft` : `${Math.round(feet)} ft`;
  }
  return meters < 10 ? `${meters.toFixed(2)} m` : `${meters.toFixed(1)} m`;
}

export function formatArea(sqMeters: number, units: Units): string {
  if (units === 'imperial') {
    const sqft = sqMeters * 10.7639;
    return `${Math.round(sqft)} ft²`;
  }
  return `${sqMeters.toFixed(1)} m²`;
}

export function getLocaleTag(language: Language, region: Region): string {
  // BCP-47 best-effort
  const langPart = language === 'ga' ? 'ga-IE' : language === 'es' ? 'es-ES' : `en-${region === 'UK' ? 'GB' : region}`;
  return langPart;
}
