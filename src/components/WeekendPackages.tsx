'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useCart } from '@/context/CartContext';
import { useToast } from './ToastProvider';
import { Product } from '@/types';

interface WeekendPackage {
  id: number;
  name: string;
  description: string;
  includes: string[];
  price: number;
  serves: string | null;
  product_id: number | null;
}

export default function WeekendPackages() {
  const [packages, setPackages] = useState<WeekendPackage[]>([]);
  const { addToCart } = useCart();
  const toast = useToast();

  useEffect(() => {
    supabase
      .from('weekend_packages')
      .select('id, name, description, includes, price, serves, product_id, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setPackages((data as WeekendPackage[]) || []));
  }, []);

  if (packages.length === 0) return null;

  return (
    <section id="weekend" className="container mx-auto px-4 py-16">
      <p className="text-[13px] uppercase tracking-wide font-semibold text-accent-700 text-center">Friday to Sunday</p>
      <h2 className="text-4xl text-center mb-3">Weekend packages</h2>
      <p className="text-center text-neutral-500 mb-10">On when the kitchen turns them on. Off, they disappear from here.</p>
      <div className="grid md:grid-cols-3 gap-6">
        {packages.map((item) => (
          <article key={item.id} className="card-glass p-6 flex flex-col">
            <h3 className="text-2xl">{item.name}</h3>
            {item.serves ? <p className="text-sm text-accent-700 mt-1">{item.serves}</p> : null}
            <p className="text-text/70 mt-3">{item.description}</p>
            <ul className="mt-4 text-sm text-text/80 list-disc pl-5 space-y-1">
              {item.includes.map((part) => <li key={part}>{part}</li>)}
            </ul>
            <div className="mt-auto pt-5 flex items-center justify-between gap-3">
              <span className="font-display text-xl">₦{item.price.toLocaleString()}</span>
              <button
                type="button"
                className="btn-primary"
                disabled={!item.product_id}
                onClick={() => {
                  if (!item.product_id) return;
                  const product: Product = {
                    id: item.product_id,
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    category: 'weekend',
                    image_url: '',
                    is_available: true,
                    created_at: '',
                  };
                  addToCart(product);
                  toast(`${item.name} added`, 'success');
                }}
              >
                Add
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
