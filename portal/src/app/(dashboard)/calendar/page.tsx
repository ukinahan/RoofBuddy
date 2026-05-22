import { listInspectionSummaries } from '@/lib/features';
import CalendarGrid from './grid';
import FeedSubscribe from './feed-subscribe';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const items = await listInspectionSummaries();
  const sp = await searchParams;
  const now = new Date();
  const ym = sp.m ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Calendar</h1>
        <span className="text-sm text-slate-500">
          {items.filter((i) => i.scheduledAt).length} scheduled
        </span>
      </div>
      <CalendarGrid items={items} month={ym} />
      <FeedSubscribe />
    </div>
  );
}
