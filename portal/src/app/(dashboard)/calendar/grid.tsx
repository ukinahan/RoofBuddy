'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { InspectionSummary } from '@/lib/features';
import { setSchedule } from './actions';

function monthBounds(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  return { y, m, first, last, days: last.getUTCDate() };
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function CalendarGrid({
  items,
  month,
}: {
  items: InspectionSummary[];
  month: string;
}) {
  const { y, m, first, days } = monthBounds(month);
  const startDow = first.getUTCDay(); // 0=Sun
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const byDay = new Map<string, InspectionSummary[]>();
  for (const it of items) {
    if (!it.scheduledAt) continue;
    const d = new Date(it.scheduledAt);
    if (d.getUTCFullYear() !== y || d.getUTCMonth() !== m - 1) continue;
    const key = `${d.getUTCDate()}`;
    const arr = byDay.get(key) ?? [];
    arr.push(it);
    byDay.set(key, arr);
  }

  const onDrop = (e: React.DragEvent, day: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/inspection-id');
    if (!id) return;
    const iso = new Date(Date.UTC(y, m - 1, day, 9, 0, 0)).toISOString();
    startTransition(async () => {
      await setSchedule(id, iso);
      router.refresh();
    });
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const unscheduled = items.filter((i) => !i.scheduledAt && i.pipelineStage !== 'completed');

  return (
    <div className="grid grid-cols-[1fr_280px] gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/calendar?m=${shiftMonth(month, -1)}`}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            ← Prev
          </Link>
          <div className="text-sm font-semibold text-slate-800">
            {new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IE', {
              month: 'long',
              year: 'numeric',
            })}
          </div>
          <Link
            href={`/calendar?m=${shiftMonth(month, 1)}`}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            Next →
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-[11px] uppercase tracking-wide text-slate-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-2 py-1 font-semibold">
              {d}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, i) => (
            <div
              key={i}
              onDragOver={(e) => day && e.preventDefault()}
              onDrop={(e) => day && onDrop(e, day)}
              className={`min-h-[88px] rounded-md border p-1 text-xs ${
                day ? 'border-slate-200 bg-white' : 'border-transparent'
              }`}
            >
              {day && (
                <>
                  <div className="text-[11px] font-semibold text-slate-500">{day}</div>
                  <div className="mt-1 flex flex-col gap-1">
                    {(byDay.get(String(day)) ?? []).map((it) => (
                      <Link
                        key={it.id}
                        href={`/inspections/${it.id}`}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData('text/inspection-id', it.id)
                        }
                        className="block truncate rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900 hover:bg-amber-200"
                      >
                        {it.customerName || it.address || '—'}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        {pending && <div className="mt-2 text-xs text-slate-500">Saving…</div>}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Unscheduled
        </h3>
        <p className="mb-2 text-[11px] text-slate-500">
          Drag onto a date to schedule.
        </p>
        <div className="flex flex-col gap-1.5">
          {unscheduled.length === 0 ? (
            <div className="text-xs text-slate-400">All caught up.</div>
          ) : (
            unscheduled.map((it) => (
              <div
                key={it.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/inspection-id', it.id)}
                className="cursor-grab rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50"
              >
                <div className="font-semibold text-slate-800">{it.customerName || '—'}</div>
                <div className="text-slate-500">{it.address || '—'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
