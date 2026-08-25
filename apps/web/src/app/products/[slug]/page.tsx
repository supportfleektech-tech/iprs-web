import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { PRODUCTS } from '@/lib/products';

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = PRODUCTS.find((p) => p.slug === params.slug);
  return { title: product?.title ?? 'Product' };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = PRODUCTS.find((p) => p.slug === params.slug);
  if (!product) notFound();

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero-grid-bg bg-navy-900 py-16 text-white">
          <div className="mx-auto max-w-6xl px-6">
            <h1 className="text-4xl font-bold font-display">{product.title}</h1>
            <p className="mt-4 max-w-2xl text-slate-300">{product.description}</p>
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
          </div>

          <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm h-fit">
            <h3 className="font-semibold">Try it now</h3>
            <p className="text-sm text-slate-500">Run this check from the console or via the REST API with a sandbox key.</p>
            <Link
              href="http://localhost:3001/console"
              className="block rounded-lg bg-teal-brand px-4 py-2.5 text-center text-sm font-semibold text-navy-950 hover:bg-teal-light"
            >
              Open console
            </Link>
            <Link
              href="/developers"
              className="block rounded-lg border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold hover:border-teal-brand"
            >
              View API docs
            </Link>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
