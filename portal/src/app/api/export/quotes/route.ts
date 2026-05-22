import { NextResponse } from 'next/server';
import { listInspections } from '@/lib/data';

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const items = await listInspections();
  const headers = [
    'inspectionId', 'customerName', 'address', 'lineDescription',
    'qty', 'unitPrice', 'subtotal', 'currency',
  ];
  const rows: string[] = [];
  for (const { inspection: i } of items) {
    const cur = i.quoteCurrency || 'EUR';
    for (const li of i.quoteItems ?? []) {
      rows.push(
        [i.id, i.customerName, i.address, li.description, li.qty, li.unitPrice, li.qty * li.unitPrice, cur]
          .map(csvEscape)
          .join(','),
      );
    }
  }
  const body = [headers.join(','), ...rows].join('\r\n');
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="quotes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
