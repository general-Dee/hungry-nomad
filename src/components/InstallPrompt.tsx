'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';

// Not part of the standard lib.dom typings.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'installPromptDismissed';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Browsers that don't support the event (e.g. iOS Safari) simply never
    // fire it — this component just never shows, no error.
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();

      let dismissed = false;
      try {
        dismissed = sessionStorage.getItem(DISMISSED_KEY) === '1';
      } catch {
        // Ignore read failures (e.g. Safari private mode) — treat as not
        // dismissed rather than blocking the prompt from ever showing.
      }
      if (dismissed) return;

      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Ignore write failures — worst case the banner can reappear on a
      // later navigation within the same session.
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      // Ignore — the prompt can reject/no-op in some browsers if it's
      // already been consumed or the user dismissed it via the native UI.
    } finally {
      // A BeforeInstallPromptEvent can only be prompted once.
      setDeferredPrompt(null);
      setVisible(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-x-0 bottom-20 z-40 p-3 md:bottom-5"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-white shadow-lg">
            <ArrowDownTrayIcon className="h-5 w-5 flex-shrink-0 text-accent-400" />
            <p className="flex-1 text-sm">Add Hungry Nomad to your home screen for faster ordering.</p>
            <button
              onClick={handleInstall}
              className="whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-bg"
            >
              Add
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              className="flex-shrink-0 text-neutral-400 hover:text-white"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
