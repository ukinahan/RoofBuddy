'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptQuote } from './actions';

export default function AcceptForm({ token }: { token: string }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData();
        fd.set('token', token);
        fd.set('name', name);
        start(async () => {
          const r = await acceptQuote(fd);
          if (!r.ok) setError(r.error ?? 'Could not accept');
          else router.refresh();
        });
      }}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Accept this quote
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Type your full name and click Accept. We&apos;ll record your acceptance with a
        timestamp.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Accept'}
        </button>
      </div>
      {error && (
        <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}
    </form>
  );
}
