import { NextResponse } from 'next/server';
import { listInspectionSummaries } from '@/lib/features';

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const items = await listInspectionSummaries();
  const headers = [
    'id', 'customerName', 'address', 'date', 'pipelineStage',
    'scheduledAt', 'completedAt', 'latitude', 'longitude',
    'photoCount', 'quoteTotal', 'currency',
  ];
  const rows = items.map((i) =>
    [
      i.id, i.customerName, i.address, i.date, i.pipelineStage,
      i.scheduledAt, i.completedAt, i.latitude, i.longitude,
      i.photoCount, i.quoteTotal, i.currency,
    ]
      .map(csvEscape)
      .join(','),
  );
  const body = [headers.join(','), ...rows].join('\r\n');
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inspections-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
