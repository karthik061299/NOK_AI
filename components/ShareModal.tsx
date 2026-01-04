import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { dbService } from '../services/db';
import { UserPlus, X, Search, Loader2, User as UserIcon, Check } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'agent' | 'workflow' | 'tool' | 'knowledgeBase' | 'guardrail';
  itemId: string;
  itemName: string;
  currentUser: User;
  onSuccess: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, itemType, itemId, itemName, currentUser, onSuccess }) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [sharedWithUserIds, setSharedWithUserIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const [users, sharedUsers] = await Promise.all([
            dbService.getAllUsers(),
            dbService.getSharedUsersForItem(itemId)
          ]);
          setAllUsers(users.filter(u => u.id !== currentUser.id)); // Exclude self
          const sharedIds = sharedUsers.map(u => u.id);
          setSharedWithUserIds(sharedIds);
          setSelectedUserIds(sharedIds);
        } catch (e) {
          console.error("Failed to load users for sharing:", e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, itemId, currentUser.id]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter(user => 
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allUsers, searchQuery]);

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await dbService.shareItemWithUsers(itemId, itemType, selectedUserIds);
      onSuccess();
      onClose();
    } catch (e) {
      console.error("Failed to save sharing settings:", e);
      alert("An error occurred while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20">
              <UserPlus className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Grant Access to "{itemName}"</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Selected users will have full edit and delete permissions.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors -mt-2 -mr-2"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search users by email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto -mr-4 pr-4 space-y-2 scrollbar-thin">
          {isLoading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
          ) : (
            filteredUsers.map(user => (
              <button key={user.id} onClick={() => handleToggleUser(user.id)} className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${selectedUserIds.includes(user.id) ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center"><UserIcon className="w-4 h-4 text-zinc-500" /></div>
                  <div>
                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{user.email}</div>
                    <div className="text-xs text-zinc-500">{user.role}</div>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${selectedUserIds.includes(user.id) ? 'bg-indigo-600 border-indigo-600' : 'border-zinc-300 dark:border-zinc-600'}`}>
                  {selectedUserIds.includes(user.id) && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3 pt-6 mt-4 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-200 dark:border-zinc-800">Cancel</button>
          <button onClick={handleSaveChanges} disabled={isSaving} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};