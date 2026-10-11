import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = [
    { path: '', priority: 1, changeFrequency: 'daily' as const },
    { path: '/menu', priority: 0.9, changeFrequency: 'daily' as const },
    { path: '/menu?category=fast_food', priority: 0.8, changeFrequency: 'daily' as const },
    { path: '/menu?category=regular', priority: 0.8, changeFrequency: 'daily' as const },
    { path: '/menu?category=chinese', priority: 0.8, changeFrequency: 'daily' as const },
    { path: '/track', priority: 0.3, changeFrequency: 'monthly' as const },
  ];
  return pages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
