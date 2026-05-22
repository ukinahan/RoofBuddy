'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/types';
import { changeStage, schedule, makePublicLink } from './meta-actions';

export default function InspectionMeta({
  id,
  initialStage,
  initialScheduledAt,
}: {
  id: string;
  initialStage: PipelineStage;
  initialScheduledAt: string | null;
}) {
  const [stage, setStage] = useState<PipelineStage>(initialStage);
  const [sched, setSched] = useState(
    initialScheduledAt ? initialScheduledAt.slice(0, 10) : '',
  );
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const onStage = (s: PipelineStage) => {
    setStage(s);
    start(async () => {
      await changeStage(id, s);
      router.refresh();
    });
  };

  const onSched = (v: string) => {
    setSched(v);
    start(async () => {
      await schedule(id, v ? new Date(`${v}T09:00:00`).toISOString() : '');
      router.refresh();
    });
  };

  const makeLink = () => {
    start(async () => {
      const r = await makePublicLink(id);
      if ('token' in r) {
        const url = `${window.location.origin}/quote/${r.token}`;
        setLink(url);
        try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      }
    });
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Pipeline stage
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {PIPELINE_STAGES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStage(opt.value)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  stage === opt.value
                    ? opt.color
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Scheduled for
          </div>
          <input
            type="date"
            value={sched}
            onChange={(e) => onSched(e.target.value)}
            className="mt-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="ml-auto">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Public quote link
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={makeLink}
              disabled={pending}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {pending ? 'Working…' : 'Generate & copy link'}
            </button>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="truncate text-xs text-slate-600 underline hover:text-slate-800"
                style={{ maxWidth: 260 }}
              >
                {link}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
