import { NextResponse } from 'next/server';
import { getInspection, getCompanyProfile, getCurrentUser } from '@/lib/data';
import { renderQuotePdf } from '@/lib/pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Stream a quotation PDF for an inspection — same template as the mobile app.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const owned = await getInspection(id);
  if (!owned) return new NextResponse('Not found', { status: 404 });
  const { inspection, ownerId } = owned;

  const profile = await getCompanyProfile(ownerId).catch(() => null);
  const pdf = await renderQuotePdf(inspection, profile);
  const filename = `quotation-${(inspection.customerName || 'quote')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()}.pdf`;

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
