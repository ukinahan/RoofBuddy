import { NextResponse } from 'next/server';
import { listCustomers } from '@/lib/data';

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const customers = await listCustomers();
  const headers = ['id', 'name', 'email', 'phone', 'address', 'postcode', 'notes', 'createdAt', 'updatedAt'];
  const rows = customers.map(({ customer: c }) =>
    [c.id, c.name, c.email, c.phone, c.address, c.postcode, c.notes, c.createdAt, c.updatedAt]
      .map(csvEscape)
      .join(','),
  );
  const body = [headers.join(','), ...rows].join('\r\n');
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
