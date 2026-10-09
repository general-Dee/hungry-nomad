import Image from 'next/image';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabaseClient';
import { withRetry } from '@/lib/fetchWithRetry';
import ProductCard from '@/components/ProductCard';
import OpenStatusBadge from '@/components/OpenStatusBadge';
import WeekendPackages from '@/components/WeekendPackages';

async function getFeatured() {
  try {
    const data = await withRetry(
      async (signal) => {
        const { data, error } = await supabase.from('products').select('*').limit(8).abortSignal(signal);
        if (error) throw error;
        return data;
      },
      { attempts: 2, timeoutMs: 6000 }
    );
    return (data || []).filter((p) => p.is_available !== false).slice(0, 4);
  } catch (error) {
    const placeholder = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').includes('example.supabase.co');
    if (placeholder) return [];
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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(232,93,4,0.12),_transparent_36%),linear-gradient(180deg,_#fffaf5_0%,_#fff_70%)]" aria-hidden="true" />
        <div className="container relative mx-auto px-4 py-14 lg:py-20">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-accent-700">Welcome to Hungry Nomad</p>
              <h1 className="mt-4 max-w-[12ch] font-display text-text" style={{ fontSize: 'clamp(44px,6vw,68px)', lineHeight: 0.96 }}>
                Order food from Kaduna's kitchen
              </h1>
              <p className="mt-6 max-w-[42ch] text-[18px] leading-relaxed text-text/75">
                Grills, Nigerian plates and Chinese dishes, cooked to order and delivered to your door.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <OpenStatusBadge />
                <span className="text-sm text-text/60">Fresh, local, delivered</span>
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/menu" className="btn-primary">Start an order</Link>
                <Link href="#featured" className="btn-secondary">See what's cooking</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {featured.filter((item) => item.image_url).slice(0, 3).map((item, index) => (
                <Link
                  key={item.id}
                  href="/menu"
                  className={`relative overflow-hidden rounded-3xl bg-surface ${index === 0 ? 'col-span-2 h-64 sm:h-80' : 'h-40 sm:h-48'}`}
                >
                  <Image src={item.image_url} alt={item.name} fill priority={index === 0} sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10 text-sm font-semibold text-white">{item.name}</span>
                </Link>
              ))}
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
          <Link
            href="/menu?category=beverages"
            className="card-glass p-6 text-center group transition-all hover:shadow-xl hover:-translate-y-1 sm:col-span-2 lg:col-span-4"
          >
            <h3 className="text-xl">Beverages</h3>
            <p className="text-neutral-500 mt-2">Drinks to go with the meal.</p>
          </Link>
        </div>
      </section>

      <WeekendPackages />

      {/* Featured dishes section */}
      {featured.length > 0 && (
        <section id="featured" className="py-16 bg-surface">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl text-center mb-4">Signature Dishes</h2>
            <p className="text-center text-neutral-500 mb-12">Chef’s selection of our most loved meals</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {featured.map((product, i) => <ProductCard key={product.id} product={product} priority={i === 0} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
