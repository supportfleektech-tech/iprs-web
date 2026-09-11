import type { MetadataRoute } from 'next';
import { PRODUCTS } from '@/lib/products';

const BASE = 'https://fleekiprs.co.ke';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    '',
    '/products',
    '/developers',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
  }));
  const productPages = PRODUCTS.map((p) => ({
    url: `${BASE}/products/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));
  return [...staticPages, ...productPages];
}
