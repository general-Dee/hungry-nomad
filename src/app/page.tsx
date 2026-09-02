import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabaseClient';
import { withRetry } from '@/lib/fetchWithRetry';
import ProductCard from '@/components/ProductCard';
import OpenStatusBadge from '@/components/OpenStatusBadge';
import HeroSlider from '@/components/HeroSlider';

async function getFeatured() {
  try {
    const data = await withRetry(
      async (signal) => {
        const { data, error } = await supabase.from('products').select('*').limit(3).abortSignal(signal);
        if (error) throw error;
        return data;
      },
      { attempts: 2, timeoutMs: 6000 }
    );
    return data || [];
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

function BurgerIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 7.5C3 5 6 3 10 3s7 2 7 4.5" />
      <path d="M2.5 9.5h15" />
      <path d="M2.5 12.5h15" />
      <path d="M3 15.5h14" />
    </svg>
  );
}

function BowlIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2.5 10h15" />
      <path d="M3 10a7 6 0 0 0 14 0" />
      <path d="M10 9.5V6" />
      <path d="M7 7V4.5" />
      <path d="M13 7V4.5" />
    </svg>
  );
}

function TakeoutBoxIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 8h12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z" />
      <path d="M4 8 6 3h8l2 5" />
      <path d="M10 8v9" />
    </svg>
  );
}

function IceCreamIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10 18 7 9h6l-3 9Z" />
      <circle cx="10" cy="6" r="3.5" />
    </svg>
  );
}

export default async function Home() {
  const featured = await getFeatured();

  return (
    <div className="overflow-hidden">
      {/* ========== HERO SECTION ========== */}
      <section className="relative">
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            {/* Left column */}
            <div>
              <p className="text-[13px] uppercase tracking-wide font-semibold text-accent-700">
                Kaduna&apos;s own
              </p>
              <h1
                className="font-display text-text mt-3"
                style={{ fontSize: 'clamp(38px,5vw,60px)', lineHeight: 1.05, maxWidth: '11ch' }}
              >
                Hungry Nomad
              </h1>
              <p className="max-w-[46ch] text-text/80 text-[17px] leading-relaxed mt-5">
                Fast food, traditional Nigerian dishes and Chinese cuisine — made fresh and delivered across Kaduna.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-800 text-xs font-semibold">
                  🛵 Fast local delivery
                </span>
                <OpenStatusBadge />
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/menu" className="btn-primary">
                  Explore menu
                </Link>
                <Link href="#featured" className="btn-secondary">
                  View specials
                </Link>
              </div>
            </div>

            {/* Right column: hero image slider */}
            <div className="relative">
              <div className="absolute -top-10 -right-10 w-[400px] h-[400px] rounded-full bg-accent2-200 -z-10" aria-hidden="true" />
              <HeroSlider slides={featured.map((p) => ({ src: p.image_url, alt: p.name }))} />
            </div>
          </div>
        </div>
      </section>

      {/* Category cards */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <Link
            href="/menu?category=fast_food"
            className="card-glass p-6 text-center group transition-all hover:shadow-xl hover:-translate-y-1"
          >
            <div className="w-11 h-11 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <BurgerIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xl">Fast Food</h3>
            <p className="text-neutral-500 mt-2">Burgers, fried chicken, wraps – made fresh.</p>
          </Link>

          <Link
            href="/menu?category=regular"
            className="card-glass p-6 text-center group transition-all hover:shadow-xl hover:-translate-y-1"
          >
            <div className="w-11 h-11 rounded-full bg-accent2-100 text-accent2-700 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <BowlIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xl">Regular Dishes</h3>
            <p className="text-neutral-500 mt-2">Jollof, egusi, pounded yam – authentic Nigerian.</p>
          </Link>

          <Link
            href="/menu?category=chinese"
            className="card-glass p-6 text-center group transition-all hover:shadow-xl hover:-translate-y-1"
          >
            <div className="w-11 h-11 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <TakeoutBoxIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xl">Chinese Cuisine</h3>
            <p className="text-neutral-500 mt-2">Fried rice, noodles, sweet & sour chicken.</p>
          </Link>

          <Link
            href="/menu?category=icecream"
            className="card-glass p-6 text-center group transition-all hover:shadow-xl hover:-translate-y-1"
          >
            <div className="w-11 h-11 rounded-full bg-accent2-100 text-accent2-700 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <IceCreamIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xl">Ice Cream</h3>
            <p className="text-neutral-500 mt-2">Creamy, refreshing desserts for every craving.</p>
          </Link>
        </div>
      </section>

      {/* Featured dishes section */}
      {featured.length > 0 && (
        <section id="featured" className="py-16 bg-surface">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl text-center mb-4">Signature Dishes</h2>
            <p className="text-center text-neutral-500 mb-12">Chef’s selection of our most loved meals</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {featured.map((product, i) => <ProductCard key={product.id} product={product} priority={i === 0} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
