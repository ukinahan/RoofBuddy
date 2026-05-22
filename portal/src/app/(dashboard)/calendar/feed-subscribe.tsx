'use client';

import { useState, useTransition } from 'react';
import { getCalendarFeedToken } from './feed-actions';

export default function FeedSubscribe() {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const generate = () => {
    setError(null);
    setCopied(false);
    start(async () => {
      const r = await getCalendarFeedToken();
      if (!r.token) {
        setError(r.error ?? 'Could not generate subscription URL.');
        return;
      }
      const u = `${window.location.origin}/api/calendar/${r.token}.ics`;
      setUrl(u);
      try {
        await navigator.clipboard.writeText(u);
        setCopied(true);
      } catch {
        /* clipboard may be denied — user can copy manually */
      }
    });
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Sync to your phone
      </h3>
      <p className="mt-1 text-xs text-slate-600">
        Generate a private subscription URL, then paste it into Apple Calendar,
        Google Calendar, or Outlook to see scheduled jobs on your phone. The feed
        updates automatically.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? 'Working…' : url ? 'Regenerate / re-copy' : 'Generate subscription URL'}
        </button>
        {url && (
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700"
          />
        )}
        {copied && <span className="text-xs text-emerald-700">Copied ✓</span>}
      </div>
      {error && (
        <div className="mt-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}
      {url && (
        <details className="mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold">How to subscribe</summary>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              <strong>iPhone:</strong> Settings → Calendar → Accounts → Add Account →
              Other → Add Subscribed Calendar → paste the URL.
            </li>
            <li>
              <strong>Google Calendar (web):</strong> + Other calendars → From URL →
              paste the URL.
            </li>
            <li>
              <strong>Outlook:</strong> Add calendar → Subscribe from web → paste the URL.
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">
            Keep this URL private — anyone with it can see your scheduled jobs.
          </p>
        </details>
      )}
    </div>
  );
}
