import { SiteFooter, SiteHeader } from '@/components/site-chrome';

export const metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-bold font-display">About Fleek IPRS</h1>
        <div className="mt-8 space-y-5 leading-relaxed text-slate-600">
          <p>
            Fleek IPRS is an identity verification platform built by{' '}
            <a href="https://fleektech.co.ke" className="text-teal-brand hover:underline">
              Fleektech LTD
            </a>
            , a Kenyan technology company. We help financial institutions, SACCOs and digital businesses
            confirm who their customers really are — in seconds, not days.
          </p>
          <p>
            Our platform connects authoritative data sources — the Integrated Population Registration
            System, KRA, telecom subscriber records and mobile-money KYC — behind a single, clean API.
            Every verification captures consent and produces an audit trail, keeping you aligned with
            the Kenya Data Protection Act.
          </p>
          <p>
            Whether you are onboarding your ten-thousandth customer or running your first loan, Fleek
            IPRS scales with you: start in sandbox with deterministic mock data, then switch to live
            sources with one configuration change.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {[
            ['Mission', 'Make trusted identity accessible to every business in Africa.'],
            ['Values', 'Accuracy, privacy and developer joy.'],
            ['Home', 'Nairobi, Kenya — serving the continent.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl bg-slate-50 p-6">
              <h2 className="font-semibold">{t}</h2>
              <p className="mt-1 text-sm text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
