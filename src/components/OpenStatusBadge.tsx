'use client';

import { useEffect, useState } from 'react';
import { isWithinBusinessHours, BUSINESS_HOURS_LABEL } from '@/lib/businessHours';

interface OpenStatusBadgeProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export default function OpenStatusBadge({ variant = 'light', className = '' }: OpenStatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [label, setLabel] = useState(BUSINESS_HOURS_LABEL);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/store-status');
        if (!res.ok) throw new Error('status unavailable');
        const data = await res.json();
        if (cancelled) return;
        setIsOpen(Boolean(data.open));
        if (data.label) setLabel(data.label);
      } catch {
        if (!cancelled) setIsOpen(isWithinBusinessHours());
      }
    };
    check();
    const interval = setInterval(check, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const openLabel = label.split('–')[0].trim();
  const colorClasses = isOpen
    ? variant === 'dark'
      ? 'bg-white/15 border-white/30 text-white'
      : 'bg-accent2-100 border-accent2-300 text-accent2-800'
    : variant === 'dark'
      ? 'bg-white/10 border-white/20 text-white/80'
      : 'bg-neutral-200 border-neutral-300 text-neutral-700';
  const dotClasses = isOpen
    ? variant === 'dark'
      ? 'bg-accent2-400 animate-pulse'
      : 'bg-accent2-600 animate-pulse'
    : variant === 'dark'
      ? 'bg-white/50'
      : 'bg-neutral-400';

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border whitespace-nowrap ${colorClasses} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClasses}`} />
      {isOpen ? 'Open now' : `Closed — opens ${openLabel}`}
    </span>
  );
}
