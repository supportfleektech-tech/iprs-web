import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';

export const metadata = {
  title: 'Developers — Build with the Fleek IPRS API',
  description:
    'REST API reference, quickstarts and sandbox access for Fleek IPRS identity verification.',
};

const SNIPPET = `# 1. Create a key in the console (flk_test_… for sandbox)
# 2. Run a verification:

curl -X POST https://api.fleekiprs.co.ke/v1/verifications \\
  -H "Authorization: Bearer flk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "iprs_id",
    "idNumber": "12345678",
    "consent": true,
    "consentCollectedBy": "Acme Lender Ltd"
  }'

# → {
#     "id": "clr1x8…",
#     "status": "success",
#     "result": {
#       "fullName": "FAITH SAMUEL KAMAU",
#       "dateOfBirth": "1982-01-18",
#       "serialNumber": "11701540"
#     },
#     "cost": 50
#   }`;

const ENDPOINTS = [
  ['POST', '/v1/verifications', 'Run a verification (JWT session or API key)'],
  ['GET', '/v1/verifications/:id', 'Fetch full result for one request'],
  ['GET', '/v1/verifications', 'Paginated history with type filter'],
  ['GET', '/v1/wallet', 'Wallet balance'],
  ['POST', '/v1/keys', 'Create an API key'],
];

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader />
      <main className="hero-grid-bg bg-navy-900">
        <div className="mx-auto max-w-6xl px-6 py-20 text-white">
          <h1 className="text-4xl font-bold font-display">
            Designed for <span className="brand-gradient-text">developers</span>
          </h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            One REST endpoint to verify anyone. Sandbox keys return deterministic mock data so you
            can integrate before going live.
          </p>

          <div className="mt-12 grid gap-8 lg:grid-cols-5">
            <pre className="overflow-x-auto rounded-xl border border-white/10 bg-navy-950/80 p-6 text-xs leading-relaxed text-slate-300 lg:col-span-3">
              <code>{SNIPPET}</code>
            </pre>
            <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h2 className="font-semibold">Endpoints</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {ENDPOINTS.map(([method, path, desc]) => (
                  <li
                    key={path + method}
                    className="border-b border-white/5 pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <span
                        className={`mr-2 rounded px-1.5 py-0.5 text-[11px] font-bold ${method === 'GET' ? 'bg-sky-400/20 text-sky-300' : 'bg-teal-brand/20 text-teal-brand'}`}
                      >
                        {method}
                      </span>
                      <code className="text-slate-200">{path}</code>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
                  </li>
                ))}
              </ul>
              <Link
                href="/contact"
                className="mt-6 block rounded-lg bg-teal-brand px-4 py-2.5 text-center text-sm font-semibold text-navy-950 hover:bg-teal-light"
              >
                Request full docs access
              </Link>
            </div>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              [
                'Sandbox first',
                'Deterministic mock provider mirrors live response shapes exactly.',
              ],
              [
                'Consent built-in',
                'Every call records who collected consent — DPA compliant by default.',
              ],
              ['Per-key rate limits', 'Protect your infrastructure with automatic throttling.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-white/10 bg-white/5 p-6">
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-slate-400">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
