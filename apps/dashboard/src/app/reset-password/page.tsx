'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, FieldError, Input, Label } from '@fleek/ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? 'Reset failed');
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
      <Link href="/" className="mb-6 block text-center text-2xl font-bold font-display">
        Fleek<span className="brand-gradient-text">IPRS</span>
      </Link>

      {done ? (
        <div className="text-center">
          <div className="text-3xl">✅</div>
          <h1 className="mt-3 text-lg font-semibold">Password updated</h1>
          <p className="mt-2 text-sm text-slate-500">Redirecting you to sign in…</p>
        </div>
      ) : (
        <>
          <h1 className="text-lg font-semibold">Choose a new password</h1>
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <div>
              <Label htmlFor="password">New password (min 8 characters)</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <FieldError>{error}</FieldError>
            {!token && <FieldError>Missing reset token — use the link from your email.</FieldError>}
            <Button type="submit" disabled={busy || !token} className="w-full">
              {busy ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-900 hero-grid-bg px-4">
      <Suspense fallback={<div className="animate-pulse text-white/50">Loading…</div>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
