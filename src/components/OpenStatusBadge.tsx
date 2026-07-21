'use client';

import { useEffect, useState } from 'react';
import { isWithinBusinessHours, BUSINESS_HOURS_LABEL } from '@/lib/businessHours';

// "11:00am – 9:30pm" -> "11:00am"
const OPEN_TIME_LABEL = BUSINESS_HOURS_LABEL.split('–')[0].trim();

interface OpenStatusBadgeProps {
  /** 'light' for use on light/white backgrounds (e.g. the header), 'dark' for use on the dark hero. */
  variant?: 'light' | 'dark';
  className?: string;
}

export default function OpenStatusBadge({ variant = 'light', className = '' }: OpenStatusBadgeProps) {
  // Default to `true` (mirrors the pattern used in checkout) so we render something
  // reasonable during SSR/hydration rather than flashing a "closed" state.
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const check = () => setIsOpen(isWithinBusinessHours());
    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const colorClasses = isOpen
    ? variant === 'dark'
      ? 'bg-white/15 border-white/30 text-white'
      : 'bg-green-500/10 border-green-500/30 text-green-700'
    : variant === 'dark'
      ? 'bg-white/10 border-white/20 text-white/80'
      : 'bg-neutral-500/10 border-neutral-400/30 text-neutral-500';

  const dotClasses = isOpen
    ? variant === 'dark'
      ? 'bg-green-400 animate-pulse'
      : 'bg-green-500 animate-pulse'
    : variant === 'dark'
      ? 'bg-white/50'
      : 'bg-neutral-400';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border whitespace-nowrap ${colorClasses} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClasses}`} />
      {isOpen ? 'Open now' : `Closed — opens ${OPEN_TIME_LABEL}`}
    </span>
  );
}
