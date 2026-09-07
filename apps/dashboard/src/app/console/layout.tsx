'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/console', label: 'Verify', icon: '🔍' },
  { href: '/console/bulk', label: 'Bulk', icon: '📦' },
  { href: '/console/history', label: 'History', icon: '📋' },
  { href: '/console/wallet', label: 'Wallet', icon: '💰' },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading console…</div>
      </main>
    );
  }

  const nav = user.isPlatformAdmin ? [...NAV, { href: '/admin', label: 'Admin', icon: '⚙️' }] : NAV;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col bg-navy-900 text-white">
        <div className="p-5 text-xl font-bold font-display">
          Fleek<span className="brand-gradient-text">IPRS</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-white/10 text-teal-brand font-medium'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 text-sm">
          <div className="mb-2 truncate text-slate-300" title={user.email}>
            {user.email}
          </div>
          <button onClick={logout} className="text-xs text-slate-400 hover:text-white cursor-pointer">
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 overflow-auto bg-slate-50">{children}</div>
    </div>
  );
}
