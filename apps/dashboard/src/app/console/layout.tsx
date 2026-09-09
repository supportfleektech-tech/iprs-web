'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, type SessionUser } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard-shell';
import { LoadingState } from '@/components/loading-state';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb]">
        <LoadingState label="Loading console" />
      </main>
    );
  }

  return (
    <DashboardShell activePath={pathname} user={user as SessionUser}>
      {children}
    </DashboardShell>
  );
}
