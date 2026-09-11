'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, type SessionUser } from '@/lib/auth';
import { DashboardIcon } from './dashboard-icons';
import { adminNavItem, consoleNavItems, DashboardNav } from './dashboard-nav';

export interface DashboardShellProps {
  activePath: string;
  user: SessionUser;
  children: React.ReactNode;
  onLogout?: () => void;
}

export function DashboardShell({ activePath, user, children, onLogout }: DashboardShellProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, activePath]);

  const handleLogout = onLogout ?? logout;
  const navItems = user.isPlatformAdmin ? [...consoleNavItems, adminNavItem] : consoleNavItems;
  const userInitial = user.firstName?.[0]?.toUpperCase() ?? user.email[0]?.toUpperCase() ?? 'U';
  const displayName =
    user.firstName || user.lastName
      ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
      : user.email;

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#0A1628]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:h-11 focus:items-center focus:rounded-xl focus:bg-navy-900 focus:px-4 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2"
      >
        Skip to main content
      </a>

      {/* Desktop rail — lg+ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-navy-900 text-white lg:flex">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-400/25">
            <DashboardIcon name="shield" className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-tight">
              Fleek <span className="text-teal-300">IPRS</span>
            </div>
            <div className="truncate text-[11px] leading-none text-slate-400">
              Identity operations
            </div>
          </div>
        </div>

        <DashboardNav items={navItems} activePath={activePath} variant="rail" />

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-xs font-semibold text-teal-300 ring-1 ring-inset ring-teal-400/25"
              aria-hidden="true"
            >
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{displayName}</div>
              <div className="truncate text-[11px] text-slate-400">{user.email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 flex h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
          >
            <DashboardIcon name="logout" className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Collapsed tablet rail — md to lg */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center border-r border-slate-200 bg-navy-900 text-white md:flex lg:hidden">
        <div className="flex h-16 w-full items-center justify-center border-b border-white/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-400/25">
            <DashboardIcon name="shield" className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <DashboardNav items={navItems} activePath={activePath} variant="collapsed" />

        <div className="mt-auto flex w-full flex-col items-center gap-2 border-t border-white/10 py-4">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/15 text-xs font-semibold text-teal-300 ring-1 ring-inset ring-teal-400/25"
            aria-hidden="true"
          >
            {userInitial}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
          >
            <DashboardIcon name="logout" className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* Content wrapper — offset for rails */}
      <div className="md:pl-16 lg:pl-64">
        {/* Mobile top bar — < md */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:hidden">
          <Link
            href="/console"
            className="flex items-center gap-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 rounded-lg"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy-900 text-teal-300">
              <DashboardIcon name="shield" className="h-4 w-4" aria-hidden="true" />
            </span>
            Fleek <span className="text-teal-500">IPRS</span>
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setMobileOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
          >
            <DashboardIcon
              name={mobileOpen ? 'close' : 'menu'}
              className="h-5 w-5"
              aria-hidden="true"
            />
          </button>
        </header>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            id="mobile-nav-panel"
            className="fixed inset-0 z-30 bg-navy-900/95 backdrop-blur-sm md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4 text-white">
              <span className="font-semibold">
                Fleek <span className="text-teal-300">IPRS</span>
              </span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
              >
                <DashboardIcon name="close" className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <DashboardNav items={navItems} activePath={activePath} variant="mobile" />
            <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
              <div className="mb-3 truncate text-sm text-slate-300">{user.email}</div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
              >
                <DashboardIcon name="logout" className="h-4 w-4" aria-hidden="true" /> Sign out
              </button>
            </div>
          </div>
        )}

        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-[calc(100dvh-4rem)] outline-none md:min-h-screen"
        >
          <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-4 lg:px-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
