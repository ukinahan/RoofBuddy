'use client';

import { useState, useTransition } from 'react';
import { saveInspection } from './actions';
import type { Inspection, InspectionPhoto, QuoteLineItem, PhotoSeverity } from '@/lib/types';

const SEVERITY_OPTIONS: { value: PhotoSeverity; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'low', label: 'Low', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'none', label: 'None', color: 'bg-slate-100 text-slate-700 border-slate-300' },
];

export default function InspectionEditor({
  inspection,
  photoUrls,
}: {
  inspection: Inspection;
  photoUrls: Record<string, string>;
}) {
  const [insp, setInsp] = useState<Inspection>(inspection);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<Inspection>) => setInsp((p) => ({ ...p, ...patch }));

  const updatePhoto = (id: string, patch: Partial<InspectionPhoto>) => {
    setInsp((p) => ({
      ...p,
      photos: p.photos.map((ph) => (ph.id === id ? { ...ph, ...patch } : ph)),
    }));
  };

  const updateQuoteItem = (id: string, patch: Partial<QuoteLineItem>) => {
    setInsp((p) => ({
      ...p,
      quoteItems: (p.quoteItems ?? []).map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  };

  const addQuoteItem = () => {
    const newItem: QuoteLineItem = {
      id: cryptoRandomId(),
      description: '',
      qty: 1,
      unitPrice: 0,
    };
    setInsp((p) => ({ ...p, quoteItems: [...(p.quoteItems ?? []), newItem] }));
  };

  const removeQuoteItem = (id: string) => {
    setInsp((p) => ({ ...p, quoteItems: (p.quoteItems ?? []).filter((it) => it.id !== id) }));
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveInspection(insp);
      if (!res.ok) setError(res.error ?? 'Failed to save.');
      else setSavedAt(new Date().toLocaleTimeString());
    });
  };

  const quoteTotal = (insp.quoteItems ?? []).reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const currency = insp.quoteCurrency || 'EUR';

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <input
              value={insp.customerName}
              onChange={(e) => update({ customerName: e.target.value })}
              className="w-full text-2xl font-bold text-slate-800 outline-none focus:ring-1 focus:ring-slate-300 rounded px-1"
              placeholder="Customer name"
            />
            <input
              value={insp.address}
              onChange={(e) => update({ address: e.target.value })}
              className="mt-2 w-full text-sm text-slate-600 outline-none focus:ring-1 focus:ring-slate-300 rounded px-1"
              placeholder="Address"
            />
            <div className="mt-2 text-xs text-slate-500">
              Inspection date:{' '}
              <input
                type="date"
                value={insp.date ? insp.date.substring(0, 10) : ''}
                onChange={(e) => update({ date: e.target.value })}
                className="ml-1 outline-none focus:ring-1 focus:ring-slate-300 rounded"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/pdf/${insp.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Download PDF
            </a>
            <a
              href={`/api/quote/${insp.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Download Quote
            </a>
            <a
              href={`/inspections/${insp.id}/email`}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Email…
            </a>
            <button
              onClick={handleSave}
              disabled={pending}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
        {savedAt && <div className="mt-3 text-xs text-emerald-700">Saved at {savedAt}</div>}
        {error && (
          <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
      </div>

      {/* Office notes */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Office notes
        </h2>
        <textarea
          value={insp.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value })}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          placeholder="Add notes here. These will appear in the PDF report."
        />
      </div>

      {/* Photos */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
          Photos ({insp.photos.length})
        </h2>
        {insp.photos.length === 0 ? (
          <p className="text-sm text-slate-500">No photos for this inspection.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {insp.photos.map((photo) => (
              <div key={photo.id} className="rounded-lg border border-slate-200 p-3">
                {photoUrls[photo.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrls[photo.id]}
                    alt=""
                    className="aspect-[4/3] w-full rounded object-cover"
                  />
                ) : (
                  <div className="aspect-[4/3] w-full rounded bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                    Photo not yet synced
                  </div>
                )}
                <textarea
                  value={photo.notes}
                  onChange={(e) => updatePhoto(photo.id, { notes: e.target.value })}
                  rows={2}
                  placeholder="Photo notes"
                  className="mt-3 w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {SEVERITY_OPTIONS.map((opt) => {
                    const active = photo.severity === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updatePhoto(photo.id, { severity: opt.value })}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          active
                            ? opt.color
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quote */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Quote line items
          </h2>
          <button
            onClick={addQuoteItem}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Add line
          </button>
        </div>
        {(insp.quoteItems ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No quote items.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2 font-semibold">Description</th>
                <th className="pb-2 font-semibold w-20">Qty</th>
                <th className="pb-2 font-semibold w-28">Unit price</th>
                <th className="pb-2 font-semibold w-28 text-right">Subtotal</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(insp.quoteItems ?? []).map((it) => (
                <tr key={it.id}>
                  <td className="py-2">
                    <input
                      value={it.description}
                      onChange={(e) => updateQuoteItem(it.id, { description: e.target.value })}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                      placeholder="Replace ridge tiles…"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      value={it.qty}
                      onChange={(e) =>
                        updateQuoteItem(it.id, { qty: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={it.unitPrice}
                      onChange={(e) =>
                        updateQuoteItem(it.id, { unitPrice: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 text-right text-sm tabular-nums">
                    {formatCurrency(it.qty * it.unitPrice, currency)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => removeQuoteItem(it.id)}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300">
                <td colSpan={3} className="pt-3 text-right text-sm font-bold uppercase text-slate-500">
                  Total
                </td>
                <td className="pt-3 text-right text-sm font-bold tabular-nums">
                  {formatCurrency(quoteTotal, currency)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
