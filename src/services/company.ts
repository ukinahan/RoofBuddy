// ─── Company Profile — Configurable via Settings ────────────────────────────
//
// All fields start blank. Users configure their company details
// from the Company Profile screen on first launch.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CompanyProfile } from '../types';

const PROFILE_KEY = '@roof_inspector:company_profile';

export const DEFAULT_COMPANY: CompanyProfile = {
  name: '',
  shortName: '',
  nameLine1: '',
  nameLine2: '',
  services: '',
  address: '',
  addressLines: [],
  eircode: '',
  tel: '',
  email: '',
  website: '',
  c2Number: '',
  vatNumber: '',
  vatRate: 0.135,
  signatoryName: '',
  signatoryTitle: '',
  defaultPersonnel: '',
  depositPercent: 40,
  quoteValidDays: 30,
  logoUri: '',
};

/** Load the saved company profile, falling back to defaults for any missing fields. */
export async function loadCompanyProfile(): Promise<CompanyProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_COMPANY };
    const saved = JSON.parse(raw) as Partial<CompanyProfile>;
    return { ...DEFAULT_COMPANY, ...saved };
  } catch {
    return { ...DEFAULT_COMPANY };
  }
}

/** Persist the company profile. */
export async function saveCompanyProfile(profile: CompanyProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/** Generate terms & conditions from the profile. */
export function getTermsAndConditions(profile: CompanyProfile): string[] {
  return [
    `Deposit of ${profile.depositPercent}% required`,
    'Project is subject to re-measure upon completion',
    'Our company carries Employers & Public Liability Insurance and Contractors All Risk Policy.',
    'All our Employees are Safepass Certified',
    'Main Contractor to provide Attendance, Scaffolding, Access, Temporary Power, Parking, Hoisting and Welfare Facilities etc.',
    'Membership of CWPS – Employers Pension Fund',
    ...(profile.c2Number ? [`Our C2 Number is ${profile.c2Number}`] : []),
    `VAT (if applicable) on above is charged at ${(profile.vatRate * 100).toFixed(1)}%`,
    ...(profile.vatNumber ? [`Our VAT No. ${profile.vatNumber}`] : []),
    `This price is valid for ${profile.quoteValidDays} days`,
  ];
}

// Legacy exports for backward compatibility during migration
export const COMPANY = DEFAULT_COMPANY;
export const TERMS_AND_CONDITIONS = getTermsAndConditions(DEFAULT_COMPANY);
