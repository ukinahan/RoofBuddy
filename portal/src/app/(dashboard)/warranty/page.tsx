import Link from 'next/link';
import { listWarrantyReminders, listInspectionSummaries } from '@/lib/features';
import DismissButton from './dismiss';

export const dynamic = 'force-dynamic';

export default async function WarrantyPage() {
  const [reminders, inspections] = await Promise.all([
    listWarrantyReminders(),
    listInspectionSummaries(),
  ]);
  const byId = new Map(inspections.map((i) => [i.id, i]));
  const today = new Date().toISOString().slice(0, 10);

  const active = reminders.filter((r) => !r.dismissedAt);
  const due = active.filter((r) => r.dueOn <= today);
  const upcoming = active.filter((r) => r.dueOn > today);

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Warranty reminders</h1>
        <span className="text-sm text-slate-500">
          {due.length} due, {upcoming.length} upcoming
        </span>
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl mb-3">🛡</div>
          <h2 className="text-lg font-semibold text-slate-700">No reminders yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Reminders are auto-created 12 months after a job is marked completed.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {due.length > 0 && (
            <Section title="Due now" rows={due} byId={byId} accent="bg-rose-50 border-rose-200" />
          )}
          {upcoming.length > 0 && (
            <Section title="Upcoming" rows={upcoming} byId={byId} accent="bg-white" />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  byId,
  accent,
}: {
  title: string;
  rows: { id: number; inspectionId: string; dueOn: string; reason: string }[];
  byId: Map<string, { customerName: string; address: string }>;
  accent: string;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className={`overflow-hidden rounded-xl border border-slate-200 ${accent} shadow-sm`}>
        <table className="w-full text-sm">
          <thead className="bg-white/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Customer</th>
              <th className="px-4 py-2 font-semibold">Address</th>
              <th className="px-4 py-2 font-semibold">Due</th>
              <th className="px-4 py-2 font-semibold">Reason</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const i = byId.get(r.inspectionId);
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-semibold text-slate-800">
                    {i?.customerName || '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{i?.address || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{r.dueOn}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {r.reason.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/inspections/${r.inspectionId}`}
                      className="mr-2 text-xs font-semibold text-slate-700 hover:underline"
                    >
                      Open
                    </Link>
                    <DismissButton id={r.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
