import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { PRODUCTS } from '@/lib/products';

export const metadata = { title: 'Products' };

export default function ProductsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-20">
        <h1 className="text-4xl font-bold font-display">Verification products</h1>
        <p className="mt-4 max-w-2xl text-slate-500">
          Every check returns structured, machine-readable results — from the dashboard or the API.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {PRODUCTS.map((p) => (
            <Link
              key={p.slug}
              href={`/products/${p.slug}`}
              className="group rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-brand/50 hover:shadow-md"
            >
              <h2 className="text-xl font-semibold group-hover:text-teal-brand">{p.title}</h2>
              <p className="mt-2 text-slate-500">{p.description}</p>
              <span className="mt-4 inline-block text-sm font-medium text-teal-brand">Explore →</span>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
