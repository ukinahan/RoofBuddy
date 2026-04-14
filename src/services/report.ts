/**
 * Generates professional PDF documents from an Inspection:
 *   1. Inspection report (photos + annotations)
 *   2. Customer quotation (cover letter + quote table + T&Cs)
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Inspection, InspectionPhoto, Annotation, DrawingPath } from '../types';
import { COMPANY, TERMS_AND_CONDITIONS } from './company';
import { addressToSatelliteUri } from './maps';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Convert a local file URI to an inline base64 data URI so the PDF renderer
 * can embed the image without needing network access.
 */
async function toDataUri(localUri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return '';
  }
}

function drawingToSvgElement(d: DrawingPath): string {
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
  return '';
}

// ─── HTML Builder ────────────────────────────────────────────────────────────

async function getLogoDataUri(): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const asset = Asset.fromModule(require('../../assets/company-logo.png'));
    await asset.downloadAsync();
    if (!asset.localUri) return '';
    const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${base64}`;
  } catch {
    return '';
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtDateOrdinal(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return `${ordinal(d.getDate())} ${d.toLocaleString('en-IE', { month: 'long' })} ${d.getFullYear()}`;
}

async function buildHtml(inspection: Inspection): Promise<string> {
  const [logoUri, satelliteUri] = await Promise.all([
    getLogoDataUri(),
    addressToSatelliteUri(inspection.address),
  ]);
  const logoImg = logoUri
    ? `<img src="${logoUri}" style="width:100%;max-width:300px;height:auto;display:block;margin-bottom:0;"/>`
    : `<div style="font-size:24px;font-weight:900;color:#1a3c5e;line-height:1.2;margin-bottom:0;">A&amp;A QUINN<br/><span style="font-size:14px;letter-spacing:2px;">ROOFING SOLUTIONS</span></div>`;

  const surveyDateStr = fmtDateOrdinal(inspection.date);
  const reportDateStr = fmtDateOrdinal(new Date());
  const year = new Date(inspection.date).getFullYear();
  const photoDataUris = await Promise.all(inspection.photos.map((p) => toDataUri(p.uri)));

  const custLines = inspection.address.split(',').map((l) => l.trim()).filter(Boolean);

  // ── Page 1: Cover ──────────────────────────────────────────────────────────
  const coverPage = `
  <div class="page-cover">
    <div class="cover-left">
      <div class="cover-logo-wrap">${logoImg}</div>
      <div class="cover-title-band">Roof Survey Report</div>
      <div class="customer-box">
        ${[inspection.customerName, ...custLines].map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
      </div>
    </div>
    <div class="cover-right">
      <div class="cover-year">${year}</div>
      <div class="cover-co" style="margin-top:200px;">
        ${inspection.inspectorName ? `<div class="cover-inspector">${escapeHtml(inspection.inspectorName)}</div>` : ''}
        <div>${escapeHtml(COMPANY.nameLine1)}</div>
        <div>${escapeHtml(COMPANY.nameLine2)}</div>
        ${COMPANY.addressLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
        <div>${COMPANY.eircode}</div>
        <div class="cover-link" style="margin-top:10px;">${COMPANY.website}</div>
        <div class="cover-link">${COMPANY.email}</div>
        <div style="margin-top:14px;">${COMPANY.tel}</div>
      </div>
      <div class="cover-date" style="margin-top:80px;">${surveyDateStr}</div>
    </div>
  </div>`;

  // ── Page 2: Project Overview ───────────────────────────────────────────────
  const ovRows: Array<[string, string]> = [
    ['Project:', `"${escapeHtml(inspection.ref || inspection.customerName)}"`],
    ['Address:', escapeHtml(inspection.address)],
    ['Commissioned by:', escapeHtml(inspection.customerName)],
    ['Survey Completed:', surveyDateStr],
    ['Conditions:', escapeHtml((inspection as any).conditions || '')],
    ['Scope of works:', escapeHtml((inspection as any).scopeOfWorks || 'Roof Survey')],
    ['Quinn Personnel:', escapeHtml(inspection.inspectorName || COMPANY.defaultPersonnel)],
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
      ${satelliteUri ? `
      <div class="map-section">
        <div class="map-label">Satellite View</div>
        <img src="${satelliteUri}" class="map-img"/>
      </div>` : ''}
    </div>
  </div>`;

  // ── Pages 3+: Photos (2 per page, side by side) ───────────────────────────
  const photoPageHtmlArr: string[] = [];

  const buildPhotoCell = (photo: typeof inspection.photos[0], idx: number, uri: string | null): string => {
    const picNum = idx + 1;
    const highC = photo.annotations.filter((a) => a.severity === 'high');
    const medC  = photo.annotations.filter((a) => a.severity === 'medium');
    const lowC  = photo.annotations.filter((a) => a.severity === 'low');
    const annotSvg = photo.annotations.length > 0
      ? `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;" viewBox="0 0 100 100" preserveAspectRatio="none">${photo.annotations.map((ann, aidx) => { const cx = (ann.x * 100).toFixed(1); const cy = (ann.y * 100).toFixed(1); const col = SEVERITY_COLOR[ann.severity] || '#666'; return `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${col}" stroke="white" stroke-width="0.8"/><text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="2.8" font-weight="bold">${aidx + 1}</text>`; }).join('')}</svg>` : '';
    const drawSvg = (photo.drawings?.length ?? 0) > 0
      ? `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;" viewBox="0 0 ${photo.drawingViewport?.width ?? 390} ${photo.drawingViewport?.height ?? 292.5}" preserveAspectRatio="none">${(photo.drawings ?? []).map((d) => drawingToSvgElement(d)).join('')}</svg>` : '';
    const concernRows = photo.annotations.map((a) =>
      `<tr>
        <td class="ct-sev" style="color:${SEVERITY_COLOR[a.severity]}">${escapeHtml(SEVERITY_LABEL[a.severity])}</td>
        <td class="ct-desc" style="color:${SEVERITY_COLOR[a.severity]}">${escapeHtml(a.note)}</td>
      </tr>`
    ).join('');
    return `
      <h2 class="photo-title">Photo ${picNum}</h2>
      <p class="photo-meta">Captured: ${new Date(photo.takenAt).toLocaleString('en-IE')}</p>
      <div class="photo-wrap-2col">
        ${uri
          ? `<div style="position:relative;line-height:0;width:100%;"><img src="${uri}" class="pic-img-2col"/>${drawSvg}${annotSvg}</div>`
          : `<div class="pic-missing">No image available</div>`}
      </div>
      ${photo.notes ? `
      <div class="notes-box">
        <strong>Inspector Notes:</strong><br/>${escapeHtml(photo.notes)}
      </div>` : ''}
      ${photo.annotations.length > 0 ? `
      <h3 class="concern-heading">Concerns Identified (${photo.annotations.length})</h3>
      <div class="badge-row">
        ${highC.length > 0 ? `<span class="badge badge-high"><span class="dot dot-high"></span>${highC.length} High</span>` : ''}
        ${medC.length  > 0 ? `<span class="badge badge-med"><span class="dot dot-med"></span>${medC.length} Medium</span>` : ''}
        ${lowC.length  > 0 ? `<span class="badge badge-low"><span class="dot dot-low"></span>${lowC.length} Low</span>` : ''}
      </div>
      <table class="concern-table">
        <thead><tr><th>SEVERITY</th><th>DESCRIPTION</th></tr></thead>
        <tbody>${concernRows}</tbody>
      </table>` : ''}`;
  };

  for (let i = 0; i < inspection.photos.length; i += 2) {
    const photoA = inspection.photos[i];
    const photoB = inspection.photos[i + 1];
    const uriA = photoDataUris[i];
    const uriB = photoDataUris[i + 1] ?? null;
    photoPageHtmlArr.push(`
    <div class="page">
      <div class="page-inner">
        <div class="photo-row">
          <div class="photo-col photo-col-left">
            ${buildPhotoCell(photoA, i, uriA)}
          </div>
          <div class="photo-col photo-col-right">
            ${photoB ? buildPhotoCell(photoB, i + 1, uriB) : ''}
          </div>
        </div>
      </div>
    </div>`);
  }

  // ── Conclusion page ────────────────────────────────────────────────────────
  const cost = (inspection as any).costOfRepairs || 0;
  const hasConcl = !!((inspection as any).conclusion || cost > 0);
  let conclusionPage = '';
  if (hasConcl) {
    const vat = cost * COMPANY.vatRate;
    const total = cost + vat;
    const fe = (n: number) => '€' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    conclusionPage = `
    <div class="page">
      <div class="page-inner">
        ${(inspection as any).conclusion ? `<h2 class="sec-heading">Conclusion</h2><p class="concl-text">${escapeHtml((inspection as any).conclusion)}</p>` : ''}
        ${cost > 0 ? `<h2 class="sec-heading" style="margin-top:40px;">Cost of Repairs</h2><p class="cost-text">${fe(cost)} Plus VAT @ ${(COMPANY.vatRate * 100).toFixed(1)}% = ${fe(total)}</p>` : ''}
      </div>
    </div>`;
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  const css = `<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #222; }
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
    .page { page-break-before: always; min-height: 100vh; display: flex; flex-direction: column; }
    .page-inner { flex: 1; padding: 20px 28px 10px; }
    .sec-heading { font-size: 17px; font-weight: 700; text-align: center; text-decoration: underline; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 24px; }
    .ov-table { width: 100%; border-collapse: collapse; }
    .ov-lbl { width: 190px; padding: 14px 20px 14px 10px; text-align: right; text-decoration: underline; font-weight: 500; background: #e8f0dc; color: #333; vertical-align: middle; border-bottom: 1px solid #d4e4c4; }
    .ov-val { padding: 14px 10px; font-size: 14px; vertical-align: middle; border-bottom: 1px solid #e8e8e8; }
    .photo-title { font-size: 15px; font-weight: 700; color: #1a3c5e; margin-bottom: 3px; }
    .photo-meta { font-size: 10px; color: #999; margin-bottom: 8px; }
    .photo-wrap { margin-bottom: 10px; text-align: center; }
    .pic-img { display: block; max-width: 100%; max-height: 400px; width: auto; height: auto; }
    .photo-row { display: table; width: 100%; table-layout: fixed; }
    .photo-col { display: table-cell; width: 50%; vertical-align: top; }
    .photo-col-left { padding-right: 10px; border-right: 1px solid #ddd; }
    .photo-col-right { padding-left: 10px; }
    .photo-wrap-2col { margin-bottom: 8px; }
    .pic-img-2col { display: block; width: 100%; height: auto; max-height: 220px; object-fit: contain; }
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

const formatEuro = (n: number) =>
  '€' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function buildQuoteHtml(inspection: Inspection, logoUri: string = ''): string {
  const items = inspection.quote?.lineItems ?? [];
  const subTotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const vat = subTotal * COMPANY.vatRate;
  const grandTotal = subTotal + vat;

  const dateFormatted = fmtDateOrdinal(inspection.date);

  const logoHtml = logoUri
    ? `<img src="${logoUri}" style="max-width:180px;height:auto;display:block;margin:0 auto 10px;"/>`
    : `<div style="font-size:20px;font-weight:900;color:#1a3c5e;">A&amp;A QUINN<br/><span style="font-size:12px;letter-spacing:2px;">ROOFING SOLUTIONS LIMITED</span></div>`;

  // ── Page 1: Cover letter ─────────────────────────────────────────────────
  const coverPage = `
  <div class="cover-page">
    <!-- Company header -->
    <div class="company-header">
      ${logoHtml}
      <div class="company-services">${escapeHtml(COMPANY.services)}</div>
      <div class="company-contact">${escapeHtml(COMPANY.address)} &nbsp;&nbsp; Tel: ${COMPANY.tel} &nbsp;&nbsp; ${COMPANY.email}</div>
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

    <p class="letter-sign">Yours sincerely<br/>${escapeHtml(COMPANY.shortName)}</p>

    <div class="signature-block">
      <div class="signature-line"></div>
      <p class="signatory-name">${escapeHtml(COMPANY.signatoryName)}</p>
      <p class="signatory-title">${escapeHtml(COMPANY.signatoryTitle)}</p>
    </div>
  </div>`;

  // ── Page 2: Quote table + T&Cs ───────────────────────────────────────────
  const lineRows = items.map((item) => `
    <tr>
      <td class="qty-cell">${escapeHtml(item.qty)}</td>
      <td class="desc-cell">${escapeHtml(item.description).replace(/\n/g, '<br/>')}</td>
      <td class="price-cell">${item.totalPrice > 0 ? formatEuro(item.totalPrice) : ''}</td>
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
        <td class="totals-value">${formatEuro(subTotal)}</td>
      </tr>
      <tr>
        <td class="totals-label">VAT @ ${(COMPANY.vatRate * 100).toFixed(1)}%</td>
        <td class="totals-value">${formatEuro(vat)}</td>
      </tr>
      <tr class="grand-total-row">
        <td class="totals-label">Grand Total</td>
        <td class="totals-value">${formatEuro(grandTotal)}</td>
      </tr>
    </table>

    <!-- Terms & Conditions -->
    <div class="terms-section">
      <p class="terms-title"><strong>Terms &amp; Conditions</strong></p>
      <ul class="terms-list">
        ${TERMS_AND_CONDITIONS.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
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
  ${coverPage}
  <div class="quote-page-inner">${quotePage}</div>
</body>
</html>`;
}

/** Renders the 2-page customer quotation (cover letter + quote table) to PDF. */
export async function generateQuotePDF(inspection: Inspection): Promise<string> {
  const logoUri = await getLogoDataUri();
  const html = buildQuoteHtml(inspection, logoUri);
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
  const available = await MailComposer.isAvailableAsync();
  if (available) {
    await MailComposer.composeAsync({
      recipients: inspection.customerEmail ? [inspection.customerEmail] : [],
      subject: `Quotation — ${inspection.ref || inspection.address}`,
      body: `Dear ${inspection.customerName},\n\nPlease find attached our quotation for the works on ${inspection.ref || inspection.address}.\n\nIf you have any queries please don't hesitate to contact us.\n\nYours sincerely,\n${COMPANY.signatoryName}\n${COMPANY.signatoryTitle}\n${COMPANY.shortName}\nTel: ${COMPANY.tel}\nEmail: ${COMPANY.email}`,
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
