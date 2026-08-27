'use client';

import Image from 'next/image';
import { memo, useEffect, useRef } from 'react';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useToast } from './ToastProvider';
import { motion } from 'framer-motion';
import { HeartIcon } from '@heroicons/react/24/solid';
import { metaPixelEvent } from '@/lib/tracking';

const CARD_INITIAL = { opacity: 0, y: 20 };
const CARD_WHILE_IN_VIEW = { opacity: 1, y: 0 };
const CARD_VIEWPORT = { once: true };
const CARD_TRANSITION = { duration: 0.4 };
const CARD_EXIT = { opacity: 0, scale: 0.95 };

function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { cart, addToCart, updateQuantity, maxItemQuantity } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const toast = useToast();
  const quantity = cart.find((item) => item.id === product.id)?.quantity ?? 0;
  const favorited = isFavorite(product.id);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // ViewContent: fired once, the first time this card actually enters the
  // viewport. Uses a real IntersectionObserver rather than framer-motion's
  // whileInView, which is presentational-only and not a reliable analytics hook.
  useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          metaPixelEvent('ViewContent', {
            value: product.price,
            currency: 'NGN',
            content_ids: [product.id.toString()],
            content_type: 'product',
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  return (
    <motion.div
      ref={cardRef}
      initial={CARD_INITIAL}
      whileInView={CARD_WHILE_IN_VIEW}
      viewport={CARD_VIEWPORT}
      transition={CARD_TRANSITION}
      exit={CARD_EXIT}
      className="group relative card-glass overflow-hidden"
    >
      <div className="relative h-52 w-full overflow-hidden">
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          priority={priority}
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute top-3 right-3 bg-accent text-bg font-display text-[13px] px-3 py-1 rounded-full shadow-sm">
          ₦{product.price.toLocaleString()}
        </div>
        <button
          type="button"
          onClick={() => toggleFavorite(product.id)}
          aria-label={favorited ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
          aria-pressed={favorited}
          className="absolute top-3 left-3 z-10 bg-bg/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm transition active:scale-90"
        >
          <HeartIcon className={`w-5 h-5 ${favorited ? 'text-accent-600' : 'text-neutral-500'}`} />
        </button>
      </div>
      <div className="p-5">
        <h3 className="font-display text-[19px] text-text">{product.name}</h3>
        <p className="text-text/70 text-[13px] mt-1 line-clamp-2">{product.description}</p>
        {quantity === 0 ? (
          <button
            onClick={() => {
              addToCart(product);
              toast(`✨ ${product.name} added`, 'success');
              metaPixelEvent('AddToCart', {
                value: product.price,
                currency: 'NGN',
                content_ids: [product.id.toString()],
                content_type: 'product',
                contents: [{ id: product.id.toString(), quantity: 1 }],
              });
            }}
            className="btn-primary mt-5 w-full"
          >
            Add to Cart
          </button>
        ) : (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => updateQuantity(product.id, quantity - 1)}
                aria-label={`Decrease quantity of ${product.name}`}
                className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center font-bold text-lg transition active:scale-95"
              >
                −
              </button>
              <span className="font-bold text-lg">{quantity}</span>
              <button
                onClick={() => updateQuantity(product.id, quantity + 1)}
                aria-label={`Increase quantity of ${product.name}`}
                disabled={quantity >= maxItemQuantity}
                className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold text-lg transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
            {quantity >= maxItemQuantity && (
              <p className="text-xs text-accent-600 text-center mt-1">Max {maxItemQuantity} per item</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default memo(ProductCard);