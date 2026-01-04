import React, { useState, useMemo } from 'react';
import { Tool, User } from '../types';
import { Plus, Edit2, Trash2, Hammer, Search, ArrowUpDown, Code, Terminal, Clock, RefreshCw, User as UserIcon, Users, Copy, UserPlus } from 'lucide-react';

interface ToolsListProps {
  tools: Tool[];
  onEdit: (tool: Tool) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onClone: (tool: Tool) => void;
  onShare: (tool: Tool) => void;
  currentUser: User;
  hideUserFilter?: boolean;
  sharedItemIds?: Record<string, string[]>;
  granterEmails?: string[];
  onGranterFilterChange?: (email: string) => void;
  granterFilterValue?: string;
}

export const ToolsList: React.FC<ToolsListProps> = ({ tools, onEdit, onDelete, onCreate, onClone, onShare, currentUser, hideUserFilter, sharedItemIds = { tool: [] }, granterEmails, onGranterFilterChange, granterFilterValue }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated_at_desc');

  const users = useMemo(() => {
    const userEmails = new Set<string>();
    tools.forEach(tool => {
      if (tool.created_by_email) userEmails.add(tool.created_by_email);
      if (tool.updated_by_email) userEmails.add(tool.updated_by_email);
    });
    return Array.from(userEmails).sort();
  }, [tools]);

  const sortedAndFilteredTools = useMemo(() => {
    const filtered = tools.filter(tool => {
      const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUser = hideUserFilter || !userFilter || tool.created_by_email === userFilter || tool.updated_by_email === userFilter;
      return matchesSearch && matchesUser;
    });

     return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'created_at_desc':
          return (b.created_at || 0) - (a.created_at || 0);
        case 'updated_at_desc':
        default:
          return (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0);
      }
    });
  }, [tools, searchQuery, userFilter, sortBy, hideUserFilter]);

  const formatDateTime = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    }).format(new Date(timestamp));
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {!hideUserFilter && (
        <div className="flex justify-between items-end mb-8">
            <div>
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Capabilities & Tools</h2>
            <p className="text-zinc-600 dark:text-zinc-400">Custom functions agents can invoke to interact with the outside world.</p>
            </div>
            <button onClick={onCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg transition-all font-medium shadow-lg shadow-indigo-600/20">
            <Plus className="w-5 h-5" /> Define Tool
            </button>
        </div>
      )}

      <div className="flex gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <input type="text" placeholder="Filter Tools..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        {granterEmails && (
            <div className="w-52 relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <select value={granterFilterValue} onChange={(e) => onGranterFilterChange!(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none">
                  <option value="">Filter by Granter...</option>
                  {granterEmails.map(email => <option key={email} value={email}>{email}</option>)}
              </select>
            </div>
        )}
        {!hideUserFilter && (
            <div className="w-52 relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none">
                <option value="">All Users</option>
                {users.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            </div>
        )}
        <div className="w-52 relative">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none">
            <option value="updated_at_desc">Last Modified</option>
            <option value="created_at_desc">Newest</option>
            <option value="name_asc">Name (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedAndFilteredTools.map((tool) => {
          const lastActivity = tool.updated_at || tool.created_at;
          const Icon = tool.updated_by ? RefreshCw : Clock;
          const isSharedWithMe = sharedItemIds.tool.includes(tool.id);
          const canManage = currentUser.role === 'Admin' || currentUser.role === 'Owner' || tool.created_by === currentUser.id || isSharedWithMe;

          return (
            <div key={tool.id} className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group relative flex flex-col h-full shadow-sm hover:shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                  <Hammer className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => onShare(tool)} disabled={!canManage} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed" title={!canManage ? "Only owners or admins can grant access" : "Grant Access"}>
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                   <button onClick={() => onClone(tool)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" title="Clone Tool">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => onEdit(tool)} 
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    title="Edit Tool"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => onDelete(tool.id)} 
                    disabled={!canManage}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={!canManage ? "Only owners, admins, or grantees can delete" : "Delete Tool"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1 truncate">{tool.name}</h3>
                <div className="text-[9px] font-mono text-zinc-500 mb-2 uppercase tracking-tighter flex items-center gap-1"><Terminal className="w-3 h-3" /> {tool.className}</div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">{tool.description}</p>
              </div>

              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-indigo-700 bg-indigo-100 dark:bg-indigo-900/10 dark:text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/20 uppercase tracking-widest"><Code className="w-3 h-3" /> {tool.language}</div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-bold uppercase tracking-tighter">{Object.keys(tool.parameters.properties || {}).length} Params</span>
                </div>
                <div className="space-y-1 text-[9px] text-zinc-500 dark:text-zinc-600 font-medium pt-2 border-t border-zinc-200/80 dark:border-zinc-800/50">
                    <div className="flex items-center gap-1.5" title={`Created by ${tool.created_by_email}`}>
                      <UserIcon className="w-2.5 h-2.5" />
                      <span className="truncate">
                        {tool.updated_by && tool.updated_at && tool.updated_at > (tool.created_at || 0) ? `Updated by ${tool.updated_by_email}` : `Created by ${tool.created_by_email || 'System'}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-2.5 h-2.5" />
                      <span>{formatDateTime(lastActivity)}</span>
                    </div>
                </div>
              </div>
            </div>
          )
        })}

        {sortedAndFilteredTools.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 gap-4 h-64">
            <Hammer className="w-8 h-8 opacity-20" />
            <span className="font-medium">No tools found matching your search.</span>
          </div>
        )}
      </div>
    </div>
  );
};
