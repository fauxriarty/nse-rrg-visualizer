'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; variant: ToastVariant; duration: number };

const ToastContext = createContext<{ show: (message: string, variant?: ToastVariant, duration?: number) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, variant: ToastVariant = 'info', duration = 2500) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, variant, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-24 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`min-w-[220px] max-w-sm px-3 py-2 rounded-lg border shadow-lg text-sm
              ${t.variant === 'success' ? 'bg-green-600/20 border-green-500/40 text-green-200' : ''}
              ${t.variant === 'error' ? 'bg-red-600/20 border-red-500/40 text-red-200' : ''}
              ${t.variant === 'info' ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : ''}
            `}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  const success = (m: string, d?: number) => ctx.show(m, 'success', d);
  const error = (m: string, d?: number) => ctx.show(m, 'error', d);
  const info = (m: string, d?: number) => ctx.show(m, 'info', d);
  return { show: ctx.show, success, error, info };
}
