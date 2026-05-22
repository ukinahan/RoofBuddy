import { createClient } from '@/lib/supabase/server';
import AcceptForm from './form';

export const dynamic = 'force-dynamic';

interface QuoteData {
  inspection_id: string;
  customer_name: string | null;
  address: string | null;
  quote_items: { id: string; description: string; qty: number; unitPrice: number }[];
  quote_total: number | null;
  currency: string | null;
  company: { name?: string; shortName?: string; email?: string; tel?: string; address?: string };
  accepted_at: string | null;
  accepted_name: string | null;
}

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_quote', { p_token: token });
  const row = (data as QuoteData[] | null)?.[0];

  if (error || !row) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Quote not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This link may have expired or been revoked. Please contact the company that sent it.
        </p>
      </main>
    );
  }

  // Fire-and-forget view log.
  try {
    await supabase.rpc('log_tracking_event', {
      p_inspection_id: row.inspection_id,
      p_kind: 'quote_view',
    });
  } catch {
    /* tracking must never break the page */
  }

  const currency = row.currency || 'EUR';
  const company = row.company ?? {};
  const total = Number(row.quote_total ?? 0);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <div className="text-sm font-semibold text-slate-500">Quotation from</div>
        <div className="text-2xl font-bold text-slate-800">
          {company.name || company.shortName || 'Roof Inspector'}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {[company.tel, company.email, company.address].filter(Boolean).join(' · ')}
        </div>
      </header>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">For</div>
        <div className="mt-1 text-base font-semibold text-slate-800">
          {row.customer_name || '—'}
        </div>
        <div className="text-sm text-slate-600">{row.address || ''}</div>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Quote
        </h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="pb-2 font-semibold">Description</th>
              <th className="pb-2 font-semibold w-14 text-right">Qty</th>
              <th className="pb-2 font-semibold w-24 text-right">Unit</th>
              <th className="pb-2 font-semibold w-28 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {row.quote_items.map((li) => (
              <tr key={li.id}>
                <td className="py-2">{li.description}</td>
                <td className="py-2 text-right tabular-nums">{li.qty}</td>
                <td className="py-2 text-right tabular-nums">{money(li.unitPrice, currency)}</td>
                <td className="py-2 text-right tabular-nums">
                  {money(li.qty * li.unitPrice, currency)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300">
              <td colSpan={3} className="pt-3 text-right text-sm font-bold uppercase text-slate-500">
                Total
              </td>
              <td className="pt-3 text-right text-base font-bold tabular-nums">
                {money(total, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {row.accepted_at ? (
        <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-900">
          <div className="font-semibold">Accepted ✓</div>
          <div className="mt-1">
            {row.accepted_name} accepted this quote on{' '}
            {new Date(row.accepted_at).toLocaleString('en-IE')}.
          </div>
        </section>
      ) : (
        <AcceptForm token={token} />
      )}
    </main>
  );
}
