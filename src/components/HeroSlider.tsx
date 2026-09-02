'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

const AUTO_ADVANCE_MS = 3000;
const RESUME_DELAY_MS = 4000;

interface HeroSlide {
  src: string;
  alt: string;
}

export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current !== null) {
      clearInterval(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimeoutRef.current !== null) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ left: index * container.clientWidth, behavior: 'smooth' });
  }, []);

  const startAutoAdvance = useCallback(() => {
    if (slides.length <= 1) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    clearAutoAdvance();
    autoAdvanceRef.current = setInterval(() => {
      const nextIndex = (activeIndexRef.current + 1) % slides.length;
      scrollToIndex(nextIndex);
    }, AUTO_ADVANCE_MS);
  }, [slides.length, clearAutoAdvance, scrollToIndex]);

  const scheduleResume = useCallback(() => {
    clearResumeTimer();
    resumeTimeoutRef.current = setTimeout(() => {
      resumeTimeoutRef.current = null;
      startAutoAdvance();
    }, RESUME_DELAY_MS);
  }, [clearResumeTimer, startAutoAdvance]);

  const handleInteractionStart = useCallback(() => {
    clearAutoAdvance();
    clearResumeTimer();
  }, [clearAutoAdvance, clearResumeTimer]);

  const handleInteractionEnd = useCallback(() => {
    scheduleResume();
  }, [scheduleResume]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const width = container.clientWidth;
      if (!width) return;
      const index = Math.min(slides.length - 1, Math.max(0, Math.round(container.scrollLeft / width)));
      if (index !== activeIndexRef.current) {
        activeIndexRef.current = index;
        setActiveIndex(index);
      }
    });
  }, [slides.length]);

  const handleDotClick = useCallback(
    (index: number) => {
      scrollToIndex(index);
      clearAutoAdvance();
      scheduleResume();
    },
    [scrollToIndex, clearAutoAdvance, scheduleResume]
  );

  useEffect(() => {
    startAutoAdvance();
    return () => {
      clearAutoAdvance();
      clearResumeTimer();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (slides.length === 0) {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[56px]">
        <div className="h-full w-full bg-surface" />
      </div>
    );
  }

  if (slides.length === 1) {
    const slide = slides[0];
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[56px]">
        <div className="relative h-full w-full">
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover object-top scale-[1.18] origin-top saturate-[0.6] contrast-[0.85] brightness-110 opacity-95"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[56px]">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onPointerDown={handleInteractionStart}
        onPointerUp={handleInteractionEnd}
        onTouchStart={handleInteractionStart}
        onTouchEnd={handleInteractionEnd}
        role="group"
        aria-roledescription="carousel"
        aria-label="Featured dishes"
        className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, index) => (
          <div key={`${slide.src}-${index}`} className="relative h-full w-full flex-shrink-0 snap-center">
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={index === 0}
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover object-top scale-[1.18] origin-top saturate-[0.6] contrast-[0.85] brightness-110 opacity-95"
            />
          </div>
        ))}
      </div>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => handleDotClick(index)}
            aria-label={`Go to slide ${index + 1} of ${slides.length}`}
            aria-current={index === activeIndex}
            className={`h-2 rounded-full transition-all ${
              index === activeIndex ? 'w-6 bg-bg' : 'w-2 bg-bg/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
