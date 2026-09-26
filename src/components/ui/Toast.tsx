import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'warning' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'warning' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0e0e0e] border border-white/10 text-white shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2"
          >
            <div className="flex items-center gap-2.5 text-xs">
              {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 text-[#15846e] shrink-0" />}
              {toast.type === 'warning' && <AlertCircle className="h-4 w-4 text-[#ffb829] shrink-0" />}
              {toast.type === 'info' && <Info className="h-4 w-4 text-[#8052ff] shrink-0" />}
              <span className="font-normal text-white">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#9a9a9a] hover:text-white p-1 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};
