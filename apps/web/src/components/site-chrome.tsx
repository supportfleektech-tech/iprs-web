import Link from 'next/link';

const NAV = [
  { href: '/products', label: 'Products' },
  { href: '/developers', label: 'Developers' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={`text-xl font-bold font-display ${dark ? 'text-white' : 'text-navy-900'}`}>
      Fleek<span className="brand-gradient-text">IPRS</span>
    </Link>
  );
}

export function SiteHeader({ dark = false }: { dark?: boolean }) {
  return (
    <header className={dark ? 'bg-navy-900' : 'border-b border-slate-100 bg-white'}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo dark={dark} />
        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm ${dark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-navy-900'}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="http://localhost:3001/login"
            className={`hidden text-sm md:inline ${dark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-navy-900'}`}
          >
            Login
          </Link>
          <Link
            href="http://localhost:3001/register"
            className="rounded-lg bg-teal-brand px-4 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-teal-light"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-navy-950 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-4">
        <div>
          <Logo dark />
          <p className="mt-3 text-sm text-slate-400">
            Identity intelligence for Africa. A product of{' '}
            <a href="https://fleektech.co.ke" className="text-teal-brand hover:underline" rel="noopener noreferrer">
              Fleektech LTD
            </a>
            .
          </p>
          <p className="mt-4 text-xs text-slate-500">Nairobi, Kenya · support@fleektech.co.ke</p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Products</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/products/iprs-id" className="hover:text-teal-brand">IPRS ID Verification</Link></li>
            <li><Link href="/products/kra-pin" className="hover:text-teal-brand">KRA PIN Checker</Link></li>
            <li><Link href="/products/hakikisha" className="hover:text-teal-brand">Hakikisha / Phone Check</Link></li>
            <li><Link href="/products/sim-swap" className="hover:text-teal-brand">SIM-swap Detection</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Company</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/about" className="hover:text-teal-brand">About</Link></li>
            <li><Link href="/developers" className="hover:text-teal-brand">Developers</Link></li>
            <li><Link href="/contact" className="hover:text-teal-brand">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Legal</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/privacy" className="hover:text-teal-brand">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-teal-brand">Terms of Service</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Fleektech LTD. All rights reserved.
      </div>
    </footer>
  );
}
