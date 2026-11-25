import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((kind: ToastKind, title: string, description?: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setItems((prev) => [...prev.slice(-3), { id, kind, title, description }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="no-print fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
      >
        {items.map((item) => {
          const icon =
            item.kind === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#21966B]" />
            ) : item.kind === 'error' ? (
              <XCircle className="h-4 w-4 shrink-0 text-[#D95364]" />
            ) : item.kind === 'warning' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#D99A32]" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-[#4387D9]" />
            );

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-xl border border-[#E4E5ED] bg-white p-3.5 shadow-lg shadow-[#20243A]/8"
            >
              <div className="mt-0.5">{icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#20243A]">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-[#777D91]">{item.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-[#777D91] transition-colors hover:bg-[#F3F4F8] hover:text-[#20243A]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
