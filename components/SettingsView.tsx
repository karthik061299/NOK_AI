
import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Sun, Moon, CheckCircle2, Loader2, UserCog, Search, X, LifeBuoy } from 'lucide-react';
import { dbService } from '../services/db';
import { User } from '../types';
import { IssueTracker } from './IssueTracker';

interface SettingsViewProps {
  currentTheme: string;
  onThemeChange: (theme: 'light' | 'dark') => void;
  currentUser: User;
}

const ThemeCard: React.FC<{ theme: 'light' | 'dark', currentTheme: string, onSelect: () => void }> = ({ theme, currentTheme, onSelect }) => {
  const isSelected = theme === currentTheme;
  const isLight = theme === 'light';
  return (
    <div onClick={onSelect} className={`cursor-pointer rounded-2xl border-2 p-1 transition-all duration-300 relative overflow-hidden ${isSelected ? 'border-indigo-500 ring-4 ring-indigo-500/20' : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600'}`}>
      <div className={`p-6 rounded-xl ${isLight ? 'bg-zinc-100' : 'bg-zinc-900'}`}><div className="flex space-x-2"><div className={`w-1/3 rounded-md p-2 ${isLight ? 'bg-white' : 'bg-zinc-800'}`}><div className={`h-2 w-3/4 rounded-full ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} /><div className={`h-2 w-1/2 rounded-full mt-1.5 ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} /></div><div className={`flex-1 rounded-md p-2 ${isLight ? 'bg-white' : 'bg-zinc-800'}`}><div className={`h-2 w-full rounded-full ${isLight ? 'bg-indigo-300' : 'bg-indigo-700'}`} /><div className={`h-2 w-5/6 rounded-full mt-1.5 ${isLight ? 'bg-zinc-200' : 'bg-zinc-600'}`} /></div></div><div className={`h-12 mt-2 rounded-md p-2 ${isLight ? 'bg-white' : 'bg-zinc-800'}`} /></div>
      <div className="p-4 flex justify-between items-center bg-white/50 dark:bg-black/20"><div className="flex items-center gap-3">{isLight ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-sky-400" />}<span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{isLight ? 'Light Mode' : 'Dark Mode'}</span></div>{isSelected && <CheckCircle2 className="w-6 h-6 text-indigo-500" />}</div>
    </div>
  );
};

export const SettingsView: React.FC<SettingsViewProps> = ({ currentTheme, onThemeChange, currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleChangeConfirm, setRoleChangeConfirm] = useState<{ user: User, newRole: 'Admin' | 'User' | 'Owner', actionText: string } | null>(null);

  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issueTrackerKey, setIssueTrackerKey] = useState(Date.now());


  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const allUsers = await dbService.getAllUsers();
      setUsers(allUsers);
    } catch (e) {
      console.error("Failed to load users:", e);
      alert("Could not load user data.");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleUpdate = async () => {
    if (!roleChangeConfirm) return;
    try {
      await dbService.updateUserRole(roleChangeConfirm.user.id, roleChangeConfirm.newRole);
      await loadUsers();
    } catch (e) {
      alert("Failed to update user role.");
    } finally {
      setRoleChangeConfirm(null);
    }
  };

  const handleIssueSubmit = async () => {
    if (!issueDescription.trim()) return;
    setIsSubmitting(true);
    try {
      await dbService.reportIssue(issueDescription.trim(), currentUser.email);
      alert('Issue reported successfully! It is now visible in the issue tracker.');
      setIsIssueModalOpen(false);
      setIssueDescription('');
      setIssueTrackerKey(Date.now()); // Trigger refresh
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      console.error('Failed to submit issue:', error);
      alert(`There was a problem submitting your issue: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!userSearch) return users;
    return users.filter(user => user.email.toLowerCase().includes(userSearch.toLowerCase()));
  }, [users, userSearch]);

  const getRoleBadge = (role: 'Admin' | 'User' | 'Owner') => {
    const styles = {
      'Owner': 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30',
      'Admin': 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30',
      'User': 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
    };
    return `px-3 py-1 text-[10px] font-bold rounded-full border ${styles[role]}`;
  };
  
  return (
    <div className="h-full bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 overflow-y-auto scrollbar-thin">
      <header className="p-10 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-[#0c0c0e]/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-4"><div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20"><Settings className="w-6 h-6 text-white" /></div><div><h2 className="text-2xl font-bold">Platform Settings</h2><p className="text-sm text-zinc-500">Manage the look, feel, and behavior of the application.</p></div></div>
      </header>
      <main className="max-w-6xl mx-auto p-10 space-y-16">
        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-1">Appearance</h3><h4 className="text-lg font-bold mb-2">Theme</h4><p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl mb-6">Select a visual theme for the application interface. Your preference will be saved for your next visit.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8"><ThemeCard theme="light" currentTheme={currentTheme} onSelect={() => onThemeChange('light')} /><ThemeCard theme="dark" currentTheme={currentTheme} onSelect={() => onThemeChange('dark')} /></div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-1">Support & Issue Tracking</h3>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-lg font-bold">Issue Management</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
                {currentUser.role === 'Admin' || currentUser.role === 'Owner' ? 'View and manage all user-reported issues.' : 'Track the status of issues you have reported.'}
              </p>
            </div>
            <button onClick={() => setIsIssueModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-600/20">
              <LifeBuoy className="w-5 h-5" /> Raise New Issue
            </button>
          </div>
          <IssueTracker key={issueTrackerKey} currentUser={currentUser} />
        </section>

        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-1">Administration</h3>
          <h4 className="text-lg font-bold mb-2">User Management</h4>
          {currentUser.role === 'Admin' || currentUser.role === 'Owner' ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl mb-6">Grant or revoke administrative privileges for users across the platform.</p>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl mb-6">View all registered users on the platform.</p>
          )}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <input 
              type="text" 
              placeholder="Filter users by email..." 
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">User Email</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoadingUsers ? (
                  <tr><td colSpan={3} className="text-center p-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" /></td></tr>
                ) : filteredUsers.map(user => {
                  const isSelf = user.id === currentUser.id;
                  return (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-zinc-800 dark:text-zinc-300 font-medium">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className={getRoleBadge(user.role)}>{user.role}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex gap-2 justify-end items-center">
                          {(currentUser.role === 'Admin' || currentUser.role === 'Owner') && !isSelf && user.role === 'User' && (
                            <button onClick={() => setRoleChangeConfirm({ user, newRole: 'Admin', actionText: 'grant Admin access to' })} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Make Admin</button>
                          )}
                          {currentUser.role === 'Owner' && !isSelf && user.role === 'Admin' && (
                            <button onClick={() => setRoleChangeConfirm({ user, newRole: 'User', actionText: 'revoke Admin access from' })} className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline">Revoke Admin</button>
                          )}
                          {currentUser.role === 'Owner' && !isSelf && user.role !== 'Owner' && (
                            <button onClick={() => setRoleChangeConfirm({ user, newRole: 'Owner', actionText: 'grant Owner access to' })} className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline">Make Owner</button>
                          )}
                          {isSelf && <span className="text-xs text-zinc-400 dark:text-zinc-600 italic">This is you</span>}
                          {user.role === 'Owner' && !isSelf && <span className="text-xs font-bold text-amber-500">Platform Owner</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Issue Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-indigo-500 mb-6">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20"><LifeBuoy className="w-6 h-6" /></div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Report an Issue</h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">Please describe the problem you're experiencing in detail. Your user information and a timestamp will be automatically included in the report.</p>
            <textarea
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows={8}
              placeholder="Describe the issue here..."
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-4 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-y"
            />
            <div className="flex gap-3 mt-8">
              <button onClick={() => setIsIssueModalOpen(false)} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-200 dark:border-zinc-800">Cancel</button>
              <button onClick={handleIssueSubmit} disabled={!issueDescription.trim() || isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Issue'}
              </button>
            </div>
            <button onClick={() => setIsIssueModalOpen(false)} className="absolute top-4 right-4 text-zinc-500 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      {roleChangeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-amber-500 mb-6">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-200 dark:border-amber-500/20"><UserCog className="w-6 h-6" /></div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Confirm Role Change</h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
              Are you sure you want to {roleChangeConfirm.actionText} <strong className="text-indigo-600 dark:text-indigo-400">{roleChangeConfirm.user.email}</strong>? Their permissions will be updated immediately.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRoleChangeConfirm(null)} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-200 dark:border-zinc-800">Cancel</button>
              <button onClick={handleRoleUpdate} className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-amber-600/20">Confirm</button>
            </div>
            <button onClick={() => setRoleChangeConfirm(null)} className="absolute top-4 right-4 text-zinc-500 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
};
