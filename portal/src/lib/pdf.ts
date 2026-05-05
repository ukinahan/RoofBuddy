/**
 * HTML → PDF rendering via headless Chromium.
 *
 * Uses `puppeteer-core` so we can pick the Chromium binary at runtime:
 *   - In serverless / production: `@sparticuz/chromium` (slim Linux build).
 *   - In local dev (Windows/macOS): a system-installed Chrome / Edge,
 *     resolved from `CHROME_EXECUTABLE_PATH` or common install paths.
 *
 * This keeps the deployable bundle small while still letting the
 * portal produce *exactly* the same HTML the mobile app prints.
 */
import 'server-only';
import type { Browser, LaunchOptions } from 'puppeteer-core';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@/lib/supabase/server';
import { buildInspectionHtml, buildQuoteHtml, type BuildOptions } from './reportHtml';
import type { Inspection, CompanyProfile } from './types';

// ── Browser launcher ────────────────────────────────────────────────────────

const COMMON_CHROME_PATHS = [
  // Windows
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import('puppeteer-core');
  const isServerless =
    !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL || !!process.env.NETLIFY;

  let opts: LaunchOptions;
  if (isServerless) {
    // Use the full @sparticuz/chromium package: it bundles the Chromium
    // binary AND its required shared libraries (libnss3.so, libatk, etc.)
    // brotli-compressed, so no system packages are needed at runtime.
    //
    // Vercel runs functions on AWS Lambda but does NOT set AWS_EXECUTION_ENV,
    // which the chromium package uses to decide whether to extract the
    // al2023.tar.br archive (the one containing libnss3.so & friends). If
    // we don't force-set it, the binary launches but immediately fails with
    // "libnss3.so: cannot open shared object file".
    if (!process.env.AWS_EXECUTION_ENV) {
      process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs20.x';
    }
    const chromium = (await import('@sparticuz/chromium')).default;
    opts = {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    };
  } else {
    const candidate =
      process.env.CHROME_EXECUTABLE_PATH ||
      COMMON_CHROME_PATHS.find((p) => existsSync(p));
    if (!candidate) {
      throw new Error(
        'No Chrome/Edge binary found for PDF rendering. Set CHROME_EXECUTABLE_PATH ' +
          'to your local Chrome or Edge executable.',
      );
    }
    opts = { executablePath: candidate, headless: true, args: ['--no-sandbox'] };
  }
  return await puppeteer.launch(opts);
}

async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── Photo / logo loaders (Supabase Storage → data URI) ──────────────────────

async function fetchPhotosAsDataUris(
  ownerId: string,
  inspection: Inspection,
): Promise<Map<string, string>> {
  const supabase = await createClient();
  const map = new Map<string, string>();
  await Promise.all(
    inspection.photos.map(async (p) => {
      try {
        const { data, error } = await supabase.storage
          .from('photos')
          .download(`${ownerId}/${p.id}.jpg`);
        if (error || !data) return;
        const ab = await data.arrayBuffer();
        const base64 = Buffer.from(ab).toString('base64');
        map.set(p.id, `data:image/jpeg;base64,${base64}`);
      } catch {
        // Best-effort: missing photos render as a placeholder.
      }
    }),
  );
  return map;
}

async function fetchLogoAsDataUri(profile: CompanyProfile | null): Promise<string | null> {
  const uri = profile?.logoUri;
  if (!uri) return null;
  try {
    if (uri.startsWith('data:')) return uri;
    if (/^https?:\/\//i.test(uri)) {
      const res = await fetch(uri);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      const ct = res.headers.get('content-type') || 'image/png';
      return `data:${ct};base64,${Buffer.from(ab).toString('base64')}`;
    }
    // Mobile-stored relative path like "company/logo.png" or a Supabase
    // Storage object key. Try the `company-logos` storage bucket using the
    // owner's user-id folder convention (matches the photos bucket layout).
    try {
      const supabase = await createClient();
      // Strip any leading folder segments down to the filename, then look
      // for `<ownerId>/<filename>`. Owner id is appended by the caller via
      // a `logoUri` of form "<ownerId>/<filename>" when stored centrally.
      const key = uri.replace(/^\/+/, '');
      for (const bucket of ['company-logos', 'logos', 'photos']) {
        const { data, error } = await supabase.storage.from(bucket).download(key);
        if (!error && data) {
          const ab = await data.arrayBuffer();
          const lower = key.toLowerCase();
          const mime =
            lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg'
            : lower.endsWith('.webp') ? 'image/webp'
            : lower.endsWith('.svg') ? 'image/svg+xml'
            : 'image/png';
          return `data:${mime};base64,${Buffer.from(ab).toString('base64')}`;
        }
      }
    } catch {
      // fall through
    }
    return null;
  } catch {
    return null;
  }
}

// ── Public renderers ────────────────────────────────────────────────────────

// Cache the bundled brand logo as a data URI for the lifetime of the
// serverless function instance — same bytes for every request.
let brandLogoDataUriCache: string | null = null;
function loadBrandLogoDataUri(): string {
  if (brandLogoDataUriCache !== null) return brandLogoDataUriCache;
  try {
    const p = join(process.cwd(), 'public', 'roof-report-logo.png');
    const b = readFileSync(p).toString('base64');
    brandLogoDataUriCache = `data:image/png;base64,${b}`;
  } catch {
    brandLogoDataUriCache = '';
  }
  return brandLogoDataUriCache;
}

export async function renderInspectionPdf(
  inspection: Inspection,
  profile: CompanyProfile | null,
  ownerId: string,
): Promise<Buffer> {
  const [photoDataUris, logoDataUri] = await Promise.all([
    fetchPhotosAsDataUris(ownerId, inspection),
    fetchLogoAsDataUri(profile),
  ]);
  const opts: BuildOptions = {
    photoDataUris,
    logoDataUri,
    brandLogoDataUri: loadBrandLogoDataUri(),
    currency: inspection.quoteCurrency || 'EUR',
  };
  const html = buildInspectionHtml(inspection, profile, opts);
  return await htmlToPdfBuffer(html);
}

export async function renderQuotePdf(
  inspection: Inspection,
  profile: CompanyProfile | null,
): Promise<Buffer> {
  const logoDataUri = await fetchLogoAsDataUri(profile);
  const opts: BuildOptions = {
    photoDataUris: new Map(),
    logoDataUri,
    brandLogoDataUri: loadBrandLogoDataUri(),
    currency: inspection.quoteCurrency || 'EUR',
  };
  const html = buildQuoteHtml(inspection, profile, opts);
  return await htmlToPdfBuffer(html);
}
