'use client';

import Link from 'next/link';
import { DashboardIcon, type DashboardIconName } from './dashboard-icons';

export interface NavItem {
  href: string;
  label: string;
  icon: DashboardIconName;
}

export const consoleNavItems: NavItem[] = [
  { href: '/console', label: 'Overview', icon: 'grid' },
  { href: '/console/verify', label: 'Verify', icon: 'search' },
  { href: '/console/bulk', label: 'Bulk', icon: 'layers' },
  { href: '/console/history', label: 'History', icon: 'clipboard' },
  { href: '/console/wallet', label: 'Wallet', icon: 'wallet' },
];

export const adminNavItem: NavItem = { href: '/admin', label: 'Admin', icon: 'settings' };

export function isNavActive(activePath: string, href: string): boolean {
  if (href === '/console') return activePath === '/console' || activePath === '/console/';
  return activePath === href || activePath.startsWith(`${href}/`);
}

export function DashboardNav({
  items,
  activePath,
  variant = 'rail',
}: {
  items: NavItem[];
  activePath: string;
  variant?: 'rail' | 'collapsed' | 'mobile';
}) {
  if (variant === 'collapsed') {
    return (
      <nav aria-label="Primary navigation" className="flex flex-col items-center gap-1 px-2 py-4">
        {items.map((item) => {
          const active = isNavActive(activePath, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
              className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <DashboardIcon
                name={item.icon}
                className={`h-5 w-5 ${active ? 'text-teal-300' : ''}`}
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </nav>
    );
  }

  if (variant === 'mobile') {
    return (
      <nav aria-label="Mobile navigation" className="space-y-1 px-4 py-6">
        {items.map((item) => {
          const active = isNavActive(activePath, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <DashboardIcon name={item.icon} className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Primary navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        Workspace
      </div>
      {items.map((item) => {
        const active = isNavActive(activePath, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${
              active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <DashboardIcon
              name={item.icon}
              className={`h-5 w-5 shrink-0 transition-colors ${active ? 'text-teal-300' : 'text-slate-500 group-hover:text-slate-300'}`}
              aria-hidden="true"
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
