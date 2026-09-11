import { SiteFooter, SiteHeader } from '@/components/site-chrome';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-bold font-display">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: August 2026</p>
        <div className="mt-8 space-y-6 leading-relaxed text-slate-600">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">1. Who we are</h2>
            <p>
              Fleek IPRS is operated by Fleektech LTD ("we"), a company registered in Kenya. We act
              as a data processor on behalf of our clients, who submit verification requests about
              their own customers.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">2. Data we process</h2>
            <p>
              Verification inputs (e.g. National ID numbers), the results returned by authoritative
              sources, account details of client users, and consent records linking each check to
              the entity that collected it.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">3. How we protect data</h2>
            <p>
              Personal data is encrypted at rest using AES-256 field-level encryption, transmitted
              over TLS, and never written to application logs. Access is role-restricted and fully
              audited.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              4. Your rights under the DPA
            </h2>
            <p>
              Under the Kenya Data Protection Act 2019 you may request access, correction or
              deletion of your personal data by contacting support@fleektech.co.ke. We respond
              within statutory timelines.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">5. Retention</h2>
            <p>
              Verification records are retained for the period required for audit and legal
              compliance, after which they are securely deleted.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
