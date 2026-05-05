'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { sendCode, verifyCode } from './actions';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const search = useSearchParams();
  const next = search.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append('email', email);
    const res = await sendCode(fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not send code.');
      return;
    }
    setStep('code');
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append('email', email);
    fd.append('code', code);
    fd.append('next', next);
    const res = await verifyCode(fd);
    // verifyCode redirects on success; we only get here on error.
    setBusy(false);
    if (res && !res.ok) setError(res.error ?? 'Invalid code.');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏠</div>
          <h1 className="text-2xl font-bold text-slate-800">Roof Inspector Admin</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in with your email</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                placeholder="you@yourcompany.com"
                disabled={busy}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send sign-in code'}
            </button>
            <p className="text-xs text-slate-500 text-center">
              No password needed. We&apos;ll email you a code.
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-slate-600 text-center">
              We sent a code to <span className="font-semibold">{email}</span>.
            </p>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Code from email
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-slate-500 focus:outline-none"
                placeholder="— — — — — —"
                disabled={busy}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {busy ? 'Verifying…' : 'Verify code'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); setError(null); }}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Use a different email
            </button>
          </form>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
