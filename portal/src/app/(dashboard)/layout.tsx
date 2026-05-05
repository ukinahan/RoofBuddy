import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, getCompanyProfile } from '@/lib/data';
import { signOut } from '../actions';

const NAV = [
  { href: '/', label: 'Inspections' },
  { href: '/customers', label: 'Customers' },
  { href: '/sharing', label: 'Sharing' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getCompanyProfile().catch(() => null);
  const companyName = profile?.shortName || profile?.name || 'Roof Inspector';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-bold text-slate-800">
              🏠 {companyName}
            </Link>
            <nav className="flex gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
