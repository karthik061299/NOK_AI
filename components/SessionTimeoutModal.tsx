
import React, { useState, useEffect } from 'react';
import { AlertTriangle, LogOut, ShieldCheck } from 'lucide-react';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  onLogout: () => void;
  onStay: () => void;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({ isOpen, onLogout, onStay }) => {
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (isOpen) {
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            onLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen, onLogout]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-4 text-amber-500 mb-6">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-200 dark:border-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Session Timeout Warning</h3>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
          You've been inactive for a while. For your security, you will be automatically logged out.
        </p>
        <div className="text-center my-8">
          <p className="text-sm text-zinc-500 mb-2">Logging out in...</p>
          <div className="text-6xl font-bold font-mono text-indigo-600 dark:text-indigo-400">{countdown}</div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={onLogout} 
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-200 dark:border-zinc-800"
          >
            <LogOut className="w-4 h-4" /> Logout Now
          </button>
          <button 
            onClick={onStay} 
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/20"
          >
            <ShieldCheck className="w-4 h-4" /> Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
};
