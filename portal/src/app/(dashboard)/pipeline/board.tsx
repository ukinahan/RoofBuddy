'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/types';
import type { InspectionSummary } from '@/lib/features';
import { moveStage } from './actions';

function money(n: number | null, currency: string) {
  if (n == null) return '';
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export default function PipelineBoard({ items }: { items: InspectionSummary[] }) {
  const [local, setLocal] = useState(items);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const byStage: Record<PipelineStage, InspectionSummary[]> = {
    lead: [], inspected: [], quoted: [], accepted: [], scheduled: [], completed: [],
  };
  for (const it of local) byStage[it.pipelineStage].push(it);

  const onDrop = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/inspection-id');
    if (!id) return;
    setLocal((prev) =>
      prev.map((x) => (x.id === id ? { ...x, pipelineStage: stage } : x)),
    );
    startTransition(async () => {
      await moveStage(id, stage);
      router.refresh();
    });
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map((stage) => {
        const col = byStage[stage.value];
        return (
          <div
            key={stage.value}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, stage.value)}
            className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-200/60 p-2"
          >
            <div className="flex items-center justify-between px-2 py-1">
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stage.color}`}>
                {stage.label}
              </span>
              <span className="text-xs text-slate-500">{col.length}</span>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {col.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/inspection-id', card.id)}
                  className="cursor-grab rounded-lg bg-white p-3 shadow-sm hover:shadow active:cursor-grabbing"
                >
                  <Link href={`/inspections/${card.id}`} className="block">
                    <div className="text-sm font-semibold text-slate-800">
                      {card.customerName || '—'}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 line-clamp-2">{card.address || '—'}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{card.photoCount} 📷</span>
                      {card.quoteTotal != null && (
                        <span className="font-semibold text-slate-700">
                          {money(card.quoteTotal, card.currency)}
                        </span>
                      )}
                    </div>
                    {card.scheduledAt && (
                      <div className="mt-1 text-[11px] text-amber-700">
                        🗓 {new Date(card.scheduledAt).toLocaleDateString()}
                      </div>
                    )}
                  </Link>
                </div>
              ))}
              {col.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-300 p-3 text-center text-[11px] text-slate-400">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
