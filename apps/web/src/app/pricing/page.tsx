import { Metadata } from 'next';
import Link from 'next/link';
import { PRODUCT_CATEGORIES, getProductsByCategory } from '@/lib/products';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Transparent, volume-tiered pricing for all Fleek IPRS verification products. VAT exclusive.',
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(price);
}

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-slate-50">
        {/* Hero */}
        <section className="hero-grid-bg bg-navy-900 text-white">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <h1 className="text-4xl md:text-5xl font-bold font-display">
              Transparent, volume-based pricing
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
              Pay per successful check. Volume discounts apply automatically. All prices VAT exclusive.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-teal-brand" />
                Live products
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                Sandbox (free)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                Volume discounts
              </span>
            </div>
          </div>
        </section>

        {/* Volume Tiers Explanation */}
        <section className="py-16 bg-white">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-bold font-display">How volume pricing works</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-slate-500">
              Your per-check price drops automatically as your monthly successful verification count increases.
              Tiers reset on the 1st of each calendar month (EAT).
            </p>
            <div className="mt-10 overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2 font-semibold text-navy-900">Monthly Volume</th>
                    <th className="pb-2 font-semibold text-navy-900">Identity Standard</th>
                    <th className="pb-2 font-semibold text-navy-900">Identity Premium</th>
                    <th className="pb-2 font-semibold text-navy-900">Utility</th>
                    <th className="pb-2 font-semibold text-navy-900">Search Phones by ID</th>
                    <th className="pb-2 font-semibold text-navy-900">Motor Vehicle</th>
                    <th className="pb-2 font-semibold text-navy-900">Drivers License</th>
                    <th className="pb-2 font-semibold text-navy-900">Metropol Score</th>
                    <th className="pb-2 font-semibold text-navy-900">Metropol Standard</th>
                    <th className="pb-2 font-semibold text-navy-900">Metropol Full</th>
                    <th className="pb-2 font-semibold text-navy-900">CreditInfo Score</th>
                    <th className="pb-2 font-semibold text-navy-900">CreditInfo Comprehensive</th>
                    <th className="pb-2 font-semibold text-navy-900">CreditInfo CRB Status</th>
                    <th className="pb-2 font-semibold text-navy-900">BRS</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-medium text-navy-900">0 – 500</td>
                    <td>KES 30</td>
                    <td>KES 75</td>
                    <td>KES 20</td>
                    <td>KES 50</td>
                    <td>KES 1,160</td>
                    <td>KES 200 <span className="text-amber-600 text-xs">(backup KES 260)</span></td>
                    <td>KES 85</td>
                    <td>KES 150</td>
                    <td>KES 300</td>
                    <td>KES 50</td>
                    <td>KES 350</td>
                    <td>KES 2,000</td>
                    <td>KES 1,300</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <td className="py-2 font-medium text-navy-900">501 – 2,500</td>
                    <td>KES 28</td>
                    <td>KES 73</td>
                    <td>KES 18</td>
                    <td>KES 48</td>
                    <td>KES 1,140</td>
                    <td>KES 195 <span className="text-amber-600 text-xs">(backup KES 254)</span></td>
                    <td>KES 83</td>
                    <td>KES 147</td>
                    <td>KES 295</td>
                    <td>KES 50</td>
                    <td>KES 350</td>
                    <td>KES 2,000</td>
                    <td>KES 1,280</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-medium text-navy-900">2,501 – 5,000</td>
                    <td>KES 26</td>
                    <td>KES 70</td>
                    <td>KES 16</td>
                    <td>KES 46</td>
                    <td>KES 1,115</td>
                    <td>KES 190 <span className="text-amber-600 text-xs">(backup KES 248)</span></td>
                    <td>KES 80</td>
                    <td>KES 143</td>
                    <td>KES 285</td>
                    <td>KES 50</td>
                    <td>KES 350</td>
                    <td>KES 2,000</td>
                    <td>KES 1,250</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <td className="py-2 font-medium text-navy-900">5,001 – 10,000</td>
                    <td>KES 24</td>
                    <td>KES 66</td>
                    <td>KES 14</td>
                    <td>KES 44</td>
                    <td>KES 1,080</td>
                    <td>KES 180 <span className="text-amber-600 text-xs">(backup KES 238)</span></td>
                    <td>KES 77</td>
                    <td>KES 137</td>
                    <td>KES 275</td>
                    <td>KES 50</td>
                    <td>KES 350</td>
                    <td>KES 2,000</td>
                    <td>KES 1,205</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-medium text-navy-900">10,001 – 30,000</td>
                    <td>KES 22</td>
                    <td>KES 63</td>
                    <td>KES 12</td>
                    <td>KES 40</td>
                    <td>KES 1,040</td>
                    <td>KES 175 <span className="text-amber-600 text-xs">(backup KES 229)</span></td>
                    <td>KES 74</td>
                    <td>KES 132</td>
                    <td>KES 265</td>
                    <td>KES 50</td>
                    <td>KES 350</td>
                    <td>KES 2,000</td>
                    <td>KES 1,160</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="py-2 font-medium text-navy-900">30,001+</td>
                    <td>KES 20</td>
                    <td>KES 60</td>
                    <td>KES 10</td>
                    <td>KES 35</td>
                    <td>KES 1,010</td>
                    <td>KES 170 <span className="text-amber-600 text-xs">(backup KES 221)</span></td>
                    <td>KES 70</td>
                    <td>KES 128</td>
                    <td>KES 250</td>
                    <td>KES 50</td>
                    <td>KES 350</td>
                    <td>KES 2,000</td>
                    <td>KES 1,125</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-slate-400 text-center">
              <strong>SPIN Score</strong> uses special bands: 1–1K: KES 130 | 1K–5K: KES 125 | 5K–10K: KES 120 | 10K–20K: KES 115 | 20K–50K: KES 105 | 50K–100K: KES 95.<br/>
              <strong>Scanned Statement:</strong> KES 120 + KES 4 per page.<br/>
              All prices <strong>VAT exclusive</strong>. Backup rates apply only when explicitly requested after primary source failure.
            </p>
          </div>
        </section>

        {/* Product Cards by Category */}
        <section className="py-20 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-bold font-display">All products</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-slate-500">
              24 verification products across 9 categories. Click any product for details.
            </p>

            {PRODUCT_CATEGORIES.map((category) => {
              const products = getProductsByCategory(category);
              return (
                <section key={category} className="mt-16">
                  <h3 className="flex items-center gap-2 text-xl font-semibold text-navy-900 uppercase tracking-wide mb-6">
                    <span className="w-2 h-6 rounded bg-teal-brand" />
                    {category}
                  </h3>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {products.map((p) => (
                      <Link
                        key={p.slug}
                        href={`/products/${p.slug}`}
                        className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-brand/50 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h4 className="font-semibold group-hover:text-teal-brand">{p.title}</h4>
                          <span className="text-xs font-medium text-teal-brand whitespace-nowrap">
                            {formatPrice(p.basePriceKes)}/check
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mb-3">{p.short}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {p.vatExclusive && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700">VAT Excl.</span>}
                          {p.cbConsentRequired && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">CB Consent</span>}
                          {p.requiresFileUpload && <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">File Upload</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        {/* Wallet Top-up Methods */}
        <section className="py-20 bg-white">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-bold font-display">Wallet top-up methods</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-slate-500">
              Fund your wallet via M-Pesa STK Push, Bank Transfer, or Invoice request.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
                  <span className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">📱</span>
                  M-Pesa STK Push
                </h3>
                <p className="mt-2 text-sm text-slate-500">Instant push to your Safaricom line. Enter PIN to confirm. Minimum KES 100.</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">✅ Real-time credit</li>
                  <li className="flex items-center gap-2">✅ Auto-retry on failure</li>
                  <li className="flex items-center gap-2">✅ Sandbox mode for testing</li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
                  <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">🏦</span>
                  Bank Transfer / Paybill
                </h3>
                <p className="mt-2 text-sm text-slate-500">Manual transfer via NCBA. Wallet credited on confirmation.</p>
                <div className="mt-4 space-y-2 text-sm text-slate-600 font-mono">
                  <div className="rounded bg-slate-50 p-3"><strong>Bank:</strong> NCBA Bank Kenya</div>
                  <div className="rounded bg-slate-50 p-3"><strong>Branch:</strong> Uphill</div>
                  <div className="rounded bg-slate-50 p-3"><strong>Account:</strong> 8402250011</div>
                  <div className="rounded bg-slate-50 p-3"><strong>Name:</strong> SPIN MOBILE LIMITED</div>
                  <div className="rounded bg-slate-50 p-3"><strong>Paybill:</strong> 880100</div>
                  <div className="rounded bg-slate-50 p-3"><strong>Account:</strong> 8402250011</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
                  <span className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">📄</span>
                  Invoice Request
                </h3>
                <p className="mt-2 text-sm text-slate-500">Request an invoice from Fleektech. Minimum KES 1,000. Credited after admin approval.</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">✅ Corporate billing</li>
                  <li className="flex items-center gap-2">✅ Approval workflow</li>
                  <li className="flex items-center gap-2">✅ Audit trail</li>
                </ul>
              </div>
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
              href="/register"
              className="mt-8 inline-block rounded-xl bg-navy-900 px-8 py-3 font-semibold text-white transition-colors hover:bg-navy-800"
            >
              Create free account
            </Link>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}