'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Inspections', icon: '📋' },
  { href: '/pipeline', label: 'Pipeline', icon: '🗂️' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/map', label: 'Map', icon: '🗺️' },
  { href: '/customers', label: 'Customers', icon: '👥' },
  { href: '/warranty', label: 'Warranty', icon: '🛡️' },
  { href: '/sharing', label: 'Sharing', icon: '🔗' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function SideNav({ companyName }: { companyName: string }) {
  const pathname = usePathname() || '/';

  return (
    <aside className="border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <Link href="/" className="truncate font-bold text-slate-800">
          🏠 {companyName}
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:gap-0.5 md:overflow-visible md:px-3 md:py-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
