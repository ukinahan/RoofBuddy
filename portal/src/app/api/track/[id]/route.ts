import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Tracking pixel / fire-and-forget endpoint. Returns a 1x1 transparent GIF
 * regardless of outcome so email clients don't show a broken image.
 *
 *   GET /api/track/<inspection-id>?k=email_open
 *   GET /api/track/<inspection-id>?k=pdf_view
 *
 * Anon-callable: relies on the `log_tracking_event` SECURITY DEFINER RPC.
 */
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const kind = url.searchParams.get('k') || 'email_open';
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null;
  const ua = req.headers.get('user-agent') || null;

  try {
    const supabase = await createClient();
    await supabase.rpc('log_tracking_event', {
      p_inspection_id: id,
      p_kind: kind,
      p_ip: ip,
      p_ua: ua,
    });
  } catch {
    /* swallow — tracking must never break the host page */
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
