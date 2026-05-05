import Link from 'next/link';
import { listInspections } from '@/lib/data';
import type { Inspection } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SEVERITY_COLOR: Record<string, string> = {
  high: 'bg-rose-100 text-rose-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-emerald-100 text-emerald-800',
};

function inspectionSeverity(insp: Inspection): 'high' | 'medium' | 'low' | 'none' {
  // Highest-severity photo wins for the row badge.
  const order = ['high', 'medium', 'low', 'none'] as const;
  for (const level of order) {
    if (insp.photos.some((p) => p.severity === level)) return level;
  }
  return 'none';
}

export default async function InspectionsPage() {
  const inspections = await listInspections();

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Inspections</h1>
        <span className="text-sm text-slate-500">{inspections.length} total</span>
      </div>

      {inspections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-lg font-semibold text-slate-700">No inspections yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Inspections created in the mobile app will appear here once synced.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Address</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Photos</th>
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inspections.map(({ inspection: insp }) => {
                const severity = inspectionSeverity(insp);
                return (
                  <tr key={insp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {insp.customerName || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{insp.address || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {insp.date
                        ? new Date(insp.date).toLocaleDateString('en-IE', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{insp.photos.length}</td>
                    <td className="px-4 py-3">
                      {severity === 'none' ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLOR[severity]}`}
                        >
                          {severity.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/inspections/${insp.id}`}
                        className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
