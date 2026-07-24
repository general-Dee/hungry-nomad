'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Toast = {
  id: string;
  message: string;
  type: 'success' | 'error';
};

const ToastContext = createContext((_msg: string, _type: 'success' | 'error') => {});

export const useToast = () => useContext(ToastContext);

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const idCounterRef = useRef(0);

  // Clear any pending auto-dismiss timers on unmount so they don't fire
  // (and call setState) after the provider is gone.
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, []);

  const addToast = (message: string, type: 'success' | 'error') => {
    // Date.now() alone can collide across fast successive calls (e.g. rapid
    // addToCart clicks within the same millisecond); pair it with an
    // incrementing counter so every toast gets a unique id.
    idCounterRef.current += 1;
    const id = `${Date.now()}-${idCounterRef.current}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timeoutId = setTimeout(() => {
      timeoutsRef.current.delete(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
    timeoutsRef.current.set(id, timeoutId);
  };

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-24 right-5 z-50 space-y-2 md:bottom-5">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className={`px-4 py-2 rounded-lg shadow-lg text-white ${
                toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
              }`}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}