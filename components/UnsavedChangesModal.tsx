
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface UnsavedChangesModalProps {
  onStay: () => void;
  onLeave: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({ onStay, onLeave }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-4 text-amber-500 mb-6">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-200 dark:border-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Unsaved Changes</h3>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
          You have unsaved changes. Do you want to leave without saving?
        </p>
        <div className="flex gap-3">
          <button 
            onClick={onStay}
            className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-200 dark:border-zinc-800">
            Stay on Page
          </button>
          <button 
            onClick={onLeave}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-red-600/20">
            Leave Anyway
          </button>
        </div>
        <button onClick={onStay} className="absolute top-4 right-4 text-zinc-500 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
