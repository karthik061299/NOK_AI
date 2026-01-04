import React, { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

export interface ToastProps {
  id: number;
  message: string;
  type: 'success';
  onClose: (id: number) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 3000); // 3 seconds
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const icon = type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-4 flex items-center gap-4 w-80 animate-in slide-in-from-top-4 duration-300">
      {icon}
      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1">{message}</p>
      <button onClick={() => onClose(id)} className="ml-auto p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-full">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
