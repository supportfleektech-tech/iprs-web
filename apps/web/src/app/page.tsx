import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { PRODUCTS } from '@/lib/products';

const STATS = [
  { value: '99.9%', label: 'API uptime' },
  { value: '<2s', label: 'Average response' },
  { value: '4+', label: 'Data sources integrated' },
  { value: '24/7', label: 'Support & monitoring' },
];

const WHY = [
  ['Real-time IPRS access', 'Validate identities against the national registry in milliseconds.'],
  ['Fraud prevention', 'SIM-swap and ownership checks stop account takeovers early.'],
  ['Compliance-ready', 'Consent capture and audit trails built into every verification.'],
  ['Developer-first', 'Clean REST APIs with sandbox keys from day one.'],
  ['Bank-grade security', 'PII encrypted at rest; no sensitive data in logs.'],
  ['Built for scale', 'From a first loan to millions of checks without re-architecture.'],
];

const SECTORS = [
  ['Digital Lenders', 'Disburse confidently with instant identity and fraud screening.'],
  ['Banks & MFBs', 'Strengthen onboarding KYC with government-backed data.'],
  ['SACCOs', 'Know your members with reliable, affordable checks.'],
  ['Fintechs', 'Embed verified identity into any product via one API.'],
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      {/* Hero */}
      <section className="hero-grid-bg bg-navy-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-brand/40 bg-teal-brand/10 px-4 py-1 text-xs font-medium text-teal-brand">
            <span className="relative inline-block h-2 w-2 rounded-full bg-teal-brand pulse-ring" />
            Live in Kenya — powered by Fleektech LTD
          </span>
          <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight font-display">
            Verify anyone. <span className="brand-gradient-text">Instantly.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            Fleek IPRS gives lenders, SACCOs and fintechs real-time identity verification against IPRS,
            KRA, telecom and mobile-money records — through one clean API.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="http://localhost:3001/register"
              className="rounded-xl bg-teal-brand px-7 py-3 font-semibold text-navy-950 transition-colors hover:bg-teal-light"
            >
              Start verifying
            </Link>
            <Link
              href="/developers"
              className="rounded-xl border border-white/20 px-7 py-3 font-semibold transition-colors hover:border-teal-brand hover:text-teal-brand"
            >
              Read the docs
            </Link>
          </div>

          {/* Fake terminal */}
          <div className="mx-auto mt-16 max-w-xl rounded-xl border border-white/10 bg-navy-950/80 p-5 text-left shadow-2xl">
            <div className="mb-3 flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-3 text-xs text-slate-500">POST /v1/verifications</span>
            </div>
            <pre className="overflow-x-auto text-xs leading-relaxed text-slate-300">
              <code>{`curl https://api.fleekiprs.co.ke/v1/verifications \\
  -H "Authorization: Bearer flk_live_…" \\
  -d '{"type": "iprs_id", "idNumber": "12345678"}'

# → {"status":"success",
#    "result":{"fullName":"FAITH SAMUEL KAMAU",
#              "dateOfBirth":"1982-01-18"}}`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold brand-gradient-text font-display">{s.value}</div>
              <div className="mt-1 text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold font-display">Powerful verification tools</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-500">
            One platform, multiple authoritative data sources.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PRODUCTS.map((p) => (
              <Link
                key={p.slug}
                href={`/products/${p.slug}`}
                className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-brand/50 hover:shadow-md"
              >
                <h3 className="font-semibold group-hover:text-teal-brand">{p.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{p.short}</p>
                <span className="mt-4 inline-block text-sm font-medium text-teal-brand">Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold font-display">Why Fleek IPRS</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {WHY.map(([title, body]) => (
              <div key={title} className="rounded-xl border border-slate-100 p-6">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-brand/10 text-lg">✓</div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sectors */}
      <section className="hero-grid-bg bg-navy-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold font-display">
            Built for every institution that needs to <span className="brand-gradient-text">know</span>
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {SECTORS.map(([title, body]) => (
              <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold font-display">Start verifying in minutes</h2>
          <p className="mt-4 text-slate-500">
            Create an organization, request credit, and run your first check today.
          </p>
          <Link
            href="http://localhost:3001/register"
            className="mt-8 inline-block rounded-xl bg-navy-900 px-8 py-3 font-semibold text-white transition-colors hover:bg-navy-800"
          >
            Create free account
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
