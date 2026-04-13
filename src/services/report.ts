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
  const logoUri = await getLogoDataUri();
  const logoImg = logoUri
    ? `<img src="${logoUri}" style="max-width:220px;height:auto;display:block;margin-bottom:14px;"/>`
    : `<div style="font-size:24px;font-weight:900;color:#1a3c5e;line-height:1.2;margin-bottom:14px;">A&amp;A QUINN<br/><span style="font-size:14px;letter-spacing:2px;">ROOFING SOLUTIONS</span></div>`;

  const surveyDateStr = fmtDateOrdinal(inspection.date);
  const reportDateStr = fmtDateOrdinal(new Date());
  const year = new Date(inspection.date).getFullYear();
  const photoDataUris = await Promise.all(inspection.photos.map((p) => toDataUri(p.uri)));

  const footerBar = (n: number) =>
    `<div class="footer-bar"><span>${escapeHtml(COMPANY.shortName)} Ltd</span><span>${COMPANY.website}</span><span>Tel: ${COMPANY.telCompact}</span><span class="fp">${n}</span></div>`;

  const custLines = inspection.address.split(',').map((l) => l.trim()).filter(Boolean);

  // ── Page 1: Cover ──────────────────────────────────────────────────────────
  const coverPage = `
  <div class="page-cover">
    <div class="cover-left">
      ${logoImg}
      <div class="cover-title-band">Roof Survey Report</div>
      <div style="flex:1;min-height:80px;"></div>
      <div class="customer-box">
        ${[inspection.customerName, ...custLines].map((l) => `<div><strong>${escapeHtml(l)}</strong></div>`).join('')}
      </div>
    </div>
    <div class="cover-right">
      <div class="cover-year">${year}</div>
      <div style="flex:1;"></div>
      <div class="cover-co">
        <div>${escapeHtml(COMPANY.nameLine1)}</div>
        <div>${escapeHtml(COMPANY.nameLine2)}</div>
        ${COMPANY.addressLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
        <div>${COMPANY.eircode}</div>
        <div style="color:#2255a0;text-decoration:underline;font-size:12px;margin-top:8px;">${COMPANY.website}</div>
        <div style="color:#2255a0;text-decoration:underline;font-size:12px;">${COMPANY.email}</div>
        <div style="margin-top:10px;">${COMPANY.telCompact}</div>
      </div>
      <div style="flex:1;"></div>
      <div class="cover-date"><strong>${surveyDateStr}</strong></div>
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
    </div>
    ${footerBar(1)}
  </div>`;

  // ── Pages 3+: Photos (4 per page, 2×2 grid) ───────────────────────────────
  const PHOTOS_PER_PAGE = 4;
  const photoPageHtmlArr: string[] = [];

  for (let i = 0; i < inspection.photos.length; i += PHOTOS_PER_PAGE) {
    const group = inspection.photos.slice(i, i + PHOTOS_PER_PAGE);
    const pageNum = 2 + Math.floor(i / PHOTOS_PER_PAGE);

    const cells = Array.from({ length: 4 }, (_, j) => {
      const photo = group[j];
      if (!photo) return `<td class="pic-cell pic-empty"></td>`;
      const picNum = i + j + 1;
      const uri = photoDataUris[i + j];
      const annotItems = photo.annotations
        .map((a, k) => `<li style="color:${SEVERITY_COLOR[a.severity]};">[${a.severity.toUpperCase()}] ${escapeHtml(a.note)}</li>`)
        .join('');
      const annotSvg = photo.annotations.length > 0
        ? `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${photo.annotations.map((ann, idx) => { const cx = (ann.x * 100).toFixed(1); const cy = (ann.y * 100).toFixed(1); const col = SEVERITY_COLOR[ann.severity] || '#666'; return `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${col}" stroke="white" stroke-width="0.8"/><text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="2.8" font-weight="bold">${idx + 1}</text>`; }).join('')}</svg>` : '';
      const drawSvg = (photo.drawings?.length ?? 0) > 0
        ? `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;" viewBox="0 0 ${photo.drawingViewport?.width ?? 390} ${photo.drawingViewport?.height ?? 292.5}" preserveAspectRatio="xMidYMid slice">${(photo.drawings ?? []).map((d) => drawingToSvgElement(d)).join('')}</svg>` : '';
      return `<td class="pic-cell">
        <div class="pic-hdr">Picture ${picNum}</div>
        <div class="pic-body">${uri ? `<div style="position:relative;display:inline-block;width:100%;"><img src="${uri}" class="pic-img"/>${drawSvg}${annotSvg}</div>` : `<div class="pic-missing">No image</div>`}</div>
        ${photo.notes ? `<div class="pic-notes">${escapeHtml(photo.notes)}</div>` : ''}
        ${photo.annotations.length > 0 ? `<div class="pic-annots"><strong>Areas of Concern:</strong><ol>${annotItems}</ol></div>` : ''}
      </td>`;
    });

    photoPageHtmlArr.push(`
    <div class="page">
      <div class="page-inner">
        <table class="photo-grid"><tr>${cells[0]}${cells[1]}</tr><tr>${cells[2]}${cells[3]}</tr></table>
      </div>
      ${footerBar(pageNum)}
    </div>`);
  }

  // ── Conclusion page ────────────────────────────────────────────────────────
  const cost = (inspection as any).costOfRepairs || 0;
  const hasConcl = !!((inspection as any).conclusion || cost > 0);
  let conclusionPage = '';
  if (hasConcl) {
    const pageNum = 2 + Math.ceil(inspection.photos.length / PHOTOS_PER_PAGE);
    const vat = cost * COMPANY.vatRate;
    const total = cost + vat;
    const fe = (n: number) => '€' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    conclusionPage = `
    <div class="page">
      <div class="page-inner">
        ${(inspection as any).conclusion ? `<h2 class="sec-heading">Conclusion</h2><p class="concl-text">${escapeHtml((inspection as any).conclusion)}</p>` : ''}
        ${cost > 0 ? `<h2 class="sec-heading" style="margin-top:40px;">Cost of Repairs</h2><p class="cost-text">${fe(cost)} Plus VAT @ ${(COMPANY.vatRate * 100).toFixed(1)}% = ${fe(total)}</p>` : ''}
      </div>
      ${footerBar(pageNum)}
    </div>`;
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  const css = `<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #222; }
    .page-cover { display: flex; flex-direction: row; min-height: 100vh; page-break-after: always; }
    .cover-left { flex: 62; padding: 40px 36px; display: flex; flex-direction: column; background: #fff; }
    .cover-right { flex: 38; background: #acc28a; padding: 32px 22px; display: flex; flex-direction: column; border-left: 3px solid #8aac68; }
    .cover-title-band { background: #111; color: white; padding: 14px 18px; font-size: 20px; font-weight: 700; }
    .customer-box { border: 2.5px solid #111; padding: 18px; text-align: center; }
    .customer-box div { font-size: 18px; line-height: 2; }
    .cover-year { font-size: 32px; font-weight: 700; color: #333; text-align: right; }
    .cover-co { font-size: 18px; color: #1a3c5e; line-height: 1.9; }
    .cover-date { font-size: 13px; text-align: right; color: #333; }
    .page { page-break-before: always; display: flex; flex-direction: column; min-height: 100vh; }
    .page-inner { flex: 1; padding: 40px 40px 20px; }
    .sec-heading { font-size: 17px; font-weight: 700; text-align: center; text-decoration: underline; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 24px; }
    .ov-table { width: 100%; border-collapse: collapse; }
    .ov-lbl { width: 190px; padding: 14px 20px 14px 10px; text-align: right; text-decoration: underline; font-weight: 500; background: #e8f0dc; color: #333; vertical-align: middle; border-bottom: 1px solid #d4e4c4; }
    .ov-val { padding: 14px 10px; font-size: 14px; vertical-align: middle; border-bottom: 1px solid #e8e8e8; }
    .photo-grid { width: 100%; border-collapse: collapse; border: 1px solid #999; }
    .pic-cell { width: 50%; border: 1px solid #999; vertical-align: top; }
    .pic-empty { background: #fafafa; }
    .pic-hdr { background: #d0d0d0; padding: 10px; text-align: center; font-size: 15px; font-weight: 700; border-bottom: 1px solid #aaa; }
    .pic-body { padding: 8px; text-align: center; min-height: 180px; }
    .pic-img { max-width: 100%; max-height: 240px; height: auto; object-fit: contain; display: block; margin: 0 auto; }
    .pic-missing { color: #ccc; padding: 40px 10px; font-size: 12px; font-style: italic; }
    .pic-notes { padding: 6px 10px; font-size: 11px; color: #444; border-top: 1px solid #eee; background: #fafafa; font-style: italic; }
    .pic-annots { padding: 6px 10px 10px; font-size: 11px; background: #fafafa; border-top: 1px solid #eee; }
    .pic-annots ol { padding-left: 16px; margin-top: 4px; }
    .pic-annots li { margin-bottom: 2px; }
    .concl-text { font-size: 16px; font-weight: 700; line-height: 1.8; margin: 16px 0 24px; }
    .cost-text { font-size: 22px; font-weight: 700; margin-top: 16px; }
    .footer-bar { background: #c0d8a4; display: flex; justify-content: space-between; align-items: center; padding: 7px 20px; font-size: 11px; color: #333; }
    .fp { font-weight: 700; }
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
