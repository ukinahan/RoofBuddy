'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { dismiss } from './actions';

export default function DismissButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await dismiss(id);
          router.refresh();
        })
      }
      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? 'Dismissing…' : 'Dismiss'}
    </button>
  );
}
