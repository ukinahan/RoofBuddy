import { NextResponse } from 'next/server';
import { getInspection, getCompanyProfile, getCurrentUser } from '@/lib/data';
import { renderInspectionPdf } from '@/lib/pdf';

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

  const pdf = await renderInspectionPdf(inspection, profile, ownerId);
  const filename = `roof-survey-report-${(inspection.customerName || 'report')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()}.pdf`;

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
