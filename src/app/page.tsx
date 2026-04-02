import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import ProductCard from '@/components/ProductCard';

async function getFeatured() {
  const { data } = await supabase.from('products').select('*').limit(6);
  return data || [];
}

export default async function Home() {
  const featured = await getFeatured();

  return (
    <div className="overflow-hidden">
      {/* ========== ENHANCED HERO SECTION ========== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900 via-orange-700 to-red-800 animate-gradient-xy"></div>
        
        {/* Floating food icons (particle effect) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 text-6xl animate-float-delayed">🍔</div>
          <div className="absolute bottom-32 right-16 text-7xl animate-float-slow">🍛</div>
          <div className="absolute top-1/3 right-1/4 text-5xl animate-float">🥡</div>
          <div className="absolute bottom-40 left-1/3 text-4xl animate-float-slow">🍜</div>
          <div className="absolute top-1/2 left-5 text-5xl animate-float-delayed">🍗</div>
          <div className="absolute bottom-20 right-1/3 text-5xl animate-float">🍦</div>
        </div>

        {/* Overlay for text readability */}
        <div className="absolute inset-0 bg-black/30"></div>

        {/* Hero content */}
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto text-white">
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight leading-tight">
            <span className="inline-block animate-bounce-in">Hungry</span>{' '}
            <span className="inline-block text-amber-300 animate-bounce-in-delay">Nomad</span>
          </h1>
          <p className="text-xl md:text-2xl mt-6 font-light max-w-2xl mx-auto leading-relaxed">
            Savor the best of Kaduna – Fast Food, Traditional Delicacies, Chinese Cuisine & Ice Cream.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/menu" className="btn-primary bg-white text-amber-700 hover:bg-amber-50 shadow-lg transform hover:scale-105 transition-all duration-300">
              Explore Menu
            </Link>
            <Link href="#featured" className="btn-secondary bg-white/20 backdrop-blur-md border-white/40 text-white hover:bg-white/30">
              View Specials
            </Link>
          </div>
          
          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce cursor-pointer">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* Decorative wave at bottom */}
        <div className="absolute bottom-0 w-full">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-16 md:h-24">
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" fill="white" opacity="0.9"></path>
          </svg>
        </div>
      </section>

      {/* ✅ Clickable feature cards (now 4) */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <Link
            href="/menu?category=fast_food"
            className="card-glass p-6 text-center group transition-all hover:shadow-xl hover:-translate-y-1"
          >
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">🍔</div>
            <h3 className="text-xl font-bold">Fast Food</h3>
            <p className="text-neutral-500 mt-2">Burgers, fried chicken, wraps – made fresh.</p>
          </Link>

          <Link
            href="/menu?category=regular"
            className="card-glass p-6 text-center group transition-all hover:shadow-xl hover:-translate-y-1"
          >
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">🍛</div>
            <h3 className="text-xl font-bold">Regular Dishes</h3>
            <p className="text-neutral-500 mt-2">Jollof, egusi, pounded yam – authentic Nigerian.</p>
          </Link>

          <Link
            href="/menu?category=chinese"
            className="card-glass p-6 text-center group transition-all hover:shadow-xl hover:-translate-y-1"
          >
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">🥡</div>
            <h3 className="text-xl font-bold">Chinese Cuisine</h3>
            <p className="text-neutral-500 mt-2">Fried rice, noodles, sweet & sour chicken.</p>
          </Link>

          <Link
            href="/menu?category=icecream"
            className="card-glass p-6 text-center group transition-all hover:shadow-xl hover:-translate-y-1"
          >
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">🍦</div>
            <h3 className="text-xl font-bold">Ice Cream</h3>
            <p className="text-neutral-500 mt-2">Creamy, refreshing desserts for every craving.</p>
          </Link>
        </div>
      </section>

      {/* Featured dishes section */}
      {featured.length > 0 && (
        <section id="featured" className="py-16 bg-neutral-50/50">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center mb-4">Signature Dishes</h2>
            <p className="text-center text-neutral-500 mb-12">Chef’s selection of our most loved meals</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {featured.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}