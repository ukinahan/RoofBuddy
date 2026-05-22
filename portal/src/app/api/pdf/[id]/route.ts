import { NextResponse } from 'next/server';
import { getInspection, getCompanyProfile, getCurrentUser } from '@/lib/data';
import { renderInspectionPdf } from '@/lib/pdf';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// PDF rendering with headless Chromium can take >10s on cold start.
export const maxDuration = 60;

/**
 * Stream a PDF of an inspection, rendered from the same HTML template the
 * mobile app uses (`reportHtml.ts`) via headless Chromium.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const owned = await getInspection(id);
  if (!owned) return new NextResponse('Not found', { status: 404 });
  const { inspection, ownerId } = owned;

  // Use the inspection owner's company profile so a shared assistant prints
  // reports under the inspector's branding.
  const profile = await getCompanyProfile(ownerId).catch(() => null);

  try {
    const pdf = await renderInspectionPdf(inspection, profile, ownerId);
    const filename = `roof-survey-report-${(inspection.customerName || 'report')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()}.pdf`;

    // Log a tracking event so the portal can show "PDF viewed" timestamps.
    try {
      const sb = await createClient();
      await sb.rpc('log_tracking_event', { p_inspection_id: id, p_kind: 'pdf_view' });
    } catch { /* tracking must never break the response */ }

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    console.error('[pdf]', msg);
    return new NextResponse(`PDF generation failed:\n\n${msg}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
