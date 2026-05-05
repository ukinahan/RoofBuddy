import { listShares } from './actions';
import SharingForm from './form';

export const dynamic = 'force-dynamic';

export default async function SharingPage() {
  const { shares, migrationMissing, error } = await listShares();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Sharing</h1>
        <p className="mt-1 text-sm text-slate-600">
          Grant another user (e.g. an office assistant) access to your inspections,
          customers, and photos. They will sign in with their own email and see your
          data alongside any of their own.
        </p>
      </div>

      {migrationMissing ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">One-time database setup required</p>
          <p className="mt-1">
            The sharing tables haven&apos;t been created in Supabase yet. Open Supabase
            → SQL Editor → New query, paste the contents of{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">
              supabase/migrations/002_account_sharing.sql
            </code>{' '}
            and click Run. Then refresh this page.
          </p>
        </div>
      ) : error ? (
        <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">Couldn&apos;t load shares</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      <SharingForm />

      <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">People with access</h2>
        </div>
        {shares.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            You haven&apos;t shared your account with anyone yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-4 py-2 font-semibold">Role</th>
                <th className="px-4 py-2 font-semibold">Granted</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shares.map((s) => (
                <tr key={s.member_user_id}>
                  <td className="px-4 py-3 font-semibold text-slate-800">{s.member_email}</td>
                  <td className="px-4 py-3 text-slate-600">{s.role}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(s.created_at).toLocaleDateString('en-IE', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RevokeButton memberId={s.member_user_id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RevokeButton({ memberId }: { memberId: string }) {
  return (
    <form action={async (fd) => { 'use server'; const { revokeShare } = await import('./actions'); await revokeShare(fd); }}>
      <input type="hidden" name="memberId" value={memberId} />
      <button
        type="submit"
        className="text-xs font-semibold text-rose-600 hover:text-rose-800"
      >
        Revoke
      </button>
    </form>
  );
}
