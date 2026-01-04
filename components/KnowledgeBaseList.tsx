import React, { useState, useMemo } from 'react';
import { KnowledgeBase, User } from '../types';
import { Plus, Edit2, Trash2, Database, Search, ArrowUpDown, Clock, RefreshCw, User as UserIcon, Users, FileText, UserPlus } from 'lucide-react';

interface KnowledgeBaseListProps {
  knowledgeBases: KnowledgeBase[];
  onEdit: (kb: KnowledgeBase) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onShare: (kb: KnowledgeBase) => void;
  currentUser: User;
  hideUserFilter?: boolean;
  sharedItemIds?: Record<string, string[]>;
  granterEmails?: string[];
  onGranterFilterChange?: (email: string) => void;
  granterFilterValue?: string;
}

export const KnowledgeBaseList: React.FC<KnowledgeBaseListProps> = ({ knowledgeBases, onEdit, onDelete, onCreate, onShare, currentUser, hideUserFilter, sharedItemIds = { knowledgeBase: [] }, granterEmails, onGranterFilterChange, granterFilterValue }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated_at_desc');

  const users = useMemo(() => {
    const userEmails = new Set<string>();
    knowledgeBases.forEach(kb => {
      if (kb.created_by_email) userEmails.add(kb.created_by_email);
      if (kb.updated_by_email) userEmails.add(kb.updated_by_email);
    });
    return Array.from(userEmails).sort();
  }, [knowledgeBases]);

  const sortedAndFilteredKBs = useMemo(() => {
    const filtered = knowledgeBases.filter(kb => {
      const matchesSearch = kb.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUser = hideUserFilter || !userFilter || kb.created_by_email === userFilter || kb.updated_by_email === userFilter;
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
  }, [knowledgeBases, searchQuery, userFilter, sortBy, hideUserFilter]);
  
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
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Knowledge Bases</h2>
            <p className="text-zinc-600 dark:text-zinc-400">Curate collections of documents for agents to use as context.</p>
            </div>
            <button onClick={onCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg transition-all font-medium shadow-lg shadow-indigo-600/20">
            <Plus className="w-5 h-5" /> Create Knowledge Base
            </button>
        </div>
      )}

      <div className="flex gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <input type="text" placeholder="Filter by Name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
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
        {sortedAndFilteredKBs.map((kb) => {
          const lastActivity = kb.updated_at || kb.created_at;
          const Icon = kb.updated_by ? RefreshCw : Clock;
          const isSharedWithMe = sharedItemIds.knowledgeBase.includes(kb.id);
          const canManage = currentUser.role === 'Admin' || currentUser.role === 'Owner' || kb.created_by === currentUser.id || isSharedWithMe;

          return (
            <div key={kb.id} className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group relative flex flex-col shadow-sm hover:shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => onShare(kb)} disabled={!canManage} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed" title={!canManage ? "Only owners or admins can grant access" : "Grant Access"}>
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onEdit(kb)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" title="Edit Knowledge Base">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => onDelete(kb.id)} 
                    disabled={!canManage}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={!canManage ? "Only owners, admins, or grantees can delete" : "Delete Knowledge Base"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate pr-2">{kb.name || 'Untitled KB'}</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-1">{kb.description || 'No description provided.'}</p>
              </div>

              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/50 space-y-2">
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-900/50 text-[9px] text-zinc-700 dark:text-zinc-300 font-medium">
                  <FileText className="w-3 h-3 text-indigo-500 dark:text-indigo-400" /><span className="truncate">{kb.file_names.length} Document(s)</span>
                </div>
                <div className="space-y-1 text-[9px] text-zinc-500 dark:text-zinc-600 font-medium px-1">
                  <div className="flex items-center gap-1.5" title={`Created by ${kb.created_by_email}`}>
                    <UserIcon className="w-2.5 h-2.5" />
                    <span className="truncate">
                      {kb.updated_by && kb.updated_at && kb.updated_at > (kb.created_at || 0) ? `Updated by ${kb.updated_by_email}` : `Created by ${kb.created_by_email || 'System'}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-2.5 h-2.5" />
                    <span>{formatDateTime(lastActivity)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {sortedAndFilteredKBs.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 gap-4 h-64">
            <Search className="w-8 h-8 opacity-20" />
            <span className="font-medium">No knowledge bases found</span>
          </div>
        )}
      </div>
    </div>
  );
};
