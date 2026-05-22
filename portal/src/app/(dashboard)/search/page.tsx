import Link from 'next/link';
import { listInspectionSummaries } from '@/lib/features';
import { listCustomers } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const needle = q.trim().toLowerCase();
  if (!needle) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Search</h1>
        <p className="mt-2 text-sm text-slate-500">Type a query in the header search box.</p>
      </div>
    );
  }

  const [inspections, customers] = await Promise.all([
    listInspectionSummaries(),
    listCustomers(),
  ]);

  const inspectionHits = inspections.filter(
    (i) =>
      i.customerName?.toLowerCase().includes(needle) ||
      i.address?.toLowerCase().includes(needle) ||
      i.id.toLowerCase().includes(needle),
  );
  const customerHits = customers.filter(({ customer: c }) =>
    [c.name, c.email, c.phone, c.address, c.postcode]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(needle)),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">
        Search: <span className="text-slate-500 font-normal">“{q}”</span>
      </h1>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Inspections ({inspectionHits.length})
        </h2>
        {inspectionHits.length === 0 ? (
          <p className="text-sm text-slate-500">No matches.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
            {inspectionHits.slice(0, 50).map((i) => (
              <li key={i.id}>
                <Link
                  href={`/inspections/${i.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {i.customerName || '—'}
                    </div>
                    <div className="text-xs text-slate-500">{i.address}</div>
                  </div>
                  <span className="text-[11px] uppercase text-slate-500">{i.pipelineStage}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Customers ({customerHits.length})
        </h2>
        {customerHits.length === 0 ? (
          <p className="text-sm text-slate-500">No matches.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
            {customerHits.slice(0, 50).map(({ customer: c }) => (
              <li key={c.id} className="px-4 py-3">
                <div className="text-sm font-semibold text-slate-800">{c.name}</div>
                <div className="text-xs text-slate-500">
                  {[c.email, c.phone, c.address].filter(Boolean).join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
