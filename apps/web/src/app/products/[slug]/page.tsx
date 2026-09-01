import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { PRODUCTS, getProductBySlug } from '@/lib/products';
import { APP_URL } from '@/lib/app-url';

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = getProductBySlug(params.slug);
  return { title: product ? `${product.title} | Fleek IPRS` : 'Product Not Found' };
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(price);
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-slate-50">
        {/* Hero */}
        <section className="hero-grid-bg bg-navy-900 py-16 text-white">
          <div className="mx-auto max-w-6xl px-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-brand/10 text-teal-brand px-3 py-1 text-sm font-medium mb-4">
              {product.category}
            </span>
            <h1 className="text-4xl font-bold font-display">{product.title}</h1>
            <p className="mt-4 max-w-2xl text-slate-300">{product.description}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-semibold text-teal-brand">{formatPrice(product.basePriceKes)}/check</span>
              {product.vatExclusive && <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">VAT Exclusive</span>}
              {product.cbConsentRequired && <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">CB Consent Required</span>}
              {product.requiresFileUpload && <span className="px-2 py-1 rounded-full bg-slate-500/20 text-slate-400">File Upload</span>}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-10">
            {/* You provide / We return */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">You provide</div>
                <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 font-mono text-sm">{product.inputExample}</div>
                <div className="mt-2 text-sm text-slate-500">{product.inputLabel}</div>
                {product.requiresFileUpload && (
                  <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs text-blue-800 font-medium">File upload required</p>
                    <p className="text-xs text-blue-700 mt-1">Accepted: {product.fileTypes.join(', ')}</p>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-teal-brand/40 bg-teal-brand/5 p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-teal-brand">We return instantly</div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {product.outputs.map((o) => (
                    <li key={o} className="flex items-center gap-2">
                      <span className="text-teal-brand">✓</span> {o}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Features */}
            <div>
              <h2 className="text-xl font-semibold">Features</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {product.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 rounded-lg bg-slate-50 p-4 text-sm">
                    <span className="text-teal-brand">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Volume Pricing */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold mb-4">Volume-tiered pricing (VAT Exclusive)</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="pb-2 font-semibold">Monthly Volume</th>
                      <th className="pb-2 font-semibold text-right">Price/Check</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-600">
                    {product.slug === 'spin_score_only' ? (
                      <>
                        <tr className="border-b border-slate-100"><td className="py-2">1 – 1,000</td><td className="py-2 text-right font-medium">{formatPrice(130)}</td></tr>
                        <tr className="border-b border-slate-100 bg-slate-50"><td className="py-2">1,001 – 5,000</td><td className="py-2 text-right font-medium">{formatPrice(125)}</td></tr>
                        <tr className="border-b border-slate-100"><td className="py-2">5,001 – 10,000</td><td className="py-2 text-right font-medium">{formatPrice(120)}</td></tr>
                        <tr className="border-b border-slate-100 bg-slate-50"><td className="py-2">10,001 – 20,000</td><td className="py-2 text-right font-medium">{formatPrice(115)}</td></tr>
                        <tr className="border-b border-slate-100"><td className="py-2">20,001 – 50,000</td><td className="py-2 text-right font-medium">{formatPrice(105)}</td></tr>
                        <tr className="bg-slate-50"><td className="py-2">50,000 – 100,000</td><td className="py-2 text-right font-medium">{formatPrice(95)}</td></tr>
                      </>
                    ) : product.slug === 'scanned_statement' ? (
                      <tr className="bg-slate-50"><td className="py-2" colSpan={2}>KES 120 + KES 4 per page</td></tr>
                    ) : product.slug === 'creditinfo_crb_status' || product.slug === 'creditinfo_comprehensive' ? (
                      <tr className="bg-slate-50"><td className="py-2" colSpan={2}>Flat rate: {formatPrice(product.basePriceKes)} (no volume tiers)</td></tr>
                    ) : (
                      <>
                        <tr className="border-b border-slate-100"><td className="py-2">0 – 500</td><td className="py-2 text-right font-medium">{formatPrice(product.basePriceKes)}</td></tr>
                        <tr className="border-b border-slate-100 bg-slate-50"><td className="py-2">501 – 2,500</td><td className="py-2 text-right font-medium">{formatPrice(Math.round(product.basePriceKes * 0.93))}</td></tr>
                        <tr className="border-b border-slate-100"><td className="py-2">2,501 – 5,000</td><td className="py-2 text-right font-medium">{formatPrice(Math.round(product.basePriceKes * 0.87))}</td></tr>
                        <tr className="border-b border-slate-100 bg-slate-50"><td className="py-2">5,001 – 10,000</td><td className="py-2 text-right font-medium">{formatPrice(Math.round(product.basePriceKes * 0.8))}</td></tr>
                        <tr className="border-b border-slate-100"><td className="py-2">10,001 – 30,000</td><td className="py-2 text-right font-medium">{formatPrice(Math.round(product.basePriceKes * 0.73))}</td></tr>
                        <tr className="bg-slate-50"><td className="py-2">30,001+</td><td className="py-2 text-right font-medium">{formatPrice(Math.round(product.basePriceKes * 0.67))}</td></tr>
                      </>
                    )}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-400">
                  Prices are VAT exclusive. Backup rates available on primary source failure (explicit toggle required).
                  {product.cbConsentRequired && ' Credit bureau consent (cbConsent) required for this product.'}
                </p>
              </div>
            </div>
          </div>

          <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm h-fit">
            <h3 className="font-semibold">Try it now</h3>
            <p className="text-sm text-slate-500 mb-4">Run this check from the console or via the REST API with a sandbox key.</p>
            <Link
              href={`${APP_URL}/console`}
              className="block rounded-lg bg-teal-brand px-4 py-2.5 text-center text-sm font-semibold text-navy-950 hover:bg-teal-light"
            >
              Open console
            </Link>
            <Link
              href="/developers"
              className="block mt-3 rounded-lg border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold hover:border-teal-brand"
            >
              View API docs
            </Link>
            <Link
              href="/pricing"
              className="block mt-3 text-sm text-teal-brand hover:underline text-center"
            >
              View all pricing →
            </Link>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}