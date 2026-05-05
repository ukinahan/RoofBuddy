/**
 * Server-side port of the mobile app's PDF HTML builder
 * (`mobile/src/services/report.ts`).
 *
 * Generates the *exact same* HTML the phone uses with `expo-print`, so the
 * portal can render an identical PDF via headless Chromium. Photos are
 * passed in pre-decoded as base64 data URIs (the API route fetches them
 * from Supabase Storage); the logo is also passed in as a data URI.
 *
 * NOTE: keep this file Node-only. Do NOT import expo-* / react-native.
 * If the mobile builder changes, update this file in lockstep.
 */
import type { Inspection, InspectionPhoto, DrawingPath, CompanyProfile } from './types';

// Drawing viewport that mobile photos were captured against. Mobile uses the
// device width; ~375 is the iPhone default. We fall back to this only when
// a photo doesn't carry its own `drawingViewport`.
const DEFAULT_VIEWPORT = { width: 375, height: 281 };

const SEVERITY_COLOR: Record<string, string> = {
  high: '#d32f2f',
  medium: '#f57c00',
  low: '#388e3c',
};
const SEVERITY_LABEL: Record<string, string> = {
  high: 'High — Immediate Action Required',
  medium: 'Medium — Repair Within 3-6 Months',
  low: 'Low — Monitor / Cosmetic',
};

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtMeasureLength(meters: number, units: 'metric' | 'imperial' = 'metric'): string {
  if (units === 'imperial') {
    const ft = meters * 3.28084;
    return ft >= 10 ? `${ft.toFixed(1)} ft` : `${(meters * 39.3701).toFixed(1)} in`;
  }
  return meters >= 1 ? `${meters.toFixed(2)} m` : `${(meters * 100).toFixed(0)} cm`;
}

function fmtMeasureArea(sqM: number, units: 'metric' | 'imperial' = 'metric'): string {
  if (units === 'imperial') return `${(sqM * 10.7639).toFixed(1)} ft\u00b2`;
  return `${sqM.toFixed(2)} m\u00b2`;
}

function drawingToSvgElement(
  d: DrawingPath,
  pixelsPerMeter?: number,
  units: 'metric' | 'imperial' = 'metric',
): string {
  const sw = d.strokeWidth;
  const color = d.color;
  const shape = d.shape as string;
  if (shape === 'freehand') {
    return `<path d="${d.data}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  }
  if (shape === 'rectangle') {
    const [x, y, w, h] = d.data.split(',').map(Number);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${color}" stroke-width="${sw}" fill="none"/>`;
  }
  if (shape === 'circle') {
    const [cx, cy, r] = d.data.split(',').map(Number);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${color}" stroke-width="${sw}" fill="none"/>`;
  }
  if (shape === 'arrow') {
    const [x1, y1, x2, y2] = d.data.split(',').map(Number);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(sw * 4, 14);
    const a1 = angle - Math.PI / 6;
    const a2 = angle + Math.PI / 6;
    const p1x = (x2 - headLen * Math.cos(a1)).toFixed(1);
    const p1y = (y2 - headLen * Math.sin(a1)).toFixed(1);
    const p2x = (x2 - headLen * Math.cos(a2)).toFixed(1);
    const p2y = (y2 - headLen * Math.sin(a2)).toFixed(1);
    const dStr = `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${p1x} ${p1y} M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${p2x} ${p2y}`;
    return `<path d="${dStr}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  }
  if (shape === 'line') {
    const [x1, y1, x2, y2] = d.data.split(',').map(Number);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  if (shape === 'measure-line') {
    const [x1, y1, x2, y2] = d.data.split(',').map(Number);
    const px = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const label = pixelsPerMeter && pixelsPerMeter > 0
      ? fmtMeasureLength(px / pixelsPerMeter, units)
      : `${px.toFixed(0)} px`;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 - 6;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>` +
      `<text x="${cx}" y="${cy}" font-size="14" font-weight="bold" fill="${color}" stroke="white" stroke-width="3" paint-order="stroke" text-anchor="middle">${escapeHtml(label)}</text>`;
  }
  if (shape === 'measure-area') {
    const [x, y, w, h] = d.data.split(',').map(Number);
    const label = pixelsPerMeter && pixelsPerMeter > 0
      ? fmtMeasureArea((w / pixelsPerMeter) * (h / pixelsPerMeter), units)
      : `${(w * h).toFixed(0)} px²`;
    const cx = x + w / 2;
    const cy = y + h / 2 + 4;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${color}" stroke-width="${sw}" fill="${color}" fill-opacity="0.12"/>` +
      `<text x="${cx}" y="${cy}" font-size="14" font-weight="bold" fill="${color}" stroke="white" stroke-width="3" paint-order="stroke" text-anchor="middle">${escapeHtml(label)}</text>`;
  }
  if (shape === 'calibration') {
    const [coords] = d.data.split('|');
    const [x1, y1, x2, y2] = coords.split(',').map(Number);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}" stroke-dasharray="6,4" stroke-linecap="round" opacity="0.6"/>`;
  }
  return '';
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtDateOrdinal(isoOrDate: string | Date, localeTag = 'en-IE'): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return `${ordinal(d.getDate())} ${d.toLocaleString(localeTag, { month: 'long' })} ${d.getFullYear()}`;
}

function fmtCurrency(n: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

// ─── Branded cover page (matches printed Roof Survey Report template) ────────
function buildBrandedCoverPage(opts: {
  title: string;
  dateStr: string;
  customerName: string;
  customerAddressLines: string[];
  co: CoFields;
  logoImg: string;
}): string {
  const { title, dateStr, customerName, customerAddressLines, co, logoImg } = opts;
  const customerLines = [customerName, ...customerAddressLines]
    .map((l) => `<div>${escapeHtml(l)}</div>`)
    .join('');
  const addr = co.addressLines.length ? co.addressLines : (co.address ? [co.address] : []);
  return `
  <div class="bcover">
    <div class="bcover-topband">
      <span class="bcover-topband-title">${escapeHtml(title)}</span>
      <span class="bcover-topband-date">${escapeHtml(dateStr)}</span>
    </div>
    <div class="bcover-stripes">
      <span style="background:#1565c0;"></span>
      <span style="background:#2e7d32;"></span>
      <span style="background:#ef6c00;"></span>
      <span style="background:#f9a825;"></span>
    </div>

    <div class="bcover-hero">
      <div class="bcover-logo">${logoImg}</div>
    </div>

    <div class="bcover-customer">
      ${customerLines}
    </div>

    <div class="bcover-spacer"></div>

    <div class="bcover-stripes">
      <span style="background:#1565c0;"></span>
      <span style="background:#2e7d32;"></span>
      <span style="background:#ef6c00;"></span>
      <span style="background:#f9a825;"></span>
    </div>
    <div class="bcover-footer">
      <div class="bcover-footer-col bcover-footer-left">
        <div class="bcover-footer-co">${escapeHtml(co.nameLine1)}${co.nameLine2 ? ' ' + escapeHtml(co.nameLine2) : ''}</div>
        ${co.website ? `<div>${escapeHtml(co.website)}</div>` : ''}
      </div>
      <div class="bcover-footer-divider"></div>
      <div class="bcover-footer-col bcover-footer-right">
        ${addr.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
        ${co.eircode ? `<div>${escapeHtml(co.eircode)}</div>` : ''}
        ${co.email ? `<div>${escapeHtml(co.email)}</div>` : ''}
        ${co.tel ? `<div>${escapeHtml(co.tel)}</div>` : ''}
      </div>
    </div>
  </div>`;
}

const BRANDED_COVER_CSS = `
  .bcover { position: relative; padding: 0; }
  .bcover-topband { background: #0a2a4a; color: #fff; padding: 14px 28px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; }
  .bcover-topband-date { font-weight: 600; letter-spacing: 0.5px; text-transform: none; }
  .bcover-stripes { display: flex; height: 8px; width: 100%; }
  .bcover-stripes span { flex: 1; display: block; height: 100%; }
  .bcover-hero { text-align: center; padding: 70px 40px 30px; }
  .bcover-hero .bcover-logo img { max-width: 220px; height: auto; margin: 0 auto; display: block; }
  .bcover-wordmark { font-size: 38px; font-weight: 800; color: #1a3c5e; margin-top: 14px; letter-spacing: 0.5px; }
  .bcover-customer { margin: 30px auto 0; width: 78%; min-height: 200px; border: 8px solid #0a2a4a; border-style: outset; padding: 36px 24px; text-align: center; font-size: 18px; line-height: 2.0; color: #222; font-weight: 600; box-shadow: inset 0 0 0 2px #1a3c5e, 4px 4px 10px rgba(0,0,0,0.18); }
  .bcover-spacer { min-height: 30px; }
  .bcover-footer { display: flex; justify-content: center; align-items: stretch; gap: 28px; padding: 22px 32px 32px; font-size: 15px; line-height: 1.7; color: #222; }
  .bcover-footer-col { flex: 0 1 auto; }
  .bcover-footer-left { text-align: right; }
  .bcover-footer-right { text-align: left; }
  .bcover-footer-divider { width: 2px; background: #0a2a4a; align-self: stretch; }
  .bcover-footer .bcover-footer-co { font-weight: 800; color: #0a2a4a; font-size: 17px; margin-bottom: 4px; letter-spacing: 0.3px; }
`;

// ─── CompanyProfile field expansion ──────────────────────────────────────────
//
// The mobile app stores a richer CompanyProfile in the JSONB column than the
// portal's TypeScript type lists. These fields *are* in the database; we just
// haven't surfaced them in `lib/types.ts`. We read them via `as any` and fill
// any blanks with sensible defaults so reports still render for partially
// configured profiles.

interface CoFields {
  name: string;
  shortName: string;
  nameLine1: string;
  nameLine2: string;
  services: string;
  address: string;
  addressLines: string[];
  eircode: string;
  tel: string;
  email: string;
  website: string;
  c2Number: string;
  vatNumber: string;
  vatRate: number;
  signatoryName: string;
  signatoryTitle: string;
  defaultPersonnel: string;
  depositPercent: number;
  quoteValidDays: number;
}

function expandCompanyProfile(profile: CompanyProfile | null): CoFields {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (profile ?? {}) as any;
  const name = String(p.name ?? '');
  const addressLines: string[] = Array.isArray(p.addressLines) && p.addressLines.length
    ? p.addressLines
    : (p.address ? String(p.address).split(/\r?\n|,/).map((s: string) => s.trim()).filter(Boolean) : []);
  return {
    name,
    shortName: String(p.shortName ?? name),
    nameLine1: String(p.nameLine1 ?? name),
    nameLine2: String(p.nameLine2 ?? ''),
    services: String(p.services ?? ''),
    address: String(p.address ?? addressLines.join(', ')),
    addressLines,
    eircode: String(p.eircode ?? p.postcode ?? ''),
    tel: String(p.tel ?? p.phone ?? ''),
    email: String(p.email ?? ''),
    website: String(p.website ?? ''),
    c2Number: String(p.c2Number ?? ''),
    vatNumber: String(p.vatNumber ?? ''),
    vatRate: typeof p.vatRate === 'number' ? p.vatRate : 0.135,
    signatoryName: String(p.signatoryName ?? ''),
    signatoryTitle: String(p.signatoryTitle ?? ''),
    defaultPersonnel: String(p.defaultPersonnel ?? ''),
    depositPercent: typeof p.depositPercent === 'number' ? p.depositPercent : 40,
    quoteValidDays: typeof p.quoteValidDays === 'number' ? p.quoteValidDays : 30,
  };
}

function getTermsAndConditions(co: CoFields): string[] {
  return [
    `Deposit of ${co.depositPercent}% required`,
    'Project is subject to re-measure upon completion',
    'Our company carries Employers & Public Liability Insurance and Contractors All Risk Policy.',
    'All our Employees are Safepass Certified',
    'Main Contractor to provide Attendance, Scaffolding, Access, Temporary Power, Parking, Hoisting and Welfare Facilities etc.',
    'Membership of CWPS – Employers Pension Fund',
    ...(co.c2Number ? [`Our C2 Number is ${co.c2Number}`] : []),
    `VAT (if applicable) on above is charged at ${(co.vatRate * 100).toFixed(1)}%`,
    ...(co.vatNumber ? [`Our VAT No. ${co.vatNumber}`] : []),
    `This price is valid for ${co.quoteValidDays} days`,
  ];
}

// Damage summary — minimal port (mobile uses richer presets). Returns a
// human-readable list of distinct damage tags found across photos.
function summariseDamage(photos: InspectionPhoto[]): string {
  const tags = new Set<string>();
  for (const p of photos) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dt = (p as any).damageTags;
    if (Array.isArray(dt)) for (const t of dt) if (t) tags.add(String(t));
  }
  return [...tags].join(', ');
}

// ─── Quote line item normalisation ───────────────────────────────────────────
//
// Mobile stores quote.lineItems = [{ qty: string, description, totalPrice }].
// Portal type uses quoteItems = [{ qty: number, unitPrice }]. The DB row
// originates from mobile, so prefer the mobile shape when present.

interface QuoteLine { qty: string; description: string; totalPrice: number }

function normaliseQuoteLines(inspection: Inspection): QuoteLine[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insp = inspection as any;
  if (insp.quote?.lineItems?.length) {
    return insp.quote.lineItems.map((li: { qty: string | number; description: string; totalPrice: number }) => ({
      qty: String(li.qty ?? ''),
      description: String(li.description ?? ''),
      totalPrice: Number(li.totalPrice ?? 0),
    }));
  }
  if (Array.isArray(inspection.quoteItems)) {
    return inspection.quoteItems.map((it) => ({
      qty: String(it.qty ?? ''),
      description: it.description ?? '',
      totalPrice: (it.qty ?? 0) * (it.unitPrice ?? 0),
    }));
  }
  return [];
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface BuildOptions {
  /** Map of photo id → `data:image/jpeg;base64,...` URI. Missing entries render as a placeholder. */
  photoDataUris: Map<string, string>;
  /** Optional company logo as a data: URI. */
  logoDataUri?: string | null;
  /** Optional satellite map image data URI. */
  satelliteDataUri?: string | null;
  /** Locale tag for date formatting (default en-IE). */
  localeTag?: string;
  /** Currency code for quote totals (default EUR). */
  currency?: string;
  /** 'metric' or 'imperial' for measurement labels. */
  units?: 'metric' | 'imperial';
}

// ─── Inspection report HTML ──────────────────────────────────────────────────

export function buildInspectionHtml(
  inspection: Inspection,
  profile: CompanyProfile | null,
  opts: BuildOptions,
): string {
  const co = expandCompanyProfile(profile);
  const localeTag = opts.localeTag ?? 'en-IE';
  const units = opts.units ?? 'metric';
  const logoImg = opts.logoDataUri
    ? `<img src="${opts.logoDataUri}" style="width:100%;max-width:300px;height:auto;display:block;margin-bottom:0;"/>`
    : `<div style="font-size:24px;font-weight:900;color:#1a3c5e;line-height:1.2;margin-bottom:0;">${escapeHtml(co.nameLine1)}<br/><span style="font-size:14px;letter-spacing:2px;">${escapeHtml(co.nameLine2)}</span></div>`;

  const surveyDateStr = fmtDateOrdinal(inspection.date, localeTag);
  const reportDateStr = fmtDateOrdinal(new Date(), localeTag);
  const custLines = (inspection.address || '').split(',').map((l) => l.trim()).filter(Boolean);

  const coverPage = buildBrandedCoverPage({
    title: 'Roof Survey Report',
    dateStr: reportDateStr,
    customerName: inspection.customerName,
    customerAddressLines: custLines,
    co,
    logoImg,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const i = inspection as any;
  const ovRows: Array<[string, string]> = [
    ['Project:', `"${escapeHtml(i.ref || inspection.customerName)}"`],
    ['Address:', escapeHtml(inspection.address)],
    ['Commissioned by:', escapeHtml(inspection.customerName)],
    ['Survey Completed:', surveyDateStr],
    ['Conditions:', escapeHtml(i.conditions || '')],
    ['Scope of works:', escapeHtml(i.scopeOfWorks || 'Roof Survey')],
    ['Personnel:', escapeHtml(inspection.inspectorName || co.defaultPersonnel)],
    ['Overview', escapeHtml(i.overview || inspection.notes || '')],
    ['Report Date:', reportDateStr],
    ['Report No:', escapeHtml(i.reportNo || '01')],
  ];

  const damageSummary = summariseDamage(inspection.photos);

  const overviewPage = `
  <div class="page">
    <div class="page-inner">
      <h2 class="sec-heading">Project Overview</h2>
      <table class="ov-table">
        ${ovRows.map(([lbl, val]) => `<tr><td class="ov-lbl">${lbl}</td><td class="ov-val"><strong>${val}</strong></td></tr>`).join('')}
      </table>
      ${damageSummary
        ? `<div style="margin-top:18px;padding:14px 16px;background:#fff5f0;border-left:4px solid #c0392b;border-radius:4px;">
            <div style="font-size:11px;font-weight:700;color:#c0392b;letter-spacing:1px;margin-bottom:6px;">DAMAGE FOUND</div>
            <div style="font-size:13px;color:#333;line-height:18px;">${escapeHtml(damageSummary)}</div>
          </div>`
        : ''}
      ${opts.satelliteDataUri ? `
      <div class="map-section">
        <div class="map-label">Satellite View</div>
        <img src="${opts.satelliteDataUri}" class="map-img"/>
      </div>` : ''}
    </div>
  </div>`;

  const buildPhotoBlock = (photo: InspectionPhoto, picNum: number, uri: string | undefined): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ph = photo as any;
    const severity = ph.severity || 'none';
    const severityColor = SEVERITY_COLOR[severity] || '';
    const severityLabel = SEVERITY_LABEL[severity] || '';

    const drawings = photo.drawings ?? [];
    const vp = photo.drawingViewport ?? DEFAULT_VIEWPORT;
    let drawingSvg = '';
    if (drawings.length > 0) {
      const svgElements = drawings.map((d) => drawingToSvgElement(d, photo.pixelsPerMeter, units)).join('');
      drawingSvg = `<svg class="drawing-overlay" viewBox="0 0 ${vp.width} ${vp.height}" preserveAspectRatio="xMidYMid meet">${svgElements}</svg>`;
    }

    return `
      <div class="photo-block">
        <h2 class="photo-title">Photo ${picNum}</h2>
        <p class="photo-meta">Captured: ${new Date(photo.takenAt).toLocaleString(localeTag)}</p>
        <div class="photo-wrap">
          ${uri
            ? `<div class="pic-container"><img src="${uri}" class="pic-img"/>${drawingSvg}</div>`
            : `<div class="pic-missing">No image available</div>`}
        </div>
        ${severity !== 'none' ? `
        <div class="severity-badge" style="border-left: 4px solid ${severityColor}; padding: 8px 14px; margin-bottom: 12px; background: ${severityColor}11;">
          <span style="color:${severityColor}; font-weight:700; font-size:13px;">Severity: ${severityLabel}</span>
        </div>` : ''}
        ${photo.notes ? `
        <div class="notes-box">
          <strong>Inspector Notes:</strong><br/>${escapeHtml(photo.notes)}
        </div>` : ''}
      </div>`;
  };

  const photoBlocks = inspection.photos
    .map((p, idx) => buildPhotoBlock(p, idx + 1, opts.photoDataUris.get(p.id)))
    .join('');

  const cost = Number(i.costOfRepairs || 0);
  const hasConcl = !!(i.conclusion || cost > 0);
  const fmtMoney = (n: number) => fmtCurrency(n, opts.currency ?? 'EUR');
  let conclusionBlock = '';
  if (hasConcl) {
    const vat = cost * co.vatRate;
    const total = cost + vat;
    conclusionBlock = `
      <div class="conclusion-block">
        ${i.conclusion ? `<h2 class="sec-heading">Conclusion</h2><p class="concl-text">${escapeHtml(i.conclusion)}</p>` : ''}
        ${cost > 0 ? `<h2 class="sec-heading" style="margin-top:24px;">Cost of Repairs</h2><p class="cost-text">${fmtMoney(cost)} Plus VAT @ ${(co.vatRate * 100).toFixed(1)}% = ${fmtMoney(total)}</p>` : ''}
      </div>`;
  }

  const photoPageHtmlArr: string[] = [];
  if (photoBlocks || conclusionBlock) {
    photoPageHtmlArr.push(`
    <div class="page">
      <div class="page-inner">
        ${photoBlocks}
        ${conclusionBlock}
      </div>
    </div>`);
  }
  const conclusionPage = '';

  const css = `<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #222; }
    ${BRANDED_COVER_CSS}
    .page { page-break-before: always; }
    .page-inner { padding: 20px 28px 10px; }
    .sec-heading { font-size: 17px; font-weight: 700; text-align: center; text-decoration: underline; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 24px; }
    .ov-table { width: 100%; border-collapse: collapse; }
    .ov-lbl { width: 190px; padding: 14px 20px 14px 10px; text-align: right; text-decoration: underline; font-weight: 500; background: #e8f0dc; color: #333; vertical-align: middle; border-bottom: 1px solid #d4e4c4; }
    .ov-val { padding: 14px 10px; font-size: 14px; vertical-align: middle; border-bottom: 1px solid #e8e8e8; }
    .photo-title { font-size: 16px; font-weight: 700; color: #1a3c5e; margin-bottom: 3px; }
    .photo-meta { font-size: 11px; color: #666; margin-bottom: 10px; }
    .photo-block { page-break-inside: avoid; break-inside: avoid; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #e8e8e8; }
    .photo-block:last-child { border-bottom: none; margin-bottom: 0; }
    .conclusion-block { page-break-inside: avoid; break-inside: avoid; margin-top: 24px; padding-top: 18px; border-top: 1px solid #ccc; }
    .photo-wrap { margin-bottom: 16px; }
    .pic-container { position: relative; width: 80%; margin: 0 auto; }
    .pic-img { display: block; width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px; box-shadow: 2px 2px 6px rgba(0,0,0,0.15); }
    .drawing-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    .pic-missing { color: #ccc; padding: 60px 10px; font-size: 13px; font-style: italic; text-align: center; background: #fafafa; }
    .notes-box { background: #f5f5f5; border-left: 4px solid #1a3c5e; padding: 10px 14px; margin-bottom: 16px; border-radius: 0 6px 6px 0; font-size: 13px; }
    .concl-text { font-size: 16px; font-weight: 700; line-height: 1.8; margin: 16px 0 24px; }
    .cost-text { font-size: 22px; font-weight: 700; margin-top: 16px; }
    .map-section { margin-top: 24px; }
    .map-label { font-size: 11px; font-weight: 700; color: #555; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 6px; }
    .map-img { width: 100%; max-height: 340px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px; display: block; }
  </style>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>${css}</head><body>${coverPage}${overviewPage}${photoPageHtmlArr.join('')}${conclusionPage}</body></html>`;
}

// ─── Quote HTML (cover + cover letter + quote table + T&Cs) ──────────────────

export function buildQuoteHtml(
  inspection: Inspection,
  profile: CompanyProfile | null,
  opts: BuildOptions,
): string {
  const co = expandCompanyProfile(profile);
  const localeTag = opts.localeTag ?? 'en-IE';
  const fmtMoney = (n: number) => fmtCurrency(n, opts.currency ?? 'EUR');
  const tAndC = getTermsAndConditions(co);
  const items = normaliseQuoteLines(inspection);
  const subTotal = items.reduce((s, it) => s + it.totalPrice, 0);
  const vat = subTotal * co.vatRate;
  const grandTotal = subTotal + vat;

  const dateFormatted = fmtDateOrdinal(inspection.date, localeTag);
  const todayFormatted = fmtDateOrdinal(new Date(), localeTag);

  const logoHtml = opts.logoDataUri
    ? `<img src="${opts.logoDataUri}" style="max-width:220px;height:auto;display:block;margin:0 auto;"/>`
    : `<div style="font-size:20px;font-weight:900;color:#1a3c5e;">${escapeHtml(co.nameLine1)}<br/><span style="font-size:12px;letter-spacing:2px;">${escapeHtml(co.nameLine2)}</span></div>`;

  const quoteAddressLines = (inspection.address || '').split(',').map((l) => l.trim()).filter(Boolean);

  const brandedCover = buildBrandedCoverPage({
    title: 'Quotation',
    dateStr: todayFormatted,
    customerName: inspection.customerName,
    customerAddressLines: quoteAddressLines,
    co,
    logoImg: logoHtml,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = String((inspection as any).ref ?? '');

  const coverPage = `
  <div class="cover-page">
    <div class="company-header">
      ${logoHtml}
      <div class="company-services">${escapeHtml(co.services)}</div>
      <div class="company-contact">${escapeHtml(co.address)} &nbsp;&nbsp; Tel: ${co.tel} &nbsp;&nbsp; ${co.email}</div>
    </div>

    <h1 class="quotation-title">QUOTATION</h1>
    <p class="letter-date">${dateFormatted}</p>

    <div class="letter-address">
      <p>${escapeHtml(inspection.customerName)}</p>
      <p>${escapeHtml(inspection.address)}</p>
    </div>

    <p class="letter-ref"><strong>Ref: ${escapeHtml(ref)}</strong></p>
    <p class="letter-salutation">Dear ${escapeHtml(inspection.customerName)}</p>
    <p class="letter-body">Please now find attached our quotation for the works on ${escapeHtml(ref || 'the above property')}.</p>
    <p class="letter-body">If you have any queries please don't hesitate to contact us.</p>
    <p class="letter-sign">Yours sincerely<br/>${escapeHtml(co.shortName)}</p>

    <div class="signature-block">
      <div class="signature-line"></div>
      <p class="signatory-name">${escapeHtml(co.signatoryName)}</p>
      <p class="signatory-title">${escapeHtml(co.signatoryTitle)}</p>
    </div>
  </div>`;

  const lineRows = items.map((item) => `
    <tr>
      <td class="qty-cell">${escapeHtml(item.qty)}</td>
      <td class="desc-cell">${escapeHtml(item.description).replace(/\n/g, '<br/>')}</td>
      <td class="price-cell">${item.totalPrice > 0 ? fmtMoney(item.totalPrice) : ''}</td>
    </tr>`).join('');

  const quotePage = `
  <div class="page quote-page">
    <div class="quote-header">
      <h2 class="quote-for">Quotation for ${escapeHtml(inspection.customerName)}</h2>
      <p class="quote-ref">Ref: ${escapeHtml(ref)}</p>
    </div>

    <table class="quote-table">
      <thead>
        <tr>
          <th class="qty-cell">Qty</th>
          <th class="desc-cell">Description</th>
          <th class="price-cell">Total</th>
        </tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>

    <table class="totals-table">
      <tr><td class="totals-label">Sub Total</td><td class="totals-value">${fmtMoney(subTotal)}</td></tr>
      <tr><td class="totals-label">VAT @ ${(co.vatRate * 100).toFixed(1)}%</td><td class="totals-value">${fmtMoney(vat)}</td></tr>
      <tr class="grand-total-row"><td class="totals-label">Grand Total</td><td class="totals-value">${fmtMoney(grandTotal)}</td></tr>
    </table>

    <div class="terms-section">
      <p class="terms-title"><strong>Terms &amp; Conditions</strong></p>
      <ul class="terms-list">
        ${tAndC.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
      </ul>
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #222; font-size: 13px; }
    ${BRANDED_COVER_CSS}

    .cover-page { padding: 40px 44px; page-break-after: always; }
    .quote-page-inner { padding: 40px 44px; }

    .company-header { text-align: center; margin-bottom: 32px; border-bottom: 1px solid #ddd; padding-bottom: 20px; }
    .company-services { font-size: 11px; color: #c8941a; margin-top: 8px; letter-spacing: 0.3px; }
    .company-contact { font-size: 11px; color: #555; margin-top: 4px; }
    .quotation-title { font-size: 20px; font-weight: 700; text-align: center; margin: 28px 0 24px; letter-spacing: 2px; }
    .letter-date { font-size: 13px; margin-bottom: 20px; }
    .letter-address { margin-bottom: 20px; font-size: 13px; line-height: 1.6; }
    .letter-ref { font-size: 15px; color: #c8001a; margin-bottom: 20px; text-align: center; }
    .letter-salutation { font-size: 13px; margin-bottom: 12px; }
    .letter-body { font-size: 13px; margin-bottom: 12px; line-height: 1.6; }
    .letter-sign { font-size: 13px; margin-top: 28px; margin-bottom: 32px; line-height: 1.8; }
    .signature-block { margin-top: 8px; }
    .signature-line { width: 180px; border-top: 1px solid #333; margin-bottom: 8px; }
    .signatory-name { font-size: 13px; font-weight: 600; }
    .signatory-title { font-size: 13px; color: #555; }

    .quote-header { margin-bottom: 24px; }
    .quote-for { font-size: 18px; font-weight: 700; text-align: center; }
    .quote-ref { font-size: 14px; font-weight: 700; color: #c8001a; text-align: center; margin-top: 4px; }
    .quote-table { width: 100%; border-collapse: collapse; border: 1px solid #333; margin-bottom: 0; }
    .quote-table th { background: #f5f5f5; padding: 8px 10px; font-size: 12px; font-weight: 700; border: 1px solid #333; }
    .quote-table td { padding: 10px; border: 1px solid #ccc; font-size: 12px; vertical-align: top; line-height: 1.6; }
    .qty-cell { width: 80px; }
    .price-cell { width: 100px; text-align: right; font-weight: 600; }
    .totals-table { width: 100%; border-collapse: collapse; border: 1px solid #333; border-top: none; }
    .totals-table tr td { padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #ddd; }
    .totals-label { font-weight: 600; }
    .totals-value { text-align: right; font-weight: 600; }
    .grand-total-row td { font-weight: 700; font-size: 14px; border-top: 2px solid #333; border-bottom: 2px solid #333; }
    .terms-section { margin-top: 28px; }
    .terms-title { font-size: 13px; margin-bottom: 8px; }
    .terms-list { padding-left: 20px; }
    .terms-list li { font-size: 12px; color: #444; margin-bottom: 4px; line-height: 1.5; }
  </style>
</head>
<body>
  ${brandedCover}
  ${coverPage}
  <div class="quote-page-inner">${quotePage}</div>
</body>
</html>`;
}
