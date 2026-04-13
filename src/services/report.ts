/**
 * Generates professional PDF documents from an Inspection:
 *   1. Inspection report (photos + annotations)
 *   2. Customer quotation (cover letter + quote table + T&Cs)
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import { Inspection, InspectionPhoto, Annotation } from '../types';
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

async function buildHtml(inspection: Inspection): Promise<string> {
  const photoSections = await Promise.all(
    inspection.photos.map(async (photo, index) => {
      const dataUri = await toDataUri(photo.uri);

      const highConcerns = photo.annotations.filter((a) => a.severity === 'high');
      const medConcerns = photo.annotations.filter((a) => a.severity === 'medium');
      const lowConcerns = photo.annotations.filter((a) => a.severity === 'low');

      const annotationRows = photo.annotations
        .map(
          (a: Annotation) => `
          <tr>
            <td style="padding:6px 8px;">
              <span style="display:inline-block;width:12px;height:12px;border-radius:50%;
                           background:${SEVERITY_COLOR[a.severity]};margin-right:6px;vertical-align:middle;"></span>
              ${escapeHtml(SEVERITY_LABEL[a.severity])}
            </td>
            <td style="padding:6px 8px;">${escapeHtml(a.note)}</td>
          </tr>`
        )
        .join('');

      return `
        <div class="photo-section">
          <h3>Photo ${index + 1}</h3>
          <p class="photo-meta">Captured: ${new Date(photo.takenAt).toLocaleString()}</p>
          ${dataUri ? `
          <div style="position:relative;display:block;width:100%;font-size:0;">
            <img src="${dataUri}" style="width:100%;max-height:400px;object-fit:cover;border-radius:6px;border:1px solid #ddd;display:block;" />
            ${(photo.drawings?.length ?? 0) > 0 ? `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;" viewBox="0 0 ${photo.drawingViewport?.width ?? 390} ${photo.drawingViewport?.height ?? 292.5}" preserveAspectRatio="xMidYMid slice">
              ${(photo.drawings ?? []).map((d) => drawingToSvgElement(d)).join('\n              ')}
            </svg>` : ''}
            ${photo.annotations.length > 0 ? `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
              ${photo.annotations.map((ann, i) => {
                const cx = (ann.x * 100).toFixed(1);
                const cy = (ann.y * 100).toFixed(1);
                const col = SEVERITY_COLOR[ann.severity] || '#666';
                return `<circle cx="${cx}" cy="${cy}" r="3" fill="${col}" stroke="white" stroke-width="0.8"/>
                <text x="${cx}" y="${(parseFloat(cy) + 0.1).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="2.8" font-weight="bold">${i + 1}</text>`;
              }).join('\n              ')}
            </svg>` : ''}
          </div>` : '<p style="color:#999;">[Photo unavailable]</p>'}

          ${
            photo.notes
              ? `<div class="notes-box"><strong>Inspector Notes:</strong><br/>${escapeHtml(photo.notes)}</div>`
              : ''
          }

          ${
            photo.annotations.length > 0
              ? `
            <h4>Concerns Identified (${photo.annotations.length})</h4>
            <div class="badge-row">
              ${highConcerns.length > 0 ? `<span class="badge high">${highConcerns.length} High</span>` : ''}
              ${medConcerns.length > 0 ? `<span class="badge medium">${medConcerns.length} Medium</span>` : ''}
              ${lowConcerns.length > 0 ? `<span class="badge low">${lowConcerns.length} Low</span>` : ''}
            </div>
            <table class="concern-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>${annotationRows}</tbody>
            </table>`
              : '<p style="color:#666;">No concerns identified for this photo.</p>'
          }
        </div>`;
    })
  );

  // Overall summary
  const allAnnotations = inspection.photos.flatMap((p) => p.annotations);
  const totalHigh = allAnnotations.filter((a) => a.severity === 'high').length;
  const totalMed = allAnnotations.filter((a) => a.severity === 'medium').length;
  const totalLow = allAnnotations.filter((a) => a.severity === 'low').length;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #222; font-size: 13px; }

    .header { background: #1a3c5e; color: white; padding: 24px 32px; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .header p { font-size: 13px; opacity: 0.85; }

    .section { padding: 20px 32px; border-bottom: 1px solid #eee; }
    .section h2 { font-size: 15px; font-weight: 700; color: #1a3c5e; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
    .info-item { font-size: 13px; }
    .info-item .label { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }

    .summary-cards { display: flex; gap: 16px; margin-top: 8px; }
    .summary-card { flex: 1; border-radius: 8px; padding: 14px; text-align: center; }
    .summary-card.high { background: #ffebee; border: 1px solid #ef9a9a; }
    .summary-card.medium { background: #fff3e0; border: 1px solid #ffcc80; }
    .summary-card.low { background: #e8f5e9; border: 1px solid #a5d6a7; }
    .summary-card .count { font-size: 28px; font-weight: 700; }
    .summary-card .label-sm { font-size: 11px; color: #555; margin-top: 2px; }
    .summary-card.high .count { color: #c62828; }
    .summary-card.medium .count { color: #e65100; }
    .summary-card.low .count { color: #2e7d32; }

    .photo-section { padding: 20px 32px; border-bottom: 1px solid #eee; page-break-inside: avoid; }
    .photo-section h3 { font-size: 15px; font-weight: 700; color: #1a3c5e; margin-bottom: 4px; }
    .photo-meta { font-size: 11px; color: #999; margin-bottom: 12px; }

    .notes-box { background: #f5f5f5; border-left: 4px solid #1a3c5e; padding: 10px 14px; margin: 12px 0; border-radius: 0 6px 6px 0; font-size: 13px; }
    .ai-box { background: #e8f0fe; border-left: 4px solid #4285f4; padding: 10px 14px; margin: 12px 0; border-radius: 0 6px 6px 0; font-size: 13px; }

    .badge-row { display: flex; gap: 8px; margin: 10px 0; }
    .badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge.high { background: #d32f2f; color: white; }
    .badge.medium { background: #f57c00; color: white; }
    .badge.low { background: #388e3c; color: white; }

    .concern-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .concern-table th { background: #f5f5f5; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #555; }
    .concern-table td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; font-size: 12px; vertical-align: top; }
    .concern-table tr:last-child td { border-bottom: none; }

    h4 { font-size: 13px; color: #333; margin: 16px 0 6px; }

    .footer { background: #f5f5f5; padding: 16px 32px; text-align: center; font-size: 11px; color: #999; }
    .contact-page { page-break-before: always; padding: 48px 40px; }
    .contact-page h2 { font-size: 20px; font-weight: 700; color: #1a3c5e; margin-bottom: 24px; border-bottom: 2px solid #1a3c5e; padding-bottom: 12px; }
    .contact-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-size: 15px; color: #333; }
    .contact-label { font-weight: 700; color: #1a3c5e; min-width: 70px; }
    .contact-value { color: #444; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <h1>Roof Inspection Report</h1>
    <p>A&amp;A Quinn Roofing Solutions &mdash; Crossabeg, WX &nbsp;|&nbsp; ${new Date(inspection.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>

  <!-- Customer Information -->
  <div class="section">
    <h2>Customer Information</h2>
    <div class="info-grid">
      <div class="info-item"><div class="label">Customer Name</div>${escapeHtml(inspection.customerName)}</div>
      <div class="info-item"><div class="label">Email</div>${escapeHtml(inspection.customerEmail || '—')}</div>
      <div class="info-item"><div class="label">Property Address</div>${escapeHtml(inspection.address)}</div>
      <div class="info-item"><div class="label">Inspection Date</div>${new Date(inspection.date).toLocaleDateString()}</div>
    </div>
    ${inspection.notes ? `<div class="notes-box" style="margin-top:14px;"><strong>General Notes:</strong><br/>${escapeHtml(inspection.notes)}</div>` : ''}
  </div>

  <!-- Summary -->
  <div class="section">
    <h2>Summary of Findings</h2>
    <p style="margin-bottom:12px;">This inspection covered <strong>${inspection.photos.length}</strong> photo(s) and identified <strong>${allAnnotations.length}</strong> area(s) of concern.</p>
    <div class="summary-cards">
      <div class="summary-card high"><div class="count">${totalHigh}</div><div class="label-sm">High Priority</div></div>
      <div class="summary-card medium"><div class="count">${totalMed}</div><div class="label-sm">Medium Priority</div></div>
      <div class="summary-card low"><div class="count">${totalLow}</div><div class="label-sm">Low Priority</div></div>
    </div>
  </div>

  <!-- Photo Sections -->
  ${photoSections.join('')}

  <!-- Footer -->
  <div class="footer">
    This report was generated by Roof Inspector on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}.
    This report documents visible conditions at time of inspection and is not a warranty.
  </div>

  <!-- Contact Details Page -->
  <div class="contact-page">
    <h2>Contact Details</h2>
    <div class="contact-row"><span class="contact-label">Company:</span><span class="contact-value">A&amp;A Quinn Roofing Solutions</span></div>
    <div class="contact-row"><span class="contact-label">Tel:</span><span class="contact-value">053-9128888</span></div>
    <div class="contact-row"><span class="contact-label">Email:</span><span class="contact-value">info@quinnroofing.ie</span></div>
    <div class="contact-row"><span class="contact-label">Address:</span><span class="contact-value">Newcastle, Crossabeg, Co. Wexford, Y35 Y567</span></div>
  </div>

</body>
</html>`;
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

/** Pre-fills the iOS/Android mail composer with the inspection PDF attached. */
export async function emailReport(inspection: Inspection, pdfUri: string): Promise<void> {
  const available = await MailComposer.isAvailableAsync();
  if (!available) throw new Error('Mail is not set up on this device. Try using Share instead.');
  await MailComposer.composeAsync({
    recipients: inspection.customerEmail ? [inspection.customerEmail] : [],
    subject: `Roof Inspection Report — ${inspection.address}`,
    body: `Dear ${inspection.customerName},\n\nPlease find your roof inspection report attached.\n\nIf you have any questions, don't hesitate to reach out.\n\nBest regards,\n${inspection.inspectorName}`,
    attachments: [pdfUri],
  });
}

// ─── Quote PDF ───────────────────────────────────────────────────────────────

const formatEuro = (n: number) =>
  '€' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function buildQuoteHtml(inspection: Inspection): string {
  const items = inspection.quote?.lineItems ?? [];
  const subTotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const vat = subTotal * COMPANY.vatRate;
  const grandTotal = subTotal + vat;

  const dateFormatted = new Date(inspection.date).toLocaleDateString('en-IE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Page 1: Cover letter ─────────────────────────────────────────────────
  const coverPage = `
  <div class="page cover-page">
    <!-- Company header -->
    <div class="company-header">
      <div class="logo-block">
        <div class="logo-diamond">
          <span class="logo-text-aa">A&amp;A</span>
          <span class="logo-text-quinn">QUINN</span>
        </div>
        <div class="logo-name">
          <div class="logo-name-main">ROOFING SOLUTIONS</div>
          <div class="logo-name-sub">LIMITED</div>
        </div>
      </div>
      <div class="company-services">${escapeHtml(COMPANY.services)}</div>
      <div class="company-contact">${escapeHtml(COMPANY.address)} &nbsp;&nbsp; Tel: ${COMPANY.tel} &nbsp;&nbsp; M: ${COMPANY.mobile}</div>
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

    .page { padding: 40px 44px; min-height: 100vh; }

    /* ── Cover page ──────────────────── */
    .cover-page {}

    .company-header { text-align: center; margin-bottom: 32px; border-bottom: 1px solid #ddd; padding-bottom: 20px; }

    .logo-block { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 10px; }
    .logo-diamond {
      width: 70px; height: 70px;
      background: linear-gradient(135deg, #c8941a 0%, #e8b84b 40%, #2d6a2d 60%, #1a4d1a 100%);
      clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .logo-text-aa { color: white; font-size: 18px; font-weight: 900; line-height: 1; }
    .logo-text-quinn { color: white; font-size: 10px; font-weight: 700; letter-spacing: 1px; }

    .logo-name { text-align: left; }
    .logo-name-main { font-size: 20px; font-weight: 900; color: #1a3c5e; letter-spacing: 2px; }
    .logo-name-sub { font-size: 12px; font-weight: 600; color: #555; letter-spacing: 4px; }

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
    .quote-page { page-break-before: always; }
    .quote-header { margin-bottom: 24px; }
    .quote-for { font-size: 18px; font-weight: 700; text-align: center; }
    .quote-ref { font-size: 14px; font-weight: 700; color: #c8001a; text-align: center; margin-top: 4px; }

    .quote-table { width: 100%; border-collapse: collapse; border: 1px solid #333; margin-bottom: 0; }
    .quote-table th { background: #f5f5f5; padding: 8px 10px; font-size: 12px; font-weight: 700; border: 1px solid #333; }
    .quote-table td { padding: 10px; border: 1px solid #ccc; font-size: 12px; vertical-align: top; line-height: 1.6; }
    .qty-cell { width: 80px; }
    .desc-cell { }
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
  ${quotePage}
</body>
</html>`;
}

/** Renders the 2-page customer quotation (cover letter + quote table) to PDF. */
export async function generateQuotePDF(inspection: Inspection): Promise<string> {
  const html = buildQuoteHtml(inspection);
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

/** Email the quote PDF to the customer. */
export async function emailQuote(inspection: Inspection, pdfUri: string): Promise<void> {
  const available = await MailComposer.isAvailableAsync();
  if (!available) throw new Error('Mail is not set up on this device. Try using Share instead.');
  await MailComposer.composeAsync({
    recipients: inspection.customerEmail ? [inspection.customerEmail] : [],
    subject: `Quotation — ${inspection.ref || inspection.address}`,
    body: `Dear ${inspection.customerName},\n\nPlease find attached our quotation for the works on ${inspection.ref || inspection.address}.\n\nIf you have any queries please don't hesitate to contact us.\n\nYours sincerely,\n${COMPANY.signatoryName}\n${COMPANY.signatoryTitle}\n${COMPANY.shortName}\nTel: ${COMPANY.tel}\nEmail: ${COMPANY.email}`,
    attachments: [pdfUri],
  });
}
