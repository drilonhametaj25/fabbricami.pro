'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, type Toast as ToastType } from '@/stores/toastStore';

const icons: Record<ToastType['type'], React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />,
  error: <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />,
};

const borderColors: Record<ToastType['type'], string> = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  info: 'border-l-blue-500',
  warning: 'border-l-yellow-500',
};

export function Toast() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 bg-surface-card border border-white/10 border-l-4 ${borderColors[t.type]} rounded-lg shadow-xl backdrop-blur-sm`}
          >
            {icons[t.type]}
            <p className="text-white text-sm flex-1 pt-0.5">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="text-text-muted hover:text-white transition-colors flex-shrink-0"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
