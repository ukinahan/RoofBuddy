'use client';

import { useState, useTransition } from 'react';
import { sendInspectionEmail } from './actions';

export default function EmailForm({
  inspectionId,
  customerName,
  address,
}: {
  inspectionId: string;
  customerName: string;
  address: string;
}) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(`Roof inspection report — ${customerName}`);
  const [body, setBody] = useState(
    `Hi ${customerName.split(' ')[0] || 'there'},\n\nPlease find attached the roof inspection report for ${address}.\n\nLet us know if you have any questions.\n`,
  );
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('id', inspectionId);
      fd.append('to', to);
      fd.append('cc', cc);
      fd.append('subject', subject);
      fd.append('body', body);
      const r = await sendInspectionEmail(fd);
      setResult(r);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <Field label="To" value={to} onChange={setTo} type="email" required placeholder="customer@example.com" />
      <Field label="CC (optional)" value={cc} onChange={setCc} placeholder="you@yourcompany.com" />
      <Field label="Subject" value={subject} onChange={setSubject} required />
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send email'}
        </button>
        {result?.ok && (
          <span className="text-sm text-emerald-700">Sent ✓</span>
        )}
      </div>
      {result?.ok === false && (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {result.error}
        </div>
      )}
    </form>
  );
}

function Field({
  label, value, onChange, type, required, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
    </label>
  );
}
