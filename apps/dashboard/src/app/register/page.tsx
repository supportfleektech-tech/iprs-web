'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Label, FieldError } from '@fleek/ui';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    organizationName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      router.push('/console');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-900 hero-grid-bg px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <Link href="/" className="mb-6 block text-center text-2xl font-bold font-display">
          Fleek<span className="brand-gradient-text">IPRS</span>
        </Link>
        <h1 className="text-lg font-semibold">Create your organization</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Already registered?{' '}
          <Link href="/login" className="text-teal-brand hover:underline">
            Sign in
          </Link>
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" required value={form.firstName} onChange={set('firstName')} />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" required value={form.lastName} onChange={set('lastName')} />
            </div>
          </div>
          <div>
            <Label htmlFor="org">Organization name</Label>
            <Input id="org" required value={form.organizationName} onChange={set('organizationName')} placeholder="Acme Lender Ltd" />
          </div>
          <div>
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" required value={form.email} onChange={set('email')} />
          </div>
          <div>
            <Label htmlFor="password">Password (min 8 characters)</Label>
            <Input id="password" type="password" required minLength={8} value={form.password} onChange={set('password')} />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </form>
      </div>
    </main>
  );
}
