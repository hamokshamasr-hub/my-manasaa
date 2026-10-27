import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setToasts(prev => [...prev.slice(-3), { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {/* Toast Notification Container */}
      <div 
        className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2.5 max-w-md w-full px-4 pointer-events-none"
        dir="rtl"
      >
        <AnimatePresence>
          {toasts.map(toast => {
            const isSuccess = toast.type === 'success';
            const isError = toast.type === 'error';
            const isWarning = toast.type === 'warning';

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                className={`pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-md border transition-all ${
                  isSuccess
                    ? 'bg-emerald-900/90 dark:bg-emerald-950/95 border-emerald-500/40 text-emerald-100 shadow-emerald-950/40'
                    : isError
                    ? 'bg-rose-900/90 dark:bg-rose-950/95 border-rose-500/40 text-rose-100 shadow-rose-950/40'
                    : isWarning
                    ? 'bg-amber-900/90 dark:bg-amber-950/95 border-amber-500/40 text-amber-100 shadow-amber-950/40'
                    : 'bg-slate-900/90 dark:bg-slate-950/95 border-slate-700/60 text-slate-100 shadow-slate-950/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-300" />}
                    {isError && <AlertCircle className="w-5 h-5 text-rose-300" />}
                    {isWarning && <AlertTriangle className="w-5 h-5 text-amber-300" />}
                    {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-300" />}
                  </div>
                  <p className="text-sm font-bold leading-relaxed break-words">
                    {toast.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                  aria-label="إغلاق التنبيه"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if used outside provider
    return {
      showToast: (msg: string) => {
        console.log('[Toast]', msg);
      },
      dismissToast: () => {}
    };
  }
  return context;
}
