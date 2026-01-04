import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { AgentList } from './components/AgentList';
import { AgentEditor } from './components/AgentEditor';
import { WorkflowList } from './components/WorkflowList';
import { WorkflowEditor } from './components/WorkflowEditor';
import { ExecutionPanel } from './components/ExecutionPanel';
import { ToolsList } from './components/ToolsList';
import { ToolEditor } from './components/ToolEditor';
import { ChatInterface } from './components/ChatInterface';
import { AgentTestView } from './components/AgentTestView';
import { AgentCompareView } from './components/AgentCompareView';
import { SettingsView } from './components/SettingsView';
import { KnowledgeBaseList } from './components/KnowledgeBaseList';
import { KnowledgeBaseEditor } from './components/KnowledgeBaseEditor';
import { GuardrailList } from './components/GuardrailList';
import { GuardrailEditor } from './components/GuardrailEditor';
import { GuardrailTestView } from './components/GuardrailTestView';
import { MyCreationsView } from './components/MyCreationsView';
import { Agent, Workflow, Tool, WorkflowType, DBModel, User, KnowledgeBase, Guardrail } from './types';
import { dbService } from './services/db';
import { Users, GitBranch, Play, Loader2, PanelRight, Hammer, MessageSquare, AlertCircle, X, Settings, LogOut, Database, Shield, FolderGit2 } from 'lucide-react';
import { Login } from './components/Login';
import { SessionTimeoutModal } from './components/SessionTimeoutModal';
import { Toast, ToastProps } from './components/Toast';
import { UnsavedChangesModal } from './components/UnsavedChangesModal';
import { ShareModal } from './components/ShareModal';

type AppView = 'agentList' | 'agentEditor' | 'agentTester' | 'agentComparer' | 'workflowList' | 'workflowEditor' | 'toolList' | 'toolEditor' | 'knowledgeBaseList' | 'knowledgeBaseEditor' | 'guardrailList' | 'guardrailEditor' | 'guardrailTester' | 'execution' | 'chat' | 'settings' | 'myCreations';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>('agentList');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [guardrails, setGuardrails] = useState<Guardrail[]>([]);
  const [models, setModels] = useState<DBModel[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [sharedItemIds, setSharedItemIds] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [editingKnowledgeBase, setEditingKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [editingGuardrail, setEditingGuardrail] = useState<Guardrail | null>(null);
  const [testingAgent, setTestingAgent] = useState<Agent | null>(null);
  const [comparingAgent, setComparingAgent] = useState<Agent | null>(null);
  const [testingGuardrail, setTestingGuardrail] = useState<Guardrail | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [deletionTarget, setDeletionTarget] = useState<{ type: 'agent' | 'workflow' | 'tool' | 'knowledgeBase' | 'guardrail', id: string, name: string } | null>(null);
  const [navigationSource, setNavigationSource] = useState<{ view: AppView, data: any } | null>(null);
  const [sharingTarget, setSharingTarget] = useState<{ itemType: 'agent' | 'workflow' | 'tool' | 'knowledgeBase' | 'guardrail', itemId: string, itemName: string } | null>(null);

  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [toasts, setToasts] = useState<Omit<ToastProps, 'onClose'>[]>([]);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSessionTimeoutModalOpen, setIsSessionTimeoutModalOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const warningTimeoutRef = useRef<number | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const addToast = (message: string, type: 'success' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isEditorDirty) {
        event.preventDefault();
        event.returnValue = ''; // Required for Chrome
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isEditorDirty]);

  const handleLogin = async (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    await reloadAllData(user);
  };
  
  const requestLogout = () => {
    setShowLogoutConfirm(true);
  };
  
  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setIsSessionTimeoutModalOpen(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    setShowLogoutConfirm(false);
  };
  
  const resetTimeout = () => {
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsSessionTimeoutModalOpen(false);

    warningTimeoutRef.current = window.setTimeout(() => setIsSessionTimeoutModalOpen(true), 15 * 60 * 1000);
    timeoutRef.current = window.setTimeout(() => handleLogout(), 16 * 60 * 1000);
  };

  useEffect(() => {
    if (currentUser) {
      const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
      const reset = () => resetTimeout();
      events.forEach(event => window.addEventListener(event, reset));
      resetTimeout();
      return () => {
        events.forEach(event => window.removeEventListener(event, reset));
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      };
    }
  }, [currentUser]);

  useEffect(() => {
    const init = async () => {
      try {
        const storedUser = localStorage.getItem('currentUser');
        const user = storedUser ? JSON.parse(storedUser) : null;
        if (user) {
          setCurrentUser(user);
          await dbService.initSchema();
          await reloadAllData(user);
        } else {
           await dbService.initSchema();
           await reloadAllData(null);
        }
      } catch (e) { console.error("Initialization error:", e); } 
      finally { setIsLoading(false); }
    };
    init();
  }, []);

  const reloadAllData = async (user: User | null) => {
    if (!user) {
        setAgents([]); setWorkflows([]); setTools([]); setModels([]); setKnowledgeBases([]); setGuardrails([]); setAllUsers([]); setSharedItemIds({});
        return;
    }
    const [agents, workflows, tools, models, kbs, guardrails, users, sharedIds] = await Promise.all([
      dbService.getAgents(user), dbService.getWorkflows(user), dbService.getTools(user), dbService.getModels(), dbService.getKnowledgeBases(user), dbService.getGuardrails(user), dbService.getAllUsers(), dbService.getSharedItemIdsForUser(user.id)
    ]);
    setAgents(agents); setWorkflows(workflows); setTools(tools); setModels(models); setKnowledgeBases(kbs); setGuardrails(guardrails); setAllUsers(users); setSharedItemIds(sharedIds);
  };

  const navigateTo = (view: AppView) => {
    setEditingAgent(null); setEditingWorkflow(null); setEditingTool(null); setEditingGuardrail(null);
    setTestingAgent(null); setComparingAgent(null); setEditingKnowledgeBase(null); setTestingGuardrail(null);
    setNavigationSource(null); setIsEditorDirty(false); setIsCloning(false);
    setActiveView(view);
  };

  const handleNavigationRequest = (view: AppView) => {
    const proceed = () => navigateTo(view);
    if (isEditorDirty) {
      setPendingNavigation(() => proceed);
    } else {
      proceed();
    }
  };

  const handleReturnToSource = async () => {
      if (navigationSource?.view === 'myCreations') {
        navigateTo('myCreations');
      } else if (navigationSource?.view === 'agentEditor') {
        const updatedAgents = await dbService.getAgents(currentUser!);
        const agentToReturnTo = updatedAgents.find(a => a.id === navigationSource.data.id) || navigationSource.data;
        setAgents(updatedAgents);
        setEditingAgent(agentToReturnTo);
        setActiveView('agentEditor');
      } else if (navigationSource?.view === 'workflowEditor') {
        const updatedWorkflow = await dbService.getWorkflows(currentUser!).then(ws => ws.find(w => w.metadata.id === navigationSource.data.metadata.id));
        setEditingWorkflow(updatedWorkflow || navigationSource.data);
        setActiveView('workflowEditor');
      }
      setNavigationSource(null);
      setIsEditorDirty(false);
  }
  
  const createCancelHandler = (defaultListView: AppView) => {
    return () => {
        const proceed = () => {
            if (navigationSource) {
                handleReturnToSource();
            } else {
                navigateTo(defaultListView);
            }
        };

        if (isEditorDirty) {
            setPendingNavigation(() => proceed);
        } else {
            proceed();
        }
    }
  };


  const handleSaveAgent = async (agent: Agent) => {
    if (!currentUser) return;
    try {
      await dbService.saveAgent(agent, currentUser.id);
      addToast('Saved successfully.');
      await reloadAllData(currentUser);
      if (navigationSource) {
        handleReturnToSource();
      } else {
        navigateTo('agentList');
      }
    } catch (e: any) { alert(`Failed to save agent: ${e.message || 'Unknown error'}`); }
  };
  
  const handleTestAgent = async (agent: Agent) => {
    if (!currentUser) return;
    try {
      await dbService.saveAgent(agent, currentUser.id);
      addToast('Saved successfully.');
      const updatedAgents = await dbService.getAgents(currentUser);
      setAgents(updatedAgents);
      const agentToTest = updatedAgents.find(a => a.id === agent.id) || agent;
      setTestingAgent(agentToTest);
      setActiveView('agentTester');
      setIsEditorDirty(false);
    } catch(e) { alert("Failed to save and prepare for test."); }
  };

  const handleSaveAndCompare = async (agent: Agent) => {
    if (!currentUser) return;
    try {
      await dbService.saveAgent(agent, currentUser.id);
      addToast('Saved successfully.');
      const updatedAgents = await dbService.getAgents(currentUser);
      setAgents(updatedAgents);
      const agentToCompare = updatedAgents.find(a => a.id === agent.id) || agent;
      setComparingAgent(agentToCompare);
      setActiveView('agentComparer');
      setIsEditorDirty(false);
    } catch (e) { alert("Failed to save and prepare for comparison."); }
  };

  const handleEditAgent = (agent: Agent) => { setEditingAgent(agent); setActiveView('agentEditor'); };
  const handleEditAgentFromWorkflow = (agent: Agent, workflow: Workflow) => { setNavigationSource({ view: 'workflowEditor', data: workflow }); setEditingAgent(agent); setActiveView('agentEditor'); };
  const handleEditAgentFromMyCreations = (agent: Agent) => { setNavigationSource({ view: 'myCreations', data: null }); handleEditAgent(agent); }

  const handleCreateAgent = () => {
    const defaultGuardrailIds = guardrails.filter(g => g.isDefault).map(g => g.id);
    setEditingAgent({
      id: crypto.randomUUID(), name: '', description: '', role: '', domain: '', goal: '', backstory: '', taskDescription: '', inputs: [],
      expectedOutput: '', outputFileExtension: '.txt', managerCondition: undefined, toolIds: [], knowledgeBaseIds: [], guardrailIds: defaultGuardrailIds, version: 1, versions: [],
      config: { aiEngine: 'GoogleAI', model: 'gemini-3-flash-preview', temperature: 0.2, topP: 0.95, maxRPM: 0, maxExecutionTime: 0, maxIterations: 0 }
    });
    setActiveView('agentEditor');
  };

  const handleCloneAgent = (agent: Agent) => {
    const newAgent: Agent = {
      ...JSON.parse(JSON.stringify(agent)),
      id: crypto.randomUUID(), name: '', description: '', version: 1, versions: [],
      created_at: undefined, updated_at: undefined, created_by: undefined, updated_by: undefined, created_by_email: undefined, updated_by_email: undefined,
    };
    setIsCloning(true); setEditingAgent(newAgent); setActiveView('agentEditor');
  };

  const handleDeleteAgent = (id: string) => { if (agents.find(a => a.id === id)) setDeletionTarget({ type: 'agent', id, name: agents.find(a => a.id === id)!.name }); };

  const handleSaveWorkflow = async (workflow: Workflow) => {
    if (!currentUser) return;
    await dbService.saveWorkflow(workflow, currentUser.id);
    addToast('Saved successfully.');
    await reloadAllData(currentUser);
    if (navigationSource) {
      handleReturnToSource();
    } else {
      navigateTo('workflowList');
    }
  };
  const handleEditWorkflowFromMyCreations = (workflow: Workflow) => { setNavigationSource({ view: 'myCreations', data: null }); setEditingWorkflow(workflow); setActiveView('workflowEditor'); }


  const handleCloneWorkflow = (workflow: Workflow) => {
    const idMap: Record<string, string> = {};
    const newNodes = workflow.nodes.map(node => { const newId = crypto.randomUUID(); idMap[node.id] = newId; return { ...node, id: newId }; });
    const newWorkflow: Workflow = {
      metadata: { ...workflow.metadata, id: crypto.randomUUID(), name: '', description: '' },
      nodes: newNodes,
      edges: workflow.edges.map(edge => ({ ...edge, id: crypto.randomUUID(), source: idMap[edge.source], target: idMap[edge.target] })),
      created_at: undefined, updated_at: undefined, created_by: undefined, updated_by: undefined, created_by_email: undefined, updated_by_email: undefined,
    };
    setIsCloning(true); setEditingWorkflow(newWorkflow); setActiveView('workflowEditor');
  };

  const handleDeleteWorkflow = (id: string) => { if (workflows.find(w => w.metadata.id === id)) setDeletionTarget({ type: 'workflow', id, name: workflows.find(w => w.metadata.id === id)!.metadata.name }); };

  const handleCreateTool = () => { setEditingTool({ id: crypto.randomUUID(), name: '', description: '', className: '', language: 'javascript', parameters: { type: 'OBJECT', properties: {}, required: [] }, code: `async (args) => {\n  // Implementation here\n  return 'Success';\n}` }); setActiveView('toolEditor'); };
  const handleCreateToolFromEditor = (sourceAgent: Agent) => { setNavigationSource({ view: 'agentEditor', data: sourceAgent }); handleCreateTool(); };

  const handleSaveTool = async (tool: Tool) => {
    if (!currentUser) return;
    await dbService.saveTool(tool, currentUser.id);
    addToast('Saved successfully.');
    await reloadAllData(currentUser);
    if (navigationSource) {
      handleReturnToSource();
    } else {
      navigateTo('toolList');
    }
  };
  const handleEditToolFromMyCreations = (tool: Tool) => { setNavigationSource({ view: 'myCreations', data: null }); setEditingTool(tool); setActiveView('toolEditor'); }

  const handleCloneTool = (tool: Tool) => {
    const newTool: Tool = {
      ...JSON.parse(JSON.stringify(tool)), id: crypto.randomUUID(), name: '', description: '', className: '',
      created_at: undefined, updated_at: undefined, created_by: undefined, updated_by: undefined, created_by_email: undefined, updated_by_email: undefined,
    };
    setIsCloning(true); setEditingTool(newTool); setActiveView('toolEditor');
  };

  const handleDeleteTool = (id: string) => { if (tools.find(t => t.id === id)) setDeletionTarget({ type: 'tool', id, name: tools.find(t => t.id === id)!.name }); };

  const handleCreateKnowledgeBase = () => { setEditingKnowledgeBase({ id: crypto.randomUUID(), name: '', description: '', file_names: [] }); setActiveView('knowledgeBaseEditor'); };
  const handleCreateKBFromEditor = (sourceAgent: Agent) => { setNavigationSource({ view: 'agentEditor', data: sourceAgent }); handleCreateKnowledgeBase(); };

  const handleSaveKnowledgeBase = async () => {
    addToast('Saved successfully.');
    await reloadAllData(currentUser!);
    if (navigationSource) {
      handleReturnToSource();
    } else {
      navigateTo('knowledgeBaseList');
    }
  };
  const handleEditKnowledgeBaseFromMyCreations = (kb: KnowledgeBase) => { setNavigationSource({ view: 'myCreations', data: null }); setEditingKnowledgeBase(kb); setActiveView('knowledgeBaseEditor'); }


  const handleDeleteKnowledgeBase = (id: string) => { if (knowledgeBases.find(k => k.id === id)) setDeletionTarget({ type: 'knowledgeBase', id, name: knowledgeBases.find(k => k.id === id)!.name }); };

  const handleCreateGuardrail = () => { setEditingGuardrail({ id: crypto.randomUUID(), name: '', description: '', appliesToInput: true, appliesToOutput: true, method: 'keyword_filter', config: { keywords: [] }, isDefault: false }); setActiveView('guardrailEditor'); };
  const handleCreateGuardrailFromEditor = (sourceAgent: Agent) => { setNavigationSource({ view: 'agentEditor', data: sourceAgent }); handleCreateGuardrail(); };

  const handleSaveGuardrail = async (guardrail: Guardrail) => {
    if (!currentUser) return;
    await dbService.saveGuardrail(guardrail, currentUser.id);
    addToast('Guardrail saved successfully.');
    await reloadAllData(currentUser);
    if (navigationSource) {
      handleReturnToSource();
    } else {
      navigateTo('guardrailList');
    }
  };
  const handleEditGuardrailFromMyCreations = (g: Guardrail) => { setNavigationSource({ view: 'myCreations', data: null }); setEditingGuardrail(g); setActiveView('guardrailEditor'); }


  const handleTestGuardrail = async (guardrail: Guardrail) => {
    if (!currentUser) return;
    try {
      await dbService.saveGuardrail(guardrail, currentUser.id);
      addToast('Guardrail saved successfully.');
      await reloadAllData(currentUser);
      const guardrailToTest = (await dbService.getGuardrails(currentUser)).find(g => g.id === guardrail.id) || guardrail;
      setTestingGuardrail(guardrailToTest);
      setActiveView('guardrailTester');
      setIsEditorDirty(false);
    } catch(e) {
        alert("Failed to save and prepare for test.");
    }
  };

  const handleDeleteGuardrail = (id: string) => { if (guardrails.find(g => g.id === id)) setDeletionTarget({ type: 'guardrail', id, name: guardrails.find(g => g.id === id)!.name }); };

  const handleConfirmDelete = async () => {
    if (!deletionTarget || !currentUser) return;
    try {
        switch (deletionTarget.type) {
            case 'agent': await dbService.deleteAgent(deletionTarget.id); break;
            case 'workflow': await dbService.deleteWorkflow(deletionTarget.id); break;
            case 'tool': await dbService.deleteTool(deletionTarget.id); break;
            case 'knowledgeBase': await dbService.deleteKnowledgeBase(deletionTarget.id); break;
            case 'guardrail': await dbService.deleteGuardrail(deletionTarget.id); break;
        }
        addToast(`${deletionTarget.type.charAt(0).toUpperCase() + deletionTarget.type.slice(1)} deleted.`);
        await reloadAllData(currentUser);
    } catch (e) {
        alert(`Failed to delete ${deletionTarget.type}.`);
    } finally {
        setDeletionTarget(null);
    }
  };

  const renderActiveView = () => {
    if (!currentUser) return null;
    switch (activeView) {
      case 'agentList': return <AgentList agents={agents} tools={tools} models={models} onEdit={handleEditAgent} onDelete={handleDeleteAgent} onCreate={handleCreateAgent} onClone={handleCloneAgent} onShare={(item) => setSharingTarget({ itemType: 'agent', itemId: item.id, itemName: item.name })} currentUser={currentUser} sharedItemIds={sharedItemIds} />;
      case 'agentEditor': return editingAgent && <AgentEditor agent={editingAgent} agents={agents} tools={tools} knowledgeBases={knowledgeBases} guardrails={guardrails} allUsers={allUsers} onSave={handleSaveAgent} onTest={handleTestAgent} onCancel={createCancelHandler('agentList')} onSaveAndCompare={handleSaveAndCompare} onCreateTool={() => handleCreateToolFromEditor(editingAgent)} onCreateKnowledgeBase={() => handleCreateKBFromEditor(editingAgent)} onCreateGuardrail={() => handleCreateGuardrailFromEditor(editingAgent)} currentUser={currentUser} setIsDirty={setIsEditorDirty} isClone={isCloning} isSharedWithMe={sharedItemIds.agent.includes(editingAgent.id)} />;
      case 'agentTester': return testingAgent && <AgentTestView agent={testingAgent} onBack={() => { setTestingAgent(null); setActiveView('agentEditor'); setEditingAgent(testingAgent); }} />;
      case 'agentComparer': return comparingAgent && <AgentCompareView agent={comparingAgent} allUsers={allUsers} onBack={() => { setComparingAgent(null); setActiveView('agentEditor'); setEditingAgent(comparingAgent); }} currentUser={currentUser} />;
      case 'workflowList': return <WorkflowList workflows={workflows} onEdit={(w) => { setEditingWorkflow(w); setActiveView('workflowEditor'); }} onDelete={handleDeleteWorkflow} onCreate={() => { setEditingWorkflow({ metadata: { id: crypto.randomUUID(), name: '', description: '', type: WorkflowType.SEQUENTIAL, useManager: false, managerModel: 'gemini-3-pro-preview', managerTemperature: 0.2, managerTopP: 0.95, managerMaxIterations: 5 }, nodes: [], edges: [] }); setActiveView('workflowEditor'); }} onClone={handleCloneWorkflow} onShare={(item) => setSharingTarget({ itemType: 'workflow', itemId: item.metadata.id, itemName: item.metadata.name })} currentUser={currentUser} sharedItemIds={sharedItemIds} />;
      case 'workflowEditor': return editingWorkflow && <WorkflowEditor workflow={editingWorkflow} workflows={workflows} agents={agents} onSave={handleSaveWorkflow} onCancel={createCancelHandler('workflowList')} onEditAgent={(agent) => handleEditAgentFromWorkflow(agent, editingWorkflow)} setIsDirty={setIsEditorDirty} isClone={isCloning} />;
      case 'toolList': return <ToolsList tools={tools} onEdit={(t) => { setEditingTool(t); setActiveView('toolEditor'); }} onDelete={handleDeleteTool} onCreate={handleCreateTool} onClone={handleCloneTool} onShare={(item) => setSharingTarget({ itemType: 'tool', itemId: item.id, itemName: item.name })} currentUser={currentUser} sharedItemIds={sharedItemIds} />;
      case 'toolEditor': return editingTool && <ToolEditor tool={editingTool} onSave={handleSaveTool} onCancel={createCancelHandler('toolList')} setIsDirty={setIsEditorDirty} isClone={isCloning} />;
      case 'knowledgeBaseList': return <KnowledgeBaseList knowledgeBases={knowledgeBases} onEdit={(kb) => { setEditingKnowledgeBase(kb); setActiveView('knowledgeBaseEditor'); }} onDelete={handleDeleteKnowledgeBase} onCreate={handleCreateKnowledgeBase} onShare={(item) => setSharingTarget({ itemType: 'knowledgeBase', itemId: item.id, itemName: item.name })} currentUser={currentUser} sharedItemIds={sharedItemIds} />;
      case 'knowledgeBaseEditor': return editingKnowledgeBase && <KnowledgeBaseEditor knowledgeBase={editingKnowledgeBase} onSave={handleSaveKnowledgeBase} onCancel={createCancelHandler('knowledgeBaseList')} currentUser={currentUser} setIsDirty={setIsEditorDirty} isClone={isCloning} />;
      case 'guardrailList': return <GuardrailList guardrails={guardrails} onEdit={(g) => { setEditingGuardrail(g); setActiveView('guardrailEditor'); }} onDelete={handleDeleteGuardrail} onCreate={handleCreateGuardrail} onShare={(item) => setSharingTarget({ itemType: 'guardrail', itemId: item.id, itemName: item.name })} currentUser={currentUser} sharedItemIds={sharedItemIds} />;
      case 'guardrailEditor': return editingGuardrail && <GuardrailEditor guardrail={editingGuardrail} onSave={handleSaveGuardrail} onTest={handleTestGuardrail} onCancel={createCancelHandler('guardrailList')} currentUser={currentUser} setIsDirty={setIsEditorDirty} />;
      case 'guardrailTester': return testingGuardrail && <GuardrailTestView guardrail={testingGuardrail} onBack={() => { setTestingGuardrail(null); setActiveView('guardrailEditor'); setEditingGuardrail(testingGuardrail); }} />;
      case 'myCreations': return <MyCreationsView currentUser={currentUser} allAgents={agents} allWorkflows={workflows} allTools={tools} allKnowledgeBases={knowledgeBases} allGuardrails={guardrails} onEditAgent={handleEditAgentFromMyCreations} onEditWorkflow={handleEditWorkflowFromMyCreations} onEditTool={handleEditToolFromMyCreations} onEditKnowledgeBase={handleEditKnowledgeBaseFromMyCreations} onEditGuardrail={handleEditGuardrailFromMyCreations} onDeleteAgent={handleDeleteAgent} onDeleteWorkflow={handleDeleteWorkflow} onDeleteTool={handleDeleteTool} onDeleteKnowledgeBase={handleDeleteKnowledgeBase} onDeleteGuardrail={handleDeleteGuardrail} sharedItemIds={sharedItemIds} onShareAgent={(item) => setSharingTarget({ itemType: 'agent', itemId: item.id, itemName: item.name })} onShareWorkflow={(item) => setSharingTarget({ itemType: 'workflow', itemId: item.metadata.id, itemName: item.metadata.name })} onShareTool={(item) => setSharingTarget({ itemType: 'tool', itemId: item.id, itemName: item.name })} onShareKnowledgeBase={(item) => setSharingTarget({ itemType: 'knowledgeBase', itemId: item.id, itemName: item.name })} onShareGuardrail={(item) => setSharingTarget({ itemType: 'guardrail', itemId: item.id, itemName: item.name })} />;
      case 'execution': return <ExecutionPanel workflows={workflows} agents={agents} tools={tools} currentUser={currentUser} />;
      case 'chat': return currentUser && <ChatInterface currentUser={currentUser} />;
      case 'settings': return <SettingsView currentTheme={theme} onThemeChange={(t) => setTheme(t)} currentUser={currentUser} />;
      default: return <AgentList agents={agents} tools={tools} models={models} onEdit={handleEditAgent} onDelete={handleDeleteAgent} onCreate={handleCreateAgent} onClone={handleCloneAgent} onShare={(item) => setSharingTarget({ itemType: 'agent', itemId: item.id, itemName: item.name })} currentUser={currentUser} sharedItemIds={sharedItemIds} />;
    }
  };

  if (isLoading) return <div className="h-screen w-full bg-zinc-50 dark:bg-[#09090b] flex flex-col items-center justify-center gap-4"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /><p className="text-zinc-500 dark:text-zinc-500 font-medium animate-pulse uppercase tracking-widest text-xs">Accessing System Registry...</p></div>;
  if (!currentUser) return <Login onLogin={handleLogin} />;
  let activeTab: 'agents'|'workflows'|'execution'|'tools'|'knowledgeBase'|'guardrails'|'chat'|'settings'|'myCreations';
  if (activeView.includes('agent')) activeTab = 'agents'; else if (activeView.includes('workflow')) activeTab = 'workflows'; else if (activeView.includes('tool')) activeTab = 'tools'; else if (activeView.includes('knowledgeBase')) activeTab = 'knowledgeBase'; else if (activeView.includes('guardrail')) activeTab = 'guardrails'; else activeTab = activeView as any;

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 overflow-hidden relative">
      <Sidebar activeTab={activeTab} onTabChange={(tab) => {
          const viewMap = { agents: 'agentList', workflows: 'workflowList', tools: 'toolList', knowledgeBase: 'knowledgeBaseList', guardrails: 'guardrailList' };
          handleNavigationRequest(viewMap[tab] || tab);
        }} isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} currentUser={currentUser} onLogoutRequest={requestLogout} />
      {isSidebarCollapsed && (
        <div className="w-14 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] flex flex-col items-center py-6 gap-6 z-50 transition-all">
          <button onClick={() => setIsSidebarCollapsed(false)} className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-500 dark:text-indigo-400 rounded-lg border border-indigo-600/20 transition-all shadow-lg" title="Expand Navigation"><PanelRight className="w-5 h-5" /></button>
          <div className="flex flex-col gap-4">
            <button onClick={() => handleNavigationRequest('myCreations')} className={`p-2 rounded-lg transition-all ${activeTab === 'myCreations' ? 'bg-zinc-200 dark:bg-zinc-800 text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-400'}`}><FolderGit2 className="w-5 h-5" /></button>
            <div className="h-px w-8 bg-zinc-200 dark:bg-zinc-800 mx-auto" />
            <button onClick={() => handleNavigationRequest('agentList')} className={`p-2 rounded-lg transition-all ${activeTab === 'agents' ? 'bg-zinc-200 dark:bg-zinc-800 text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-400'}`}><Users className="w-5 h-5" /></button>
            <button onClick={() => handleNavigationRequest('workflowList')} className={`p-2 rounded-lg transition-all ${activeTab === 'workflows' ? 'bg-zinc-200 dark:bg-zinc-800 text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-400'}`}><GitBranch className="w-5 h-5" /></button>
            <button onClick={() => handleNavigationRequest('toolList')} className={`p-2 rounded-lg transition-all ${activeTab === 'tools' ? 'bg-zinc-200 dark:bg-zinc-800 text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-400'}`}><Hammer className="w-5 h-5" /></button>
            <button onClick={() => handleNavigationRequest('knowledgeBaseList')} className={`p-2 rounded-lg transition-all ${activeTab === 'knowledgeBase' ? 'bg-zinc-200 dark:bg-zinc-800 text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-400'}`}><Database className="w-5 h-5" /></button>
            <button onClick={() => handleNavigationRequest('guardrailList')} className={`p-2 rounded-lg transition-all ${activeTab === 'guardrails' ? 'bg-zinc-200 dark:bg-zinc-800 text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-400'}`}><Shield className="w-5 h-5" /></button>
            <button onClick={() => handleNavigationRequest('execution')} className={`p-2 rounded-lg transition-all ${activeTab === 'execution' ? 'bg-zinc-200 dark:bg-zinc-800 text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-400'}`}><Play className="w-5 h-5" /></button>
            <button onClick={() => handleNavigationRequest('chat')} className={`p-2 rounded-lg transition-all ${activeTab === 'chat' ? 'bg-zinc-200 dark:bg-zinc-800 text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-400'}`}><MessageSquare className="w-5 h-5" /></button>
          </div>
          <div className="mt-auto"><button onClick={() => handleNavigationRequest('settings')} className={`p-2 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-zinc-200 dark:bg-zinc-800 text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-400'}`}><Settings className="w-5 h-5" /></button></div>
        </div>
      )}
      <main className="flex-1 relative overflow-auto transition-all duration-300">{renderActiveView()}</main>
      <div className="fixed top-6 right-6 z-[110] space-y-2">{toasts.map(toast => <Toast key={toast.id} {...toast} onClose={removeToast} />)}</div>
      {pendingNavigation && <UnsavedChangesModal onStay={() => setPendingNavigation(null)} onLeave={() => { pendingNavigation(); setPendingNavigation(null); }} />}
      {sharingTarget && currentUser && <ShareModal isOpen={!!sharingTarget} onClose={() => setSharingTarget(null)} itemType={sharingTarget.itemType} itemId={sharingTarget.itemId} itemName={sharingTarget.itemName} currentUser={currentUser} onSuccess={() => addToast('Sharing permissions updated.')} />}
      
      {deletionTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 relative">
                <div className="flex items-center gap-4 text-amber-500 mb-6">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-200 dark:border-amber-500/20">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Confirm Deletion</h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
                    Are you sure you want to delete the {deletionTarget.type} "<strong className="text-zinc-800 dark:text-zinc-200">{deletionTarget.name}</strong>"? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                    <button onClick={() => setDeletionTarget(null)} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-200 dark:border-zinc-800">
                        Cancel
                    </button>
                    <button onClick={handleConfirmDelete} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-red-600/20">
                        Delete
                    </button>
                </div>
                <button onClick={() => setDeletionTarget(null)} className="absolute top-4 right-4 text-zinc-500 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 relative">
                <div className="flex items-center gap-4 text-indigo-500 mb-6">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20">
                        <LogOut className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Confirm Logout</h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
                    Are you sure you want to sign out of your account?
                </p>
                <div className="flex gap-3">
                    <button onClick={cancelLogout} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-200 dark:border-zinc-800">
                        Cancel
                    </button>
                    <button onClick={handleLogout} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-red-600/20">
                        Logout
                    </button>
                </div>
                <button onClick={cancelLogout} className="absolute top-4 right-4 text-zinc-500 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
      )}

      <SessionTimeoutModal isOpen={isSessionTimeoutModalOpen} onLogout={handleLogout} onStay={() => { resetTimeout(); setIsSessionTimeoutModalOpen(false); }} />
    </div>
  );
};
export default App;