// ─── A&A Quinn Roofing Solutions — Company Constants ─────────────────────────
//
// LOGO: Save the company logo JPEG to assets/company-logo.jpg
// The PDF will automatically embed it.

export const COMPANY = {
  name: 'A&A Quinn Roofing Solutions Limited',
  shortName: 'A&A Quinn Roofing Solutions',
  nameLine1: 'A&A Quinn Roofing',
  nameLine2: 'Solutions Ltd.',
  services: 'Copper Roofing | Zinc Roofing | PVC Roofing | Aluminium Roofing | Torch-On Systems',
  address: 'Newcastle, Crossabeg, Co. Wexford',
  addressLines: ['Newcastle', 'Crossabeg', 'Wexford'],
  eircode: 'W35 Y567',
  tel: '053 9128888',
  telCompact: '0539128888',
  email: 'info@quinnroofing.ie',
  website: 'www.quinnroofing.ie',
  c2Number: '425339904',
  vatNumber: 'IE9736299',
  vatRate: 0.135,                        // 13.5% — do not change
  signatoryName: 'Anthony Quinn',
  signatoryTitle: 'Managing Director',
  defaultPersonnel: 'Anthony Quinn - 086-8122692',
  depositPercent: 40,
  quoteValidDays: 30,
};

export const TERMS_AND_CONDITIONS: string[] = [
  'Deposit of 40% required',
  'Project is subject to re-measure upon completion',
  'Our company carries Employers & Public Liability Insurance and Contractors All Risk Policy.',
  'All our Employees are Safepass Certified',
  'Main Contractor to provide Attendance, Scaffolding, Access, Temporary Power, Parking, Hoisting and Welfare Facilities etc.',
  'Membership of CWPS – Employers Pension Fund',
  `Our C2 Number is ${COMPANY.c2Number}`,
  `VAT (if applicable) on above is charged at ${(COMPANY.vatRate * 100).toFixed(1)}%`,
  `Our VAT No. ${COMPANY.vatNumber}`,
  `This price is valid for ${COMPANY.quoteValidDays} days`,
];
