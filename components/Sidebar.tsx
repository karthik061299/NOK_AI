import React from 'react';
import { Users, GitBranch, Play, Cpu, PanelLeftClose, Hammer, MessageSquare, Settings, LogOut, Database, Shield, FolderGit2 } from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  activeTab: 'agents' | 'workflows' | 'execution' | 'tools' | 'knowledgeBase' | 'guardrails' | 'chat' | 'settings' | 'myCreations';
  onTabChange: (tab: 'agents' | 'workflows' | 'execution' | 'tools' | 'knowledgeBase' | 'guardrails' | 'chat' | 'settings' | 'myCreations') => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  currentUser: User | null;
  onLogoutRequest: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isCollapsed, setIsCollapsed, currentUser, onLogoutRequest }) => {
  const menuItems = [
    { id: 'myCreations', label: 'My Creations', icon: FolderGit2 },
  ] as const;

  const sharedMenuItems = [
    { id: 'agents', label: 'Agents', icon: Users },
    { id: 'workflows', label: 'Workflows', icon: GitBranch },
    { id: 'tools', label: 'Tools', icon: Hammer },
    { id: 'knowledgeBase', label: 'Knowledge Bases', icon: Database },
    { id: 'guardrails', label: 'Guardrails', icon: Shield },
  ] as const;

  const utilityItems = [
    { id: 'execution', label: 'Execution', icon: Play },
    { id: 'chat', label: 'Chat with AI', icon: MessageSquare },
  ] as const;

  if (isCollapsed) return null;

  return (
    <aside 
      className={`w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] flex flex-col transition-all duration-300 transform translate-x-0 overflow-hidden shadow-2xl z-40`}
    >
      <div className="p-6 flex items-center justify-between">
        <div>
          <img src="/NOK_Light_LOGO.png" alt="NOK AI Logo" className="h-8 dark:hidden" />
          <img src="/NOK_Dark_LOGO.png" alt="NOK AI Logo" className="h-8 hidden dark:block" />
        </div>
        <button 
          onClick={() => setIsCollapsed(true)}
          className="p-1.5 text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
              activeTab === item.id
                ? 'bg-zinc-100 dark:bg-zinc-800/50 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200 dark:border-zinc-700/50'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/30'
            }`}
          >
            <item.icon className={`w-5 h-5 transition-colors ${activeTab === item.id ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
        <div className="px-4 pt-4 pb-2 text-[10px] font-bold uppercase text-zinc-400 dark:text-zinc-600 tracking-widest">Library</div>
        {sharedMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
              activeTab === item.id
                ? 'bg-zinc-100 dark:bg-zinc-800/50 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200 dark:border-zinc-700/50'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/30'
            }`}
          >
            <item.icon className={`w-5 h-5 transition-colors ${activeTab === item.id ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
         <div className="px-4 pt-4 pb-2 text-[10px] font-bold uppercase text-zinc-400 dark:text-zinc-600 tracking-widest">Utilities</div>
        {utilityItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
              activeTab === item.id
                ? 'bg-zinc-100 dark:bg-zinc-800/50 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200 dark:border-zinc-700/50'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/30'
            }`}
          >
            <item.icon className={`w-5 h-5 transition-colors ${activeTab === item.id ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-3 mt-auto border-t border-zinc-200 dark:border-zinc-800 space-y-2">
        {currentUser && (
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Signed In As</span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-500 truncate" title={currentUser.email}>{currentUser.email}</span>
            </div>
            <button onClick={onLogoutRequest} className="p-2 text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
        <button
            key="settings"
            onClick={() => onTabChange('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
              activeTab === 'settings'
                ? 'bg-zinc-100 dark:bg-zinc-800/50 text-indigo-600 dark:text-indigo-400'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/30'
            }`}
          >
          <Settings className={`w-5 h-5 transition-colors ${activeTab === 'settings' ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`} />
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
};