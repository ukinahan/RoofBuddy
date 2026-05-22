import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface FeedRow {
  id: string;
  customer_name: string | null;
  address: string | null;
  scheduled_at: string;
  pipeline_stage: string | null;
  updated_at: string;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Format ISO date as YYYYMMDDTHHMMSSZ (UTC) for iCal. */
function icsTime(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function fold(line: string): string {
  // iCal lines must be folded at 75 octets.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) {
    parts.push((i === 0 ? '' : ' ') + line.substring(i, i + 73));
  }
  return parts.join('\r\n');
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cleanToken = token.replace(/\.ics$/i, '');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_calendar_feed', { p_token: cleanToken });

  if (error) {
    return new NextResponse(`error: ${error.message}`, { status: 500 });
  }
  const rows = (data as FeedRow[] | null) ?? [];

  const host =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') ||
    'admin.roofinspector.app';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Roof Report//Inspections//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Roof Report — Scheduled jobs',
    'X-WR-TIMEZONE:UTC',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const r of rows) {
    const start = new Date(r.scheduled_at);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1h default
    const summary = `${r.customer_name || 'Inspection'}${r.pipeline_stage ? ` · ${r.pipeline_stage}` : ''}`;
    const description = `Open in Roof Report: https://${host}/inspections/${r.id}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.id}@${host}`,
      `DTSTAMP:${icsTime(r.updated_at || r.scheduled_at)}`,
      `DTSTART:${icsTime(start.toISOString())}`,
      `DTEND:${icsTime(end.toISOString())}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      ...(r.address ? [`LOCATION:${escapeIcs(r.address)}`] : []),
      `URL:https://${host}/inspections/${r.id}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  const body = lines.map(fold).join('\r\n') + '\r\n';
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      'Content-Disposition': 'inline; filename="roof-report.ics"',
    },
  });
}
