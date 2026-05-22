import { listActivity, listTrackingEvents } from '@/lib/features';

const ACTION_LABEL: Record<string, string> = {
  created: 'Created',
  edited: 'Edited',
  deleted: 'Deleted',
  stage_changed: 'Stage changed',
  rescheduled: 'Rescheduled',
  quote_accepted: 'Quote accepted',
};

const TRACK_LABEL: Record<string, { label: string; icon: string }> = {
  pdf_view: { label: 'PDF viewed', icon: '📄' },
  quote_view: { label: 'Quote page viewed', icon: '👁' },
  email_open: { label: 'Email opened', icon: '✉️' },
  quote_accepted: { label: 'Quote accepted', icon: '✅' },
};

export default async function ActivityPanel({ inspectionId }: { inspectionId: string }) {
  const [activity, tracking] = await Promise.all([
    listActivity(inspectionId),
    listTrackingEvents(inspectionId),
  ]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Activity log
        </h2>
        {activity.length === 0 ? (
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0">
                <div>
                  <div className="font-semibold text-slate-700">
                    {ACTION_LABEL[a.action] ?? a.action}
                  </div>
                  <div className="text-xs text-slate-500">
                    {a.actorEmail ?? 'system'}
                    {a.action === 'stage_changed' && a.details
                      ? ` · ${(a.details as { from?: string; to?: string }).from ?? '?'} → ${(a.details as { to?: string }).to ?? '?'}`
                      : ''}
                  </div>
                </div>
                <div className="whitespace-nowrap text-xs text-slate-400">
                  {new Date(a.createdAt).toLocaleString('en-IE')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Customer engagement
        </h2>
        {tracking.length === 0 ? (
          <p className="text-sm text-slate-500">
            No views recorded yet. Embed the tracking pixel{' '}
            <code className="rounded bg-slate-100 px-1 text-[11px]">
              /api/track/{inspectionId}?k=email_open
            </code>{' '}
            in your email to log opens.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {tracking.map((e) => {
              const meta = TRACK_LABEL[e.kind] ?? { label: e.kind, icon: '•' };
              return (
                <li key={e.id} className="flex justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0">
                  <span>
                    <span className="mr-1.5">{meta.icon}</span>
                    {meta.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(e.createdAt).toLocaleString('en-IE')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
