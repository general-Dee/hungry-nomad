'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { metaPixelEvent } from '@/lib/tracking';

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

export default function TrackingScripts() {
  const pathname = usePathname();

  useEffect(() => {
    const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    if (metaPixelId && !document.querySelector('#meta-pixel-script')) {
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

  useEffect(() => {
    metaPixelEvent('PageView');
  }, [pathname]);

  return null;
}