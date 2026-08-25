'use client';

import { useState } from 'react';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { Button, FieldError, Input, Label } from '@fleek/ui';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Failed to send');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-4xl font-bold font-display">Talk to us</h1>
        <p className="mt-4 text-slate-500">
          Questions about pricing, data sources or integration? We reply within one business day.
        </p>

        {sent ? (
          <div className="mt-10 rounded-xl border border-teal-brand/40 bg-teal-brand/5 p-8 text-center">
            <div className="text-3xl">✅</div>
            <h2 className="mt-3 text-lg font-semibold">Message received</h2>
            <p className="mt-1 text-sm text-slate-500">Our team will get back to you shortly.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input id="name" required value={form.name} onChange={set('name')} />
              </div>
              <div>
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" required value={form.email} onChange={set('email')} />
              </div>
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input id="company" placeholder="Optional" value={form.company} onChange={set('company')} />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                required
                minLength={10}
                rows={5}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-brand"
                value={form.message}
                onChange={set('message')}
              />
            </div>
            <FieldError>{error}</FieldError>
            <Button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send message'}
            </Button>
          </form>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
