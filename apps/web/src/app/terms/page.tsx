import { SiteFooter, SiteHeader } from '@/components/site-chrome';

export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-bold font-display">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: August 2026</p>
        <div className="mt-8 space-y-6 leading-relaxed text-slate-600">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">1. Service description</h2>
            <p>
              Fleek IPRS provides identity verification services aggregating public and licensed
              data sources. Results must be used in compliance with applicable law, including the
              Kenya Data Protection Act 2019.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">2. Acceptable use</h2>
            <p>
              You may only submit verifications for individuals who have given consent, in
              connection with legitimate business purposes such as KYC, credit assessment or fraud
              prevention. Reselling raw data is prohibited.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">3. Billing</h2>
            <p>
              Successful verifications are billed against your wallet balance at the prices shown in
              your console. Inconclusive lookups are not billed.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">4. Availability</h2>
            <p>
              We target 99.9% API availability. Upstream government systems may occasionally be
              unavailable; such outages do not constitute breach of these terms.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
