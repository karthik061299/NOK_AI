
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, ReportedIssue } from '../types';
import { dbService } from '../services/db';
import { Loader2, AlertTriangle, Inbox, CheckCircle2, XCircle, MoreVertical, Search, ArrowUpDown, X, User as UserIcon } from 'lucide-react';

interface IssueTrackerProps {
  currentUser: User;
}

export const IssueTracker: React.FC<IssueTrackerProps> = ({ currentUser }) => {
  const [issues, setIssues] = useState<ReportedIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'Pending' | 'Resolved'>('Pending');
  const [actionMenu, setActionMenu] = useState<{ issue: ReportedIssue; rect: DOMRect } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ issue: ReportedIssue; newStatus: 'Pending' | 'Resolved' | 'Revoked' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('created_at_desc');
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchIssues = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await dbService.getReportedIssues(currentUser);
      setIssues(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch issues.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActionMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStatusUpdate = async () => {
    if (!confirmModal) return;
    const { issue, newStatus } = confirmModal;

    try {
      await dbService.updateIssueStatus(issue.id, newStatus, currentUser);
      await fetchIssues(); // Refresh list
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setConfirmModal(null);
      setActionMenu(null);
    }
  };
  
  const getStatusBadge = (status: ReportedIssue['status']) => {
    const styles = {
      'Pending': 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      'Resolved': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      'Revoked': 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700',
    };
    return `px-3 py-1 text-[10px] font-bold rounded-full border ${styles[status]}`;
  };

  const formatDateTime = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(timestamp));
  };

  const sortedAndFilteredIssues = useMemo(() => {
    const baseIssues = (currentUser.role === 'Admin' || currentUser.role === 'Owner')
      ? (activeTab === 'Pending' ? issues.filter(i => i.status === 'Pending') : issues.filter(i => i.status === 'Resolved' || i.status === 'Revoked'))
      : issues;

    const filtered = baseIssues.filter(issue => {
      const lowerCaseQuery = searchQuery.toLowerCase();
      return issue.description.toLowerCase().includes(lowerCaseQuery) || issue.raised_by_email.toLowerCase().includes(lowerCaseQuery);
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'status_asc':
          return a.status.localeCompare(b.status);
        case 'updated_at_desc':
          return (b.updated_at || b.created_at) - (a.updated_at || a.created_at);
        case 'created_at_desc':
        default:
          return b.created_at - a.created_at;
      }
    });
  }, [issues, activeTab, currentUser.role, searchQuery, sortBy]);

  if (isLoading) {
    return <div className="flex justify-center items-center p-12"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
  }
  if (error) {
    return <div className="p-8 bg-red-100/50 text-red-600 border border-red-200 rounded-lg">{error}</div>;
  }
  
  const renderTable = () => (
    <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-auto max-h-[60vh]">
      <table className="w-full text-sm min-w-[1200px]">
        <thead className="bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider w-12">#</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Description</th>
            {(currentUser.role === 'Admin' || currentUser.role === 'Owner') && <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Raised By</th>}
            <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Date Raised</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Last Updated</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-4 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {sortedAndFilteredIssues.length === 0 ? (
            <tr><td colSpan={7} className="text-center p-8 text-zinc-500 italic">No issues found.</td></tr>
          ) : sortedAndFilteredIssues.map((issue, index) => (
            <tr key={issue.id}>
              <td className="px-6 py-4 text-zinc-500 font-bold">{index + 1}</td>
              <td className="px-6 py-4 text-zinc-800 dark:text-zinc-300" title={issue.description}>{issue.description}</td>
              {(currentUser.role === 'Admin' || currentUser.role === 'Owner') && <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{issue.raised_by_email}</td>}
              <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatDateTime(issue.created_at)}</td>
              <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                <div className="flex flex-col">
                    <span>{formatDateTime(issue.updated_at || issue.created_at)}</span>
                    {issue.updated_by_email && <span className="text-[10px] text-zinc-500 flex items-center gap-1"><UserIcon className="w-3 h-3"/>{issue.updated_by_email}</span>}
                </div>
              </td>
              <td className="px-6 py-4"><span className={getStatusBadge(issue.status)}>{issue.status}</span></td>
              <td className="px-6 py-4 text-right">
                 {currentUser.role === 'User' && issue.status === 'Pending' && (
                  <button onClick={() => setConfirmModal({ issue, newStatus: 'Revoked' })} className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline">Revoke</button>
                 )}
                 {(currentUser.role === 'Admin' || currentUser.role === 'Owner') && (
                   <button 
                      onClick={(e) => {
                          e.stopPropagation();
                          setActionMenu(actionMenu?.issue.id === issue.id ? null : { issue, rect: e.currentTarget.getBoundingClientRect() });
                      }} 
                      className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                 )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      {(currentUser.role === 'Admin' || currentUser.role === 'Owner') && (
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button onClick={() => setActiveTab('Pending')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'Pending' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'}`}>Pending Issues</button>
            <button onClick={() => setActiveTab('Resolved')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'Resolved' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'}`}>Resolved & Revoked</button>
          </nav>
        </div>
      )}

      <div className="flex gap-4 my-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search by description or user..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="w-52 relative">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)} 
            className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none appearance-none"
          >
            <option value="created_at_desc">Newest First</option>
            <option value="updated_at_desc">Last Updated</option>
            <option value="status_asc">By Status</option>
          </select>
        </div>
      </div>

      {renderTable()}

      {actionMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: actionMenu.rect.bottom + 4,
            left: actionMenu.rect.right - 160,
          }}
          className="w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 p-1 animate-in fade-in zoom-in-95"
        >
          {actionMenu.issue.status === 'Pending' && <button onClick={() => { setConfirmModal({ issue: actionMenu.issue, newStatus: 'Resolved' }); setActionMenu(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">Mark as Resolved</button>}
          {actionMenu.issue.status === 'Resolved' && <button onClick={() => { setConfirmModal({ issue: actionMenu.issue, newStatus: 'Pending' }); setActionMenu(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">Re-open Issue</button>}
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-4">Confirm Action</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">Are you sure you want to mark this issue as <strong className="lowercase">{confirmModal.newStatus}</strong>?</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm font-semibold">Cancel</button>
              <button onClick={handleStatusUpdate} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
