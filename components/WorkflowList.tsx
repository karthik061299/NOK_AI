import React, { useState, useMemo } from 'react';
import { Workflow, WorkflowType, User } from '../types';
import { Plus, Edit2, Trash2, GitBranch, Layers, Clock, Activity, UserCheck, Search, ArrowUpDown, RefreshCw, User as UserIcon, Users, Copy, UserPlus } from 'lucide-react';

interface WorkflowListProps {
  workflows: Workflow[];
  onEdit: (workflow: Workflow) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onClone: (workflow: Workflow) => void;
  onShare: (workflow: Workflow) => void;
  currentUser: User;
  hideUserFilter?: boolean;
  sharedItemIds?: Record<string, string[]>;
  granterEmails?: string[];
  onGranterFilterChange?: (email: string) => void;
  granterFilterValue?: string;
}

const TypeIcon: React.FC<{ type: WorkflowType }> = ({ type }) => {
  switch (type) {
    case WorkflowType.SEQUENTIAL: return <Clock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />;
    case WorkflowType.PARALLEL: return <Layers className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />;
    case WorkflowType.CIRCULAR: return <Activity className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />;
    case WorkflowType.HYBRID: return <GitBranch className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />;
    case WorkflowType.HUMAN_IN_THE_LOOP: return <UserCheck className="w-3.5 h-3.5 text-teal-500 dark:text-teal-400" />;
    default: return null;
  }
};

export const WorkflowList: React.FC<WorkflowListProps> = ({ workflows, onEdit, onDelete, onCreate, onClone, onShare, currentUser, hideUserFilter, sharedItemIds = { workflow: [] }, granterEmails, onGranterFilterChange, granterFilterValue }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated_at_desc');

  const users = useMemo(() => {
    const userEmails = new Set<string>();
    workflows.forEach(w => {
      if (w.created_by_email) userEmails.add(w.created_by_email);
      if (w.updated_by_email) userEmails.add(w.updated_by_email);
    });
    return Array.from(userEmails).sort();
  }, [workflows]);

  const sortedAndFilteredWorkflows = useMemo(() => {
    const filtered = workflows.filter(w => {
      const matchesSearch = w.metadata.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUser = hideUserFilter || !userFilter || w.created_by_email === userFilter || w.updated_by_email === userFilter;
      return matchesSearch && matchesUser;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.metadata.name.localeCompare(b.metadata.name);
        case 'created_at_desc':
          return (b.created_at || 0) - (a.created_at || 0);
        case 'updated_at_desc':
        default:
          return (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0);
      }
    });
  }, [workflows, searchQuery, userFilter, sortBy, hideUserFilter]);
  
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
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Workflows</h2>
            <p className="text-zinc-600 dark:text-zinc-400">Orchestrate multiple agents into complex pipelines.</p>
            </div>
            <button onClick={onCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg transition-all font-medium shadow-lg shadow-indigo-600/20">
            <Plus className="w-5 h-5" /> Create Workflow
            </button>
        </div>
      )}

       <div className="flex gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <input type="text" placeholder="Filter by Workflow Name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
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
        {sortedAndFilteredWorkflows.map((workflow) => {
          const lastActivity = workflow.updated_at || workflow.created_at;
          const Icon = workflow.updated_by ? RefreshCw : Clock;
          const isSharedWithMe = sharedItemIds.workflow.includes(workflow.metadata.id);
          const canManage = currentUser.role === 'Admin' || currentUser.role === 'Owner' || workflow.created_by === currentUser.id || isSharedWithMe;
          
          return (
            <div key={workflow.metadata.id} className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group relative flex flex-col shadow-sm hover:shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => onShare(workflow)} disabled={!canManage} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed" title={!canManage ? "Only owners or admins can grant access" : "Grant Access"}>
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                   <button onClick={() => onClone(workflow)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" title="Clone Workflow">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => onEdit(workflow)} 
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    title="Edit Workflow"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => onDelete(workflow.metadata.id)} 
                    disabled={!canManage}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={!canManage ? "Only owners, admins, or grantees can delete" : "Delete Workflow"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1 truncate">{workflow.metadata.name || 'Untitled Workflow'}</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-4">{workflow.metadata.description || 'No description provided.'}</p>
              </div>

              <div className="space-y-3 pt-3 border-t border-zinc-200/80 dark:border-zinc-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><TypeIcon type={workflow.metadata.type} /><span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-400 uppercase tracking-wider">{workflow.metadata.type.replace(/_/g, ' ')}</span></div>
                  <span className="text-xs font-medium text-zinc-500">{workflow.nodes.length} Agents</span>
                </div>
                {workflow.metadata.useManager && (<div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest">Manager Enabled</div>)}
                <div className="space-y-1 text-[9px] text-zinc-500 dark:text-zinc-600 font-medium pt-2 border-t border-zinc-200/80 dark:border-zinc-800/50">
                    <div className="flex items-center gap-1.5" title={`Created by ${workflow.created_by_email}`}>
                      <UserIcon className="w-2.5 h-2.5" />
                      <span className="truncate">
                        {workflow.updated_by && workflow.updated_at && workflow.updated_at > (workflow.created_at || 0) ? `Updated by ${workflow.updated_by_email}` : `Created by ${workflow.created_by_email || 'System'}`}
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

        {workflows.length === 0 && (
          <button onClick={onCreate} className="border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800/20 transition-all gap-4 h-64">
            <Plus className="w-8 h-8" />
            <span className="font-medium">Create your first workflow</span>
          </button>
        )}
      </div>
    </div>
  );
};
