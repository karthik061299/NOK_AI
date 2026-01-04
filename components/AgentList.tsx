import React, { useState, useMemo } from 'react';
import { Agent, Tool, DBModel, User } from '../types';
import { Plus, Edit2, Trash2, User as UserIcon, Search, Filter, Cpu, Hammer, GitCommit, ArrowUpDown, Clock, RefreshCw, Users, Copy, UserPlus } from 'lucide-react';

interface AgentListProps {
  agents: Agent[];
  tools: Tool[];
  models: DBModel[];
  onEdit: (agent: Agent) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onClone: (agent: Agent) => void;
  onShare: (agent: Agent) => void;
  currentUser: User;
  hideUserFilter?: boolean;
  hideDomainFilter?: boolean;
  sharedItemIds?: Record<string, string[]>;
  granterEmails?: string[];
  onGranterFilterChange?: (email: string) => void;
  granterFilterValue?: string;
}

export const AgentList: React.FC<AgentListProps> = ({ agents, tools, models, onEdit, onDelete, onCreate, onClone, onShare, currentUser, hideUserFilter, hideDomainFilter, sharedItemIds = { agent: [] }, granterEmails, onGranterFilterChange, granterFilterValue }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated_at_desc');

  const domains = Array.from(new Set(agents.map(a => a.domain))).sort();
  const users = useMemo(() => {
    const userEmails = new Set<string>();
    agents.forEach(agent => {
      if (agent.created_by_email) userEmails.add(agent.created_by_email);
      if (agent.updated_by_email) userEmails.add(agent.updated_by_email);
    });
    return Array.from(userEmails).sort();
  }, [agents]);

  const sortedAndFilteredAgents = useMemo(() => {
    const filtered = agents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDomain = hideDomainFilter || !domainFilter || agent.domain === domainFilter;
      const matchesUser = hideUserFilter || !userFilter || agent.created_by_email === userFilter || agent.updated_by_email === userFilter;
      return matchesSearch && matchesDomain && matchesUser;
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
  }, [agents, searchQuery, domainFilter, userFilter, sortBy, hideUserFilter, hideDomainFilter]);

  const getAgentToolNames = (agent: Agent) => {
    if (!agent.toolIds || agent.toolIds.length === 0) return [];
    return tools.filter(t => agent.toolIds?.includes(t.id)).map(t => t.name);
  };
  
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
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">AI Agents</h2>
            <p className="text-zinc-600 dark:text-zinc-400">Define specialized agents with specific goals and behaviors.</p>
            </div>
            <button onClick={onCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg transition-all font-medium shadow-lg shadow-indigo-600/20">
            <Plus className="w-5 h-5" /> Create Agent
            </button>
        </div>
      )}

      <div className="flex gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <input type="text" placeholder="Filter by Agent Name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        {!hideDomainFilter && (
          <div className="w-52 relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none">
              <option value="">All Domains</option>
              {domains.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
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
        {sortedAndFilteredAgents.map((agent) => {
          const agentToolNames = getAgentToolNames(agent);
          const modelName = models.find(m => m.id === agent.config.model)?.name || agent.config.model;
          const lastActivity = agent.updated_at || agent.created_at;
          const Icon = agent.updated_by ? RefreshCw : Clock;
          const isSharedWithMe = sharedItemIds.agent.includes(agent.id);
          const canManage = currentUser.role === 'Admin' || currentUser.role === 'Owner' || agent.created_by === currentUser.id || isSharedWithMe;

          return (
            <div key={agent.id} className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group relative flex flex-col shadow-sm hover:shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => onShare(agent)} disabled={!canManage} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed" title={!canManage ? "Only owners or admins can grant access" : "Grant Access"}>
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                   <button onClick={() => onClone(agent)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" title="Clone Agent">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onEdit(agent)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" title="Edit Agent">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => onDelete(agent.id)} 
                    disabled={!canManage}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={!canManage ? "Only owners, admins, or grantees can delete" : "Delete Agent"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate pr-2">{agent.name || 'Untitled Agent'}</h3>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500"><GitCommit className="w-3 h-3" /><span>V{agent.version}</span></div>
                </div>
                {!hideDomainFilter && <div className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 text-[9px] font-bold uppercase tracking-wider border border-indigo-200 dark:border-indigo-900/30 inline-block mb-2">{agent.domain}</div>}
                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">{agent.description || 'No description provided.'}</p>
                {agentToolNames.length > 0 && (<div className="flex flex-wrap gap-1.5"><div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1 self-center"><Hammer className="w-2.5 h-2.5" /></div>{agentToolNames.map((name, i) => (<span key={i} className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/10 dark:text-amber-500 text-[8px] font-bold border border-amber-200 dark:border-amber-900/20">{name}</span>))}</div>)}
              </div>

              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/50 space-y-2">
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-900/50 text-[9px] text-zinc-700 dark:text-zinc-300 font-medium">
                  <Cpu className="w-3 h-3 text-indigo-500 dark:text-indigo-400" /><span className="truncate">{modelName}</span>
                </div>
                <div className="space-y-1 text-[9px] text-zinc-500 dark:text-zinc-600 font-medium px-1">
                  <div className="flex items-center gap-1.5" title={`Created by ${agent.created_by_email}`}>
                    <UserIcon className="w-2.5 h-2.5" />
                    <span className="truncate">
                      {agent.updated_by && agent.updated_at && agent.updated_at > (agent.created_at || 0) ? `Updated by ${agent.updated_by_email}` : `Created by ${agent.created_by_email || 'System'}`}
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

        {sortedAndFilteredAgents.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 gap-4 h-64">
            <Search className="w-8 h-8 opacity-20" />
            <span className="font-medium">No agents found matching your criteria</span>
          </div>
        )}
      </div>
    </div>
  );
};
