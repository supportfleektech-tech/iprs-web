'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, FieldError, Input, Label } from '@fleek/ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Failed to send reset email');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-900 hero-grid-bg px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <Link href="/" className="mb-6 block text-center text-2xl font-bold font-display">
          Fleek<span className="brand-gradient-text">IPRS</span>
        </Link>

        {sent ? (
          <div className="text-center">
            <div className="text-3xl">📬</div>
            <h1 className="mt-3 text-lg font-semibold">Check your inbox</h1>
            <p className="mt-2 text-sm text-slate-500">
              If an account exists for {email}, a password reset link is on its way. It expires in
              one hour.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm text-teal-brand hover:underline"
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Reset your password</h1>
            <p className="mt-1 mb-6 text-sm text-slate-500">
              Enter your work email and we&apos;ll send you a reset link.
            </p>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <FieldError>{error}</FieldError>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm">
              <Link href="/login" className="text-slate-500 hover:text-navy-900">
                ← Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
