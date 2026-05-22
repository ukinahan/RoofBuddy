import { redirect } from 'next/navigation';
import { getCurrentUser, getCompanyProfile } from '@/lib/data';
import { signOut } from '../actions';
import GlobalSearch from '@/components/GlobalSearch';
import SideNav from '@/components/SideNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getCompanyProfile().catch(() => null);
  const companyName = profile?.shortName || profile?.name || 'Roof Inspector';

  return (
    <div className="min-h-screen bg-slate-100 md:flex">
      <SideNav companyName={companyName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-4 px-6 py-3">
            <div className="flex-1">
              <GlobalSearch />
            </div>
            <span className="hidden text-xs text-slate-500 sm:inline">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
