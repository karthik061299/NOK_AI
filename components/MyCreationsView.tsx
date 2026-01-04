import React, { useState, useMemo, useEffect } from 'react';
import { Agent, Workflow, Tool, KnowledgeBase, Guardrail, User } from '../types';
import { AgentList } from './AgentList';
import { WorkflowList } from './WorkflowList';
import { ToolsList } from './ToolsList';
import { KnowledgeBaseList } from './KnowledgeBaseList';
import { GuardrailList } from './GuardrailList';
import { dbService } from '../services/db';
import { FolderGit2, Users, GitBranch, Hammer, Database, Shield, Inbox, Share2, Loader2, Edit2, Clock, User as UserIcon, Filter } from 'lucide-react';

interface MyCreationsViewProps {
  currentUser: User;
  allAgents: Agent[];
  allWorkflows: Workflow[];
  allTools: Tool[];
  allKnowledgeBases: KnowledgeBase[];
  allGuardrails: Guardrail[];
  onEditAgent: (agent: Agent) => void;
  onEditWorkflow: (workflow: Workflow) => void;
  onEditTool: (tool: Tool) => void;
  onEditKnowledgeBase: (kb: KnowledgeBase) => void;
  onEditGuardrail: (g: Guardrail) => void;
  onDeleteAgent: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
  onDeleteTool: (id: string) => void;
  onDeleteKnowledgeBase: (id: string) => void;
  onDeleteGuardrail: (id: string) => void;
  sharedItemIds: Record<string, string[]>;
  onShareAgent: (agent: Agent) => void;
  onShareWorkflow: (workflow: Workflow) => void;
  onShareTool: (tool: Tool) => void;
  onShareKnowledgeBase: (kb: KnowledgeBase) => void;
  onShareGuardrail: (g: Guardrail) => void;
}

type MainTab = 'myCreations' | 'sharedWithMe';
type ItemTab = 'agents' | 'workflows' | 'tools' | 'knowledgeBases' | 'guardrails';
type SharedItem = (Agent | Workflow | Tool | KnowledgeBase | Guardrail) & { item_type: string, name: string, description: string, id: string };

const EmptyState: React.FC<{ type: string }> = ({ type }) => (
  <div className="text-center py-20">
    <Inbox className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
    <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">No {type} Found</h3>
    <p className="text-sm text-zinc-500 mt-2">You haven't created any {type.toLowerCase()} yet, or none have been shared with you.</p>
  </div>
);

const itemIcons: Record<string, React.ElementType> = {
  agent: Users,
  workflow: GitBranch,
  tool: Hammer,
  knowledgeBase: Database,
  guardrail: Shield,
};

export const MyCreationsView: React.FC<MyCreationsViewProps> = (props) => {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('myCreations');
  const [activeItemTab, setActiveItemTab] = useState<ItemTab>('agents');
  
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [isLoadingShared, setIsLoadingShared] = useState(true);
  const [sharedByUserFilter, setSharedByUserFilter] = useState('');


  const { currentUser, allAgents, allWorkflows, allTools, allKnowledgeBases, allGuardrails } = props;

  useEffect(() => {
    if (activeMainTab === 'sharedWithMe') {
      const fetchSharedItems = async () => {
        setIsLoadingShared(true);
        try {
          const sharedIds = props.sharedItemIds;
          
          const sharedAgents = allAgents.filter(a => sharedIds.agent.includes(a.id))
            .map(a => ({ ...a, item_type: 'agent', name: a.name, description: a.description, id: a.id }));
          
          const sharedWorkflows = allWorkflows.filter(w => sharedIds.workflow.includes(w.metadata.id))
            .map(w => ({ ...w, item_type: 'workflow', name: w.metadata.name, description: w.metadata.description, id: w.metadata.id }));
            
          const sharedTools = allTools.filter(t => sharedIds.tool.includes(t.id))
            .map(t => ({ ...t, item_type: 'tool', name: t.name, description: t.description, id: t.id }));

          const sharedKBs = allKnowledgeBases.filter(kb => sharedIds.knowledgeBase.includes(kb.id))
            .map(kb => ({ ...kb, item_type: 'knowledgeBase', name: kb.name, description: kb.description, id: kb.id }));
            
          const sharedGuardrails = allGuardrails.filter(g => sharedIds.guardrail.includes(g.id))
            .map(g => ({ ...g, item_type: 'guardrail', name: g.name, description: g.description, id: g.id }));

          const combined: SharedItem[] = [
            ...sharedAgents, ...sharedWorkflows, ...sharedTools, ...sharedKBs, ...sharedGuardrails
          ];

          combined.sort((a, b) => (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0));
          
          setSharedItems(combined);

        } catch (e) {
          console.error("Failed to fetch shared items:", e);
        } finally {
          setIsLoadingShared(false);
        }
      };
      fetchSharedItems();
    }
  }, [activeMainTab, currentUser.id, allAgents, allWorkflows, allTools, allKnowledgeBases, allGuardrails, props.sharedItemIds]);


  const myAgents = useMemo(() => allAgents.filter(a => a.created_by === currentUser.id), [allAgents, currentUser.id]);
  const myWorkflows = useMemo(() => allWorkflows.filter(w => w.created_by === currentUser.id), [allWorkflows, currentUser.id]);
  const myTools = useMemo(() => allTools.filter(t => t.created_by === currentUser.id), [allTools, currentUser.id]);
  const myKBs = useMemo(() => allKnowledgeBases.filter(kb => kb.created_by === currentUser.id), [allKnowledgeBases, currentUser.id]);
  const myGuardrails = useMemo(() => allGuardrails.filter(g => g.created_by === currentUser.id), [allGuardrails, currentUser.id]);
  
  const itemTabs: { id: ItemTab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'agents', label: 'Agents', icon: Users, count: myAgents.length },
    { id: 'workflows', label: 'Workflows', icon: GitBranch, count: myWorkflows.length },
    { id: 'tools', label: 'Tools', icon: Hammer, count: myTools.length },
    { id: 'knowledgeBases', label: 'Knowledge Bases', icon: Database, count: myKBs.length },
    { id: 'guardrails', label: 'Guardrails', icon: Shield, count: myGuardrails.length },
  ];

  const renderMyCreations = () => {
    switch (activeItemTab) {
      case 'agents': return myAgents.length > 0 ? <AgentList agents={myAgents} tools={allTools} models={[]} onEdit={props.onEditAgent} onDelete={props.onDeleteAgent} onCreate={() => {}} onClone={() => alert("Clone not available in this view.")} onShare={props.onShareAgent} currentUser={currentUser} hideUserFilter={true} hideDomainFilter={true} sharedItemIds={props.sharedItemIds} /> : <EmptyState type="Agents" />;
      case 'workflows': return myWorkflows.length > 0 ? <WorkflowList workflows={myWorkflows} onEdit={props.onEditWorkflow} onDelete={props.onDeleteWorkflow} onCreate={() => {}} onClone={() => alert("Clone not available in this view.")} onShare={props.onShareWorkflow} currentUser={currentUser} hideUserFilter={true} sharedItemIds={props.sharedItemIds} /> : <EmptyState type="Workflows" />;
      case 'tools': return myTools.length > 0 ? <ToolsList tools={myTools} onEdit={props.onEditTool} onDelete={props.onDeleteTool} onCreate={() => {}} onClone={() => alert("Clone not available in this view.")} onShare={props.onShareTool} currentUser={currentUser} hideUserFilter={true} sharedItemIds={props.sharedItemIds} /> : <EmptyState type="Tools" />;
      case 'knowledgeBases': return myKBs.length > 0 ? <KnowledgeBaseList knowledgeBases={myKBs} onEdit={props.onEditKnowledgeBase} onDelete={props.onDeleteKnowledgeBase} onCreate={() => {}} onShare={props.onShareKnowledgeBase} currentUser={currentUser} hideUserFilter={true} sharedItemIds={props.sharedItemIds} /> : <EmptyState type="Knowledge Bases" />;
      case 'guardrails': return myGuardrails.length > 0 ? <GuardrailList guardrails={myGuardrails} onEdit={props.onEditGuardrail} onDelete={props.onDeleteGuardrail} onCreate={() => {}} onShare={props.onShareGuardrail} currentUser={currentUser} hideUserFilter={true} sharedItemIds={props.sharedItemIds} /> : <EmptyState type="Guardrails" />;
      default: return null;
    }
  };
  
  const sharerEmails = useMemo(() => {
    if (activeMainTab !== 'sharedWithMe') return [];
    const emails = new Set(sharedItems.map(i => i.created_by_email).filter((email): email is string => !!email));
    return Array.from(emails).sort();
  }, [sharedItems, activeMainTab]);

  const sharedAgents = useMemo(() => sharedItems.filter(i => i.item_type === 'agent' && (!sharedByUserFilter || i.created_by_email === sharedByUserFilter)) as Agent[], [sharedItems, sharedByUserFilter]);
  const sharedWorkflows = useMemo(() => sharedItems.filter(i => i.item_type === 'workflow' && (!sharedByUserFilter || i.created_by_email === sharedByUserFilter)) as Workflow[], [sharedItems, sharedByUserFilter]);
  const sharedTools = useMemo(() => sharedItems.filter(i => i.item_type === 'tool' && (!sharedByUserFilter || i.created_by_email === sharedByUserFilter)) as Tool[], [sharedItems, sharedByUserFilter]);
  const sharedKBs = useMemo(() => sharedItems.filter(i => i.item_type === 'knowledgeBase' && (!sharedByUserFilter || i.created_by_email === sharedByUserFilter)) as KnowledgeBase[], [sharedItems, sharedByUserFilter]);
  const sharedGuardrails = useMemo(() => sharedItems.filter(i => i.item_type === 'guardrail' && (!sharedByUserFilter || i.created_by_email === sharedByUserFilter)) as Guardrail[], [sharedItems, sharedByUserFilter]);

  const sharedItemTabs: { id: ItemTab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'agents', label: 'Agents', icon: Users, count: sharedAgents.length },
    { id: 'workflows', label: 'Workflows', icon: GitBranch, count: sharedWorkflows.length },
    { id: 'tools', label: 'Tools', icon: Hammer, count: sharedTools.length },
    { id: 'knowledgeBases', label: 'Knowledge Bases', icon: Database, count: sharedKBs.length },
    { id: 'guardrails', label: 'Guardrails', icon: Shield, count: sharedGuardrails.length },
  ];

  const renderSharedWithMe = () => {
    if (isLoadingShared) {
      return <div className="flex justify-center items-center p-20"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
    }
    if (sharedItems.length === 0) {
      return <EmptyState type="shared items" />;
    }
    
    let content;
    switch (activeItemTab) {
        case 'agents': content = sharedAgents.length > 0 ? <AgentList agents={sharedAgents} tools={allTools} models={[]} onEdit={props.onEditAgent} onDelete={props.onDeleteAgent} onCreate={()=>{}} onClone={() => alert("Clone not available for shared items.")} onShare={() => alert("Re-share not available for shared items.")} currentUser={currentUser} hideUserFilter={true} hideDomainFilter={true} sharedItemIds={props.sharedItemIds} granterEmails={sharerEmails} granterFilterValue={sharedByUserFilter} onGranterFilterChange={setSharedByUserFilter}/> : <EmptyState type="Agents" />; break;
        case 'workflows': content = sharedWorkflows.length > 0 ? <WorkflowList workflows={sharedWorkflows} onEdit={props.onEditWorkflow} onDelete={props.onDeleteWorkflow} onCreate={()=>{}} onClone={() => alert("Clone not available for shared items.")} onShare={() => alert("Re-share not available for shared items.")} currentUser={currentUser} hideUserFilter={true} sharedItemIds={props.sharedItemIds} granterEmails={sharerEmails} granterFilterValue={sharedByUserFilter} onGranterFilterChange={setSharedByUserFilter}/> : <EmptyState type="Workflows" />; break;
        case 'tools': content = sharedTools.length > 0 ? <ToolsList tools={sharedTools} onEdit={props.onEditTool} onDelete={props.onDeleteTool} onCreate={()=>{}} onClone={() => alert("Clone not available for shared items.")} onShare={() => alert("Re-share not available for shared items.")} currentUser={currentUser} hideUserFilter={true} sharedItemIds={props.sharedItemIds} granterEmails={sharerEmails} granterFilterValue={sharedByUserFilter} onGranterFilterChange={setSharedByUserFilter}/> : <EmptyState type="Tools" />; break;
        case 'knowledgeBases': content = sharedKBs.length > 0 ? <KnowledgeBaseList knowledgeBases={sharedKBs} onEdit={props.onEditKnowledgeBase} onDelete={props.onDeleteKnowledgeBase} onCreate={()=>{}} onShare={() => alert("Re-share not available for shared items.")} currentUser={currentUser} hideUserFilter={true} sharedItemIds={props.sharedItemIds} granterEmails={sharerEmails} granterFilterValue={sharedByUserFilter} onGranterFilterChange={setSharedByUserFilter}/> : <EmptyState type="Knowledge Bases" />; break;
        case 'guardrails': content = sharedGuardrails.length > 0 ? <GuardrailList guardrails={sharedGuardrails} onEdit={props.onEditGuardrail} onDelete={props.onDeleteGuardrail} onCreate={()=>{}} onShare={() => alert("Re-share not available for shared items.")} currentUser={currentUser} hideUserFilter={true} sharedItemIds={props.sharedItemIds} granterEmails={sharerEmails} granterFilterValue={sharedByUserFilter} onGranterFilterChange={setSharedByUserFilter}/> : <EmptyState type="Guardrails" />; break;
        default: content = null;
    }
    
    return (
        <div className="p-4">{content}</div>
    )
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-[#09090b]">
      <header className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <FolderGit2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">My Workspace</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">Manage items you have created or that have been shared with you.</p>
          </div>
        </div>
      </header>
      
      <div className="border-b border-zinc-200 dark:border-zinc-800 px-6">
        <nav className="-mb-px flex space-x-8" aria-label="Main Tabs">
          <button
            onClick={() => setActiveMainTab('myCreations')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeMainTab === 'myCreations' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
          >
            <FolderGit2 className="w-4 h-4" />
            My Creations
          </button>
          <button
            onClick={() => setActiveMainTab('sharedWithMe')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeMainTab === 'sharedWithMe' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
          >
            <Share2 className="w-4 h-4" />
            Granted Access Items
          </button>
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeMainTab === 'myCreations' ? (
          <>
            <div className="border-b border-zinc-200 dark:border-zinc-800 px-6">
              <nav className="-mb-px flex space-x-8" aria-label="Item Tabs">
                {itemTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveItemTab(tab.id)}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeItemTab === tab.id ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeItemTab === tab.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>{tab.count}</span>
                  </button>
                ))}
              </nav>
            </div>
            <div className="p-4">
              {renderMyCreations()}
            </div>
          </>
        ) : (
           <>
            <div className="border-b border-zinc-200 dark:border-zinc-800 px-6">
              <nav className="-mb-px flex space-x-8" aria-label="Item Tabs">
                {sharedItemTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveItemTab(tab.id)}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeItemTab === tab.id ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeItemTab === tab.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>{tab.count}</span>
                  </button>
                ))}
              </nav>
            </div>
            {renderSharedWithMe()}
          </>
        )}
      </div>
    </div>
  );
};
