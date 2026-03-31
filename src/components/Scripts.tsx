'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { GA_MEASUREMENT_ID, pageview, metaPixelEvent } from '@/lib/tracking';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
    fbq: (...args: unknown[]) => void;
  }
}

export default function TrackingScripts() {
  const pathname = usePathname();

  // Load GA4 and Meta Pixel scripts once
  useEffect(() => {
    // Google Analytics 4
    if (GA_MEASUREMENT_ID && !document.querySelector('#ga-script')) {
      const script = document.createElement('script');
      script.id = 'ga-script';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      script.async = true;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function (...args: unknown[]) {
        window.dataLayer.push(args);
      };
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID);
    }

    // Meta Pixel
    const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    if (metaPixelId && !document.querySelector('#meta-pixel-script')) {
      // Load the Facebook Pixel script
      const script = document.createElement('script');
      script.id = 'meta-pixel-script';
      script.innerHTML = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${metaPixelId}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(script);
    }
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (GA_MEASUREMENT_ID) pageview(pathname);
    metaPixelEvent('PageView');
  }, [pathname]);

  return null;
}