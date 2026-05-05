'use client';

import { useState, useTransition } from 'react';
import { inviteShare } from './actions';

export default function SharingForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; status?: string; error?: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('email', email);
      fd.append('role', role);
      const r = await inviteShare(fd);
      setResult(r);
      if (r.ok) setEmail('');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Invite by email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="assistant@yourcompany.com"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? 'Inviting…' : 'Invite'}
        </button>
      </div>

      {result?.ok && (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Access granted. They&apos;ll see your data the next time they sign in.
        </div>
      )}
      {result?.ok === false && (
        <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {result.error}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        The person you invite must sign in to{' '}
        <a href="https://admin.roofinspector.app" className="underline" target="_blank">
          admin.roofinspector.app
        </a>{' '}
        with this email at least once before you grant access.
      </p>
    </form>
  );
}
