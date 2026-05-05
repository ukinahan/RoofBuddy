/**
 * Generates professional PDF documents from an Inspection:
 *   1. Inspection report (photos + annotations)
 *   2. Customer quotation (cover letter + quote table + T&Cs)
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Asset } from 'expo-asset';
import { Dimensions } from 'react-native';
import { Inspection, InspectionPhoto, DrawingPath, CompanyProfile } from '../types';
import { loadCompanyProfile, getTermsAndConditions } from './company';
import { addressToSatelliteUri } from './maps';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { resolvePhotoUri } from './photoUri';
import { loadLocale, formatCurrencyWith, getLocaleTag } from './locale';
import { summariseDamage } from './damagePresets';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;

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
  return text
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

/**
 * Convert a local file URI to an inline base64 data URI so the PDF renderer
 * can embed the image without needing network access.
 *
 * Photos are downscaled to a max dimension of 1600px and re-compressed at
 * quality 0.7 before embedding. This keeps the resulting PDF small enough to
 * email (typical ~250-400 KB per photo vs. 2-4 MB straight from the camera)
 * and avoids out-of-memory crashes on older devices when many photos are
 * embedded into a single document.
 */
async function toDataUri(photo: InspectionPhoto): Promise<string> {
  // 1. Try the local file (resized + re-encoded for size).
  try {
    const resolved = resolvePhotoUri(photo.uri) || photo.uri;
    const info = await FileSystem.getInfoAsync(resolved).catch(() => null);
    if (info?.exists) {
      let sourceUri = resolved;
      try {
        const result = await ImageManipulator.manipulateAsync(
          resolved,
          [{ resize: { width: 1600 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        sourceUri = result.uri;
      } catch {
        // If manipulation fails (e.g. unsupported format), fall back to the original file.
      }
      const base64 = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64}`;
    }
  } catch {
    // fall through to cloud fallback
  }

  // 2. Local file missing (e.g. iOS container UUID rotated, or photo was
  //    synced from another device but not yet pulled). Pull bytes directly
  //    from Supabase Storage so the report still has the image even if a
  //    full sync hasn't been run.
  if (!isSupabaseConfigured()) return '';
  try {
    const sb = getSupabase();
    if (!sb) return '';
    const { data: userData } = await sb.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return '';
    const { data, error } = await sb.storage
      .from('photos')
      .download(`${userId}/${photo.id}.jpg`);
    if (error || !data) return '';
    // Read the blob as a data URL and return the data: portion directly —
    // avoids decoding/re-encoding the bytes.
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve('');
      reader.onloadend = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(data);
    });
  } catch {
    return '';
  }
}

function drawingToSvgElement(
  d: DrawingPath,
  pixelsPerMeter?: number,
  units: 'metric' | 'imperial' = 'metric',
): string {
  const sw = d.strokeWidth;
  const color = d.color;
  if (d.shape === 'freehand') {
    return `<path d="${d.data}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  }
  if (d.shape === 'rectangle') {
    const [x, y, w, h] = d.data.split(',').map(Number);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${color}" stroke-width="${sw}" fill="none"/>`;
  }
  if (d.shape === 'circle') {
    const [cx, cy, r] = d.data.split(',').map(Number);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${color}" stroke-width="${sw}" fill="none"/>`;
  }
  if (d.shape === 'arrow') {
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
  if (d.shape === 'measure-line') {
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
  if (d.shape === 'measure-area') {
    const [x, y, w, h] = d.data.split(',').map(Number);
    const label = pixelsPerMeter && pixelsPerMeter > 0
      ? fmtMeasureArea((w / pixelsPerMeter) * (h / pixelsPerMeter), units)
      : `${(w * h).toFixed(0)} px²`;
    const cx = x + w / 2;
    const cy = y + h / 2 + 4;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${color}" stroke-width="${sw}" fill="${color}" fill-opacity="0.12"/>` +
      `<text x="${cx}" y="${cy}" font-size="14" font-weight="bold" fill="${color}" stroke="white" stroke-width="3" paint-order="stroke" text-anchor="middle">${escapeHtml(label)}</text>`;
  }
  if (d.shape === 'calibration') {
    // Render lightly so it doesn't dominate the report.
    const [coords] = d.data.split('|');
    const [x1, y1, x2, y2] = coords.split(',').map(Number);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}" stroke-dasharray="6,4" stroke-linecap="round" opacity="0.6"/>`;
  }
  return '';
}

// ─── HTML Builder ────────────────────────────────────────────────────────────

// Cache the brand logo data URI between renders within a single app session.
let brandLogoDataUriCache: string | null = null;

/** Loads the bundled Roof Report brand logo (assets/icon.png) as a data URI
 *  so it can be embedded directly into the printable HTML. */
async function getBrandLogoDataUri(): Promise<string> {
  if (brandLogoDataUriCache) return brandLogoDataUriCache;
  try {
    const asset = Asset.fromModule(require('../../assets/icon.png'));
    await asset.downloadAsync();
    const localUri = asset.localUri || asset.uri;
    if (!localUri) return '';
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    brandLogoDataUriCache = `data:image/png;base64,${base64}`;
    return brandLogoDataUriCache;
  } catch {
    return '';
  }
}

async function getLogoDataUri(customLogoUri?: string): Promise<string> {
  try {
    if (customLogoUri) {
      // Already an inline data URI (the new storage format) — use as-is.
      if (customLogoUri.startsWith('data:')) return customLogoUri;
      const resolved = resolvePhotoUri(customLogoUri) || customLogoUri;
      const info = await FileSystem.getInfoAsync(resolved);
      if (info.exists) {
        const base64 = await FileSystem.readAsStringAsync(resolved, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Sniff the actual image type from the leading base64 magic bytes.
        // ImagePicker often returns JPEG even when we save with a .png name,
        // and a wrong MIME type makes Chrome / expo-print drop the image
        // silently in the rendered PDF.
        const head = base64.substring(0, 16);
        let mime = 'image/png';
        if (head.startsWith('/9j/')) mime = 'image/jpeg';
        else if (head.startsWith('R0lG')) mime = 'image/gif';
        else if (head.startsWith('UklGR')) mime = 'image/webp';
        else if (head.startsWith('PHN2Zy') || head.startsWith('PD94bW')) mime = 'image/svg+xml';
        else if (head.startsWith('iVBORw')) mime = 'image/png';
        else {
          // Fall back to extension if magic bytes are unrecognised.
          const lower = resolved.toLowerCase();
          if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
          else if (lower.endsWith('.webp')) mime = 'image/webp';
          else if (lower.endsWith('.svg')) mime = 'image/svg+xml';
        }
        return `data:${mime};base64,${base64}`;
      }
    }
    return '';
  } catch {
    return '';
  }
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

// ─── Branded cover page (shared by inspection report and quote) ──────────────
//
// Renders a standalone front page that matches the printed Roof Survey Report
// template:
//
//   ┌──────────────────────────────────────────────────────┐
//   │ [navy band]  TITLE                        TODAY      │
//   │ [blue][green][orange][yellow] stripe                 │
//   │                                                      │
//   │                  [logo]                              │
//   │                Roof Report                           │
//   │                                                      │
//   │      ┌──────── red-bordered ────────┐                │
//   │      │   Customer name              │                │
//   │      │   Customer address           │                │
//   │      └──────────────────────────────┘                │
//   │                                                      │
//   │ [blue][green][orange][yellow] stripe                 │
//   │              Company name / address                  │
//   │              www / email / tel                       │
//   └──────────────────────────────────────────────────────┘
function buildBrandedCoverPage(opts: {
  title: string;
  dateStr: string;
  customerName: string;
  customerAddressLines: string[];
  co: CompanyProfile;
  logoImg: string;
  brandLogoImg: string;
}): string {
  const { title, dateStr, customerName, customerAddressLines, co, logoImg, brandLogoImg } = opts;
  const customerLines = [customerName, ...customerAddressLines]
    .map((l) => `<div>${escapeHtml(l)}</div>`)
    .join('');
  // Brand logo (Roof Report) goes at the top of every cover; the company's
  // own logo (if uploaded) is shown smaller in the bottom footer block. The
  // company name renders below the brand logo as a centred sub-heading.
  const companyHeader = co.nameLine1
    ? `<div class="bcover-co-name">${escapeHtml(co.nameLine1)}${co.nameLine2 ? ' ' + escapeHtml(co.nameLine2) : ''}</div>`
    : '';
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
      <div class="bcover-logo">${brandLogoImg}</div>
      ${companyHeader}
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
        ${co.addressLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
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
  .bcover-topband-title { }
  .bcover-topband-date { font-weight: 600; letter-spacing: 0.5px; text-transform: none; }
  .bcover-stripes { display: flex; height: 8px; width: 100%; }
  .bcover-stripes span { flex: 1; display: block; height: 100%; }
  .bcover-hero { text-align: center; padding: 70px 40px 30px; }
  .bcover-hero .bcover-logo img { max-width: 280px; height: auto; margin: 0 auto; display: block; }
  .bcover-co-name { font-size: 22px; font-weight: 800; color: #0a2a4a; margin-top: 18px; letter-spacing: 0.3px; }
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

async function buildHtml(inspection: Inspection): Promise<string> {
  const co = await loadCompanyProfile();
  const locale = await loadLocale();
  const localeTag = getLocaleTag(locale.language, locale.region);
  const fmtMoney = (n: number) => formatCurrencyWith(n, locale);
  const [logoUri, satelliteUri, brandLogoUri] = await Promise.all([
    getLogoDataUri(co.logoUri),
    addressToSatelliteUri(inspection.address),
    getBrandLogoDataUri(),
  ]);
  const logoImg = logoUri
    ? `<img src="${logoUri}" style="width:100%;max-width:300px;height:auto;display:block;margin-bottom:0;"/>`
    : `<div style="font-size:24px;font-weight:900;color:#1a3c5e;line-height:1.2;margin-bottom:0;">${escapeHtml(co.nameLine1)}<br/><span style="font-size:14px;letter-spacing:2px;">${escapeHtml(co.nameLine2)}</span></div>`;
  const brandLogoImg = brandLogoUri
    ? `<img src="${brandLogoUri}" style="max-width:280px;height:auto;display:block;margin:0 auto;"/>`
    : `<div class="bcover-wordmark">Roof Report</div>`;

  const surveyDateStr = fmtDateOrdinal(inspection.date, localeTag);
  const reportDateStr = fmtDateOrdinal(new Date(), localeTag);
  const year = new Date(inspection.date).getFullYear();
  const photoDataUris = await Promise.all(inspection.photos.map((p) => toDataUri(p)));

  const custLines = inspection.address.split(',').map((l) => l.trim()).filter(Boolean);

  // ── Page 1: Branded cover ──────────────────────────────────────────────────
  const coverPage = buildBrandedCoverPage({
    title: 'Roof Survey Report',
    dateStr: reportDateStr,
    customerName: inspection.customerName,
    customerAddressLines: custLines,
    co,
    logoImg,
    brandLogoImg,
  });
  // (year retained for backwards-compat with any future references)
  void year;

  // ── Page 2: Project Overview ───────────────────────────────────────────────
  const ovRows: Array<[string, string]> = [
    ['Project:', `"${escapeHtml(inspection.ref || inspection.customerName)}"`],
    ['Address:', escapeHtml(inspection.address)],
    ['Commissioned by:', escapeHtml(inspection.customerName)],
    ['Survey Completed:', surveyDateStr],
    ['Conditions:', escapeHtml((inspection as any).conditions || '')],
    ['Scope of works:', escapeHtml((inspection as any).scopeOfWorks || 'Roof Survey')],
    ['Personnel:', escapeHtml(inspection.inspectorName || co.defaultPersonnel)],
    ['Overview', escapeHtml((inspection as any).overview || inspection.notes || '')],
    ['Report Date:', reportDateStr],
    ['Report No:', escapeHtml((inspection as any).reportNo || '01')],
  ];

  const overviewPage = `
  <div class="page">
    <div class="page-inner">
      <h2 class="sec-heading">Project Overview</h2>
      <table class="ov-table">
        ${ovRows.map(([lbl, val]) => `<tr><td class="ov-lbl">${lbl}</td><td class="ov-val"><strong>${val}</strong></td></tr>`).join('')}
      </table>
      ${(() => {
        const damageSummary = summariseDamage(inspection.photos);
        return damageSummary
          ? `<div style="margin-top:18px;padding:14px 16px;background:#fff5f0;border-left:4px solid #c0392b;border-radius:4px;">
              <div style="font-size:11px;font-weight:700;color:#c0392b;letter-spacing:1px;margin-bottom:6px;">DAMAGE FOUND</div>
              <div style="font-size:13px;color:#333;line-height:18px;">${escapeHtml(damageSummary)}</div>
            </div>`
          : '';
      })()}
      ${satelliteUri ? `
      <div class="map-section">
        <div class="map-label">Satellite View</div>
        <img src="${satelliteUri}" class="map-img"/>
      </div>` : ''}
    </div>
  </div>`;

  // ── Pages 3+: Photos in continuous flow ───────────────────────────────────
  // Each photo block uses `page-break-inside: avoid` so the browser packs
  // them as densely as possible — odd photo counts no longer leave a half
  // empty trailing page, and the conclusion can flow onto whatever space
  // remains after the last photo.
  const photoPageHtmlArr: string[] = [];

  const buildPhotoBlock = (photo: typeof inspection.photos[0], picNum: number, uri: string | null): string => {
    const severity = (photo as any).severity || 'none';
    const severityColor = SEVERITY_COLOR[severity] || '';
    const severityLabel = SEVERITY_LABEL[severity] || '';

    // Build SVG overlay for drawings.
    // viewBox MUST match the canvas the drawings were made against (drawingViewport),
    // NOT the resized photo dimensions. preserveAspectRatio="xMidYMid meet" keeps
    // the SVG layer aligned with the photo even when the container aspect differs slightly.
    const drawings = photo.drawings ?? [];
    const vp = photo.drawingViewport ?? { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75 };
    let drawingSvg = '';
    if (drawings.length > 0) {
      const svgElements = drawings
        .map((d) => drawingToSvgElement(d, photo.pixelsPerMeter, locale.units))
        .join('');
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
    .map((p, i) => buildPhotoBlock(p, i + 1, photoDataUris[i]))
    .join('');

  // ── Conclusion (rendered inline at the end of the photo flow) ─────────────
  const cost = (inspection as any).costOfRepairs || 0;
  const hasConcl = !!((inspection as any).conclusion || cost > 0);
  let conclusionBlock = '';
  if (hasConcl) {
    const vat = cost * co.vatRate;
    const total = cost + vat;
    const fe = (n: number) => fmtMoney(n);
    conclusionBlock = `
      <div class="conclusion-block">
        ${(inspection as any).conclusion ? `<h2 class="sec-heading">Conclusion</h2><p class="concl-text">${escapeHtml((inspection as any).conclusion)}</p>` : ''}
        ${cost > 0 ? `<h2 class="sec-heading" style="margin-top:24px;">Cost of Repairs</h2><p class="cost-text">${fe(cost)} Plus VAT @ ${(co.vatRate * 100).toFixed(1)}% = ${fe(total)}</p>` : ''}
      </div>`;
  }

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

  // ── CSS ────────────────────────────────────────────────────────────────────
  const css = `<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #222; }
    ${BRANDED_COVER_CSS}
    .page-cover { display: table; width: 100%; page-break-after: always; }
    .cover-left { display: table-cell; width: 62%; vertical-align: top; background: #fff; padding-bottom: 40px; }
    .cover-logo-wrap { padding: 40px 36px 0; }
    .cover-right { display: table-cell; width: 38%; background: #acc28a; padding: 32px 22px; vertical-align: top; border-left: 3px solid #8aac68; }
    .cover-title-band { background: #111; color: white; padding: 16px 36px; font-size: 22px; font-weight: 700; margin-top: 14px; }
    .customer-box { padding: 0 36px; text-align: left; margin-top: 280px; }
    .customer-box div { font-size: 18px; line-height: 2.1; font-weight: 700; color: #1a3c5e; }
    .cover-year { font-size: 28px; font-weight: 600; color: #1a3c5e; text-align: right; }
    .cover-inspector { font-size: 14px; color: #1a3c5e; opacity: 0.75; margin-bottom: 8px; }
    .cover-co { font-size: 20px; color: #1a3c5e; line-height: 2.0; }
    .cover-link { font-size: 13px; color: #1a3c5e; text-decoration: underline; }
    .cover-date { font-size: 14px; text-align: right; color: #1a3c5e; font-weight: 600; }
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
    .concern-heading { font-size: 14px; font-weight: 700; color: #333; margin-bottom: 8px; }
    .badge-row { display: flex; gap: 20px; margin-bottom: 12px; align-items: center; }
    .badge { font-size: 12px; display: flex; align-items: center; gap: 6px; }
    .badge-high { color: #d32f2f; }
    .badge-med  { color: #f57c00; }
    .badge-low  { color: #388e3c; }
    .dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .dot-high { background: #d32f2f; }
    .dot-med  { background: #f57c00; }
    .dot-low  { background: #388e3c; }
    .concern-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .concern-table thead tr { border-bottom: 2px solid #e0e0e0; }
    .concern-table th { text-align: left; font-size: 11px; font-weight: 700; color: #888; letter-spacing: 0.5px; padding: 6px 8px 6px 0; }
    .ct-sev  { padding: 6px 8px 6px 0; font-size: 12px; width: 50%; vertical-align: top; border-bottom: 1px solid #f0f0f0; }
    .ct-desc { padding: 6px 0; font-size: 12px; width: 50%; vertical-align: top; border-bottom: 1px solid #f0f0f0; }
    .concl-text { font-size: 16px; font-weight: 700; line-height: 1.8; margin: 16px 0 24px; }
    .cost-text { font-size: 22px; font-weight: 700; margin-top: 16px; }
    .map-section { margin-top: 24px; }
    .map-label { font-size: 11px; font-weight: 700; color: #555; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 6px; }
    .map-img { width: 100%; max-height: 340px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px; display: block; }
  </style>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>${css}</head><body>${coverPage}${overviewPage}${photoPageHtmlArr.join('')}${conclusionPage}</body></html>`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Renders the inspection to PDF and returns the local file URI. */
export async function generatePDF(inspection: Inspection): Promise<string> {
  const html = await buildHtml(inspection);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

/** Opens the native share sheet so the user can save / forward the inspection PDF. */
export async function sharePDF(pdfUri: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(pdfUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Inspection Report',
    UTI: 'com.adobe.pdf',
  });
}

/** Send the inspection PDF — uses Mail if available, falls back to share sheet (Outlook, Gmail, AirDrop, etc). */
export async function emailReport(inspection: Inspection, pdfUri: string): Promise<void> {
  const available = await MailComposer.isAvailableAsync();
  if (available) {
    await MailComposer.composeAsync({
      recipients: inspection.customerEmail ? [inspection.customerEmail] : [],
      subject: `Roof Inspection Report — ${inspection.address}`,
      body: `Dear ${inspection.customerName},\n\nPlease find your roof inspection report attached.\n\nIf you have any questions, don't hesitate to reach out.\n\nBest regards,\n${inspection.inspectorName}`,
      attachments: [pdfUri],
    });
  } else {
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Send Report to ${inspection.customerName}`,
      UTI: 'com.adobe.pdf',
    });
  }
}

// ─── Quote PDF ───────────────────────────────────────────────────────────────
function buildQuoteHtml(
  inspection: Inspection,
  co: CompanyProfile,
  logoUri: string,
  fmtMoney: (n: number) => string,
  localeTag: string,
  brandLogoUri: string,
): string {
  const tAndC = getTermsAndConditions(co);
  const items = inspection.quote?.lineItems ?? [];
  const subTotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const vat = subTotal * co.vatRate;
  const grandTotal = subTotal + vat;

  const dateFormatted = fmtDateOrdinal(inspection.date, localeTag);
  const todayFormatted = fmtDateOrdinal(new Date(), localeTag);

  const logoHtml = logoUri
    ? `<img src="${logoUri}" style="max-width:220px;height:auto;display:block;margin:0 auto;"/>`
    : `<div style="font-size:20px;font-weight:900;color:#1a3c5e;">${escapeHtml(co.nameLine1)}<br/><span style="font-size:12px;letter-spacing:2px;">${escapeHtml(co.nameLine2)}</span></div>`;

  const brandLogoImg = brandLogoUri
    ? `<img src="${brandLogoUri}" style="max-width:280px;height:auto;display:block;margin:0 auto;"/>`
    : `<div class="bcover-wordmark">Roof Report</div>`;

  const quoteAddressLines = inspection.address.split(',').map((l) => l.trim()).filter(Boolean);

  // ── Page 1: Branded cover (matches inspection report front page) ─────────
  const brandedCover = buildBrandedCoverPage({
    title: 'Quotation',
    dateStr: todayFormatted,
    customerName: inspection.customerName,
    customerAddressLines: quoteAddressLines,
    co,
    logoImg: logoHtml,
    brandLogoImg,
  });

  // ── Page 2: Cover letter ─────────────────────────────────────────────────
  const coverPage = `
  <div class="cover-page">
    <!-- Company header -->
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

    <p class="letter-ref"><strong>Ref: ${escapeHtml(inspection.ref || '')}</strong></p>

    <p class="letter-salutation">Dear ${escapeHtml(inspection.customerName)}</p>

    <p class="letter-body">Please now find attached our quotation for the works on ${escapeHtml(inspection.ref || 'the above property')}.</p>
    <p class="letter-body">If you have any queries please don't hesitate to contact us.</p>

    <p class="letter-sign">Yours sincerely<br/>${escapeHtml(co.shortName)}</p>

    <div class="signature-block">
      <div class="signature-line"></div>
      <p class="signatory-name">${escapeHtml(co.signatoryName)}</p>
      <p class="signatory-title">${escapeHtml(co.signatoryTitle)}</p>
    </div>
  </div>`;

  // ── Page 2: Quote table + T&Cs ───────────────────────────────────────────
  const lineRows = items.map((item) => `
    <tr>
      <td class="qty-cell">${escapeHtml(item.qty)}</td>
      <td class="desc-cell">${escapeHtml(item.description).replace(/\n/g, '<br/>')}</td>
      <td class="price-cell">${item.totalPrice > 0 ? fmtMoney(item.totalPrice) : ''}</td>
    </tr>`).join('');

  const quotePage = `
  <div class="page quote-page">
    <!-- Quote table header -->
    <div class="quote-header">
      <h2 class="quote-for">Quotation for ${escapeHtml(inspection.customerName)}</h2>
      <p class="quote-ref">Ref: ${escapeHtml(inspection.ref || '')}</p>
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

    <!-- Totals -->
    <table class="totals-table">
      <tr>
        <td class="totals-label">Sub Total</td>
        <td class="totals-value">${fmtMoney(subTotal)}</td>
      </tr>
      <tr>
        <td class="totals-label">VAT @ ${(co.vatRate * 100).toFixed(1)}%</td>
        <td class="totals-value">${fmtMoney(vat)}</td>
      </tr>
      <tr class="grand-total-row">
        <td class="totals-label">Grand Total</td>
        <td class="totals-value">${fmtMoney(grandTotal)}</td>
      </tr>
    </table>

    <!-- Terms & Conditions -->
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

    /* ── Cover page ──────────────────── */
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

    /* ── Quote page ──────────────────── */
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

/** Renders the 2-page customer quotation (cover letter + quote table) to PDF. */
export async function generateQuotePDF(inspection: Inspection): Promise<string> {
  const co = await loadCompanyProfile();
  const logoUri = await getLogoDataUri(co.logoUri);
  const brandLogoUri = await getBrandLogoDataUri();
  const locale = await loadLocale();
  const localeTag = getLocaleTag(locale.language, locale.region);
  const fmtMoney = (n: number) => formatCurrencyWith(n, locale);
  const html = buildQuoteHtml(inspection, co, logoUri, fmtMoney, localeTag, brandLogoUri);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

/** Share the quote PDF via the native share sheet. */
export async function shareQuotePDF(pdfUri: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(pdfUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Quote',
    UTI: 'com.adobe.pdf',
  });
}

/** Send the quote PDF — uses Mail if available, falls back to share sheet (Outlook, Gmail, AirDrop, etc). */
export async function emailQuote(inspection: Inspection, pdfUri: string): Promise<void> {
  const co = await loadCompanyProfile();
  const available = await MailComposer.isAvailableAsync();
  if (available) {
    await MailComposer.composeAsync({
      recipients: inspection.customerEmail ? [inspection.customerEmail] : [],
      subject: `Quotation — ${inspection.ref || inspection.address}`,
      body: `Dear ${inspection.customerName},\n\nPlease find attached our quotation for the works on ${inspection.ref || inspection.address}.\n\nIf you have any queries please don't hesitate to contact us.\n\nYours sincerely,\n${co.signatoryName}\n${co.signatoryTitle}\n${co.shortName}\nTel: ${co.tel}\nEmail: ${co.email}`,
      attachments: [pdfUri],
    });
  } else {
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Send Quote to ${inspection.customerName}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
