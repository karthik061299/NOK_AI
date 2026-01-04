
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Workflow, Agent, WorkflowType, WorkflowNode, WorkflowEdge, DBModel } from '../types';
import { dbService } from '../services/db';
import { 
  Save, X, Zap, ArrowRight, Search, Cpu, GripVertical, User, 
  AlertCircle, CheckCircle2, RotateCcw, UserCheck, Edit2, Plus, Minus, ChevronDown, AlertTriangle
} from 'lucide-react';

interface WorkflowEditorProps {
  workflow: Workflow;
  workflows: Workflow[];
  agents: Agent[];
  onSave: (workflow: Workflow) => void;
  onCancel: () => void;
  onEditAgent: (agent: Agent) => void;
  setIsDirty: (isDirty: boolean) => void;
  isClone?: boolean;
}

const detectCycle = (nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean => {
  const adjacencyList = new Map<string, string[]>();
  nodes.forEach(n => adjacencyList.set(n.id, []));
  edges.forEach(e => {
    if (adjacencyList.has(e.source)) {
      adjacencyList.get(e.source)!.push(e.target);
    }
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();

  const isCyclicUtil = (v: string): boolean => {
    if (!visited.has(v)) {
      visited.add(v);
      recStack.add(v);
      for (const neighbor of adjacencyList.get(v) || []) {
        if (!visited.has(neighbor) && isCyclicUtil(neighbor)) return true;
        else if (recStack.has(neighbor)) return true;
      }
    }
    recStack.delete(v);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.id) && isCyclicUtil(node.id)) {
      return true;
    }
  }
  return false;
};

const hasParallelism = (edges: WorkflowEdge[]): boolean => {
  const sourceCounts = new Map<string, number>();
  for (const edge of edges) {
    sourceCounts.set(edge.source, (sourceCounts.get(edge.source) || 0) + 1);
  }
  for (const count of sourceCounts.values()) {
    if (count > 1) {
      return true;
    }
  }
  return false;
};

const hasHumanCheckpoint = (nodes: WorkflowNode[]): boolean => {
  return nodes.some(n => n.type === 'human');
};

const ManagerSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step, onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500">
      <span>{label}</span>
      <span className="text-indigo-600 dark:text-indigo-400 mono">{step >= 1 ? (value ?? 0).toFixed(0) : (value ?? 0).toFixed(2)}</span>
    </div>
    <input 
      type="range" min={min} max={max} step={step} value={value ?? 0} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-zinc-300 dark:bg-zinc-800 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
    />
  </div>
);

const allowedManagerModels = new Set([
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct'
]);

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow, workflows, agents, onSave, onCancel, onEditAgent, setIsDirty, isClone }) => {
  const [formData, setFormData] = useState<Workflow>(() => ({
    ...workflow,
    nodes: workflow.nodes.map(n => ({...n, type: n.type || 'agent'})),
    metadata: {
      ...workflow.metadata,
      managerTemperature: workflow.metadata.managerTemperature ?? 0.2,
      managerTopP: workflow.metadata.managerTopP ?? 0.95,
      managerModel: workflow.metadata.managerModel || 'gemini-3-pro-preview',
      managerMaxIterations: workflow.metadata.managerMaxIterations ?? 5
    }
  }));
  const [models, setModels] = useState<DBModel[]>([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentDomainFilter, setAgentDomainFilter] = useState('');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [connStartNodeId, setConnStartNodeId] = useState<string | null>(null);
  const [isResetConfirmVisible, setIsResetConfirmVisible] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [validationErrors, setValidationErrors] = useState<{ name?: string, description?: string }>({});
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
        isInitialMount.current = false;
        if (isClone) setIsDirty(true);
    } else {
        setIsDirty(true);
    }
  }, [formData, setIsDirty, isClone]);

  useEffect(() => {
    dbService.getModels().then(allModels => setModels(allModels.filter(m => !m.id.includes('embedding'))));
  }, []);

  const addNodeAt = (type: 'agent' | 'human', agentId: string | null, x: number, y: number) => {
    const newNode: WorkflowNode = type === 'agent' 
      ? { id: crypto.randomUUID(), type: 'agent', agentId: agentId!, position: { x, y } }
      : { id: crypto.randomUUID(), type: 'human', position: { x, y } };

    setFormData(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
  };

  const removeNode = (id: string) => {
    setFormData(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== id),
      edges: prev.edges.filter(e => e.source !== id && e.target !== id)
    }));
  };

  const handleConfirmReset = () => {
    setFormData(prev => ({ 
      ...prev, 
      nodes: [], 
      edges: [] 
    }));
    setConnStartNodeId(null);
    setDraggingNodeId(null);
    setIsResetConfirmVisible(false);
  };

  const tryConnect = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    
    setFormData(prev => {
        const existingEdgeIndex = prev.edges.findIndex(e => e.source === sourceId && e.target === targetId);
        if (existingEdgeIndex > -1) {
            const newEdges = [...prev.edges];
            newEdges.splice(existingEdgeIndex, 1);
            return { ...prev, edges: newEdges };
        } else {
            const newEdge: WorkflowEdge = { id: `edge-${sourceId}-${targetId}`, source: sourceId, target: targetId };
            return { ...prev, edges: [...prev.edges, newEdge] };
        }
    });
    setConnStartNodeId(null);
  };

  const updateNodePosition = (id: string, x: number, y: number) => {
    setFormData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === id ? { ...n, position: { x, y } } : n)
    }));
  };

  const structuralValidation = useMemo(() => {
    const { nodes, edges, metadata } = formData;
    if (nodes.length === 0) return { valid: true, message: "" }; // Allow saving empty graph

    const cycleExists = detectCycle(nodes, edges);
    const parallelismExists = hasParallelism(edges);
    const humanCheckpointExists = hasHumanCheckpoint(nodes);

    switch (metadata.type) {
      case WorkflowType.SEQUENTIAL:
        if (cycleExists) return { valid: false, message: "Sequential workflows cannot contain cycles." };
        if (parallelismExists) return { valid: false, message: "Sequential workflows cannot have parallel branches." };
        break;
      case WorkflowType.CIRCULAR:
        if (!cycleExists) return { valid: false, message: "Circular workflow must contain at least one cycle." };
        if (parallelismExists) return { valid: false, message: "Circular workflows cannot have parallel branches." };
        if (!metadata.useManager) return { valid: false, message: "Manager LLM is required for Circular flows." };
        break;
      case WorkflowType.PARALLEL:
        if (cycleExists) return { valid: false, message: "Parallel workflows cannot contain cycles." };
        if (!parallelismExists) return { valid: false, message: "Parallel workflow must have at least one agent fanning out to multiple agents." };
        break;
      case WorkflowType.HUMAN_IN_THE_LOOP:
        if (!humanCheckpointExists) return { valid: false, message: "This workflow type requires at least one human checkpoint node." };
        if (cycleExists) return { valid: false, message: "Simple Human-in-the-loop flows cannot be circular. Use Hybrid for that." };
        break;
      case WorkflowType.HYBRID:
        const hasParallelAndHuman = parallelismExists && humanCheckpointExists;
        const hasCircularAndHuman = cycleExists && humanCheckpointExists;
        const hasParallelAndCircular = parallelismExists && cycleExists;
        if (!hasParallelAndHuman && !hasCircularAndHuman && !hasParallelAndCircular) {
            return { valid: false, message: "Hybrid workflows must contain a combination of parallel, circular, or human-in-the-loop elements." };
        }
        break;
      default:
        return { valid: false, message: "Unknown workflow type selected." };
    }
    
    return { valid: true, message: "" };
  }, [formData]);
  
  const handleSaveAttempt = () => {
      const errors: { name?: string, description?: string } = {};
      const name = formData.metadata.name.trim();
      const description = formData.metadata.description.trim();

      if (!name) {
        errors.name = "Please enter workflow name.";
      } else if (workflows.some(w => w.metadata.name.toLowerCase() === name.toLowerCase() && w.metadata.id !== formData.metadata.id)) {
        errors.name = "Workflow name already exists.";
      }
      
      if (!description) {
        errors.description = "Please enter workflow description.";
      }
      
      setValidationErrors(errors);

      if (Object.keys(errors).length > 0) {
        return;
      }
      
      if (!structuralValidation.valid) {
          return;
      }

      onSave(formData);
  };

  const showManagerWarning = useMemo(() => {
    if (formData.metadata.type !== WorkflowType.HYBRID || formData.metadata.useManager) return false;
    return detectCycle(formData.nodes, formData.edges);
  }, [formData]);

  const getLineData = (sourceId: string, targetId: string) => {
    const s = formData.nodes.find(n => n.id === sourceId);
    const t = formData.nodes.find(n => n.id === targetId);
    if (!s || !t) return null;
    
    const NODE_WIDTH = 256;
    const NODE_HEIGHT = 160;
    const isHumanNode = (node: WorkflowNode) => node.type === 'human';

    const sHeight = isHumanNode(s) ? 100 : NODE_HEIGHT;
    const tHeight = isHumanNode(t) ? 100 : NODE_HEIGHT;
    const sAnchorYOffset = sHeight / 1.5;
    const tAnchorYOffset = tHeight / 1.5;

    const isBackwards = t.position.x < s.position.x;

    const sx = isBackwards ? s.position.x : s.position.x + NODE_WIDTH;
    const sy = s.position.y + sAnchorYOffset;

    const tx = isBackwards ? t.position.x + NODE_WIDTH : t.position.x;
    const ty = t.position.y + tAnchorYOffset;
    
    const dx = tx - sx;
    const controlDist = Math.max(Math.abs(dx) / 1.5, 120);
    
    const cp1x = isBackwards ? sx - controlDist : sx + controlDist;
    const cp2x = isBackwards ? tx + controlDist : tx - controlDist;

    return { sx, sy, tx, ty, cp1x, cp2x };
  };

  const filteredAgents = agents.filter(a => {
    const matchesName = a.name.toLowerCase().includes(agentSearch.toLowerCase());
    const matchesDomain = !agentDomainFilter || a.domain === agentDomainFilter;
    return matchesName && matchesDomain;
  });

  const domains = Array.from(new Set(agents.map(a => a.domain))).sort();
  const showHumanNode = formData.metadata.type === WorkflowType.HYBRID || formData.metadata.type === WorkflowType.HUMAN_IN_THE_LOOP;

  return (
    <div className="h-full flex flex-col bg-zinc-100 dark:bg-[#09090b]">
      <header className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#0c0c0e]">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 -ml-2">
            <X className="w-5 h-5" />
          </button>
          <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-800" />
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{formData.metadata.name || 'New Workflow'}</h2>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className={`font-bold uppercase tracking-tighter ${structuralValidation.valid ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-500'}`}>
                {formData.metadata.type.replace(/_/g, ' ')} {structuralValidation.valid ? '• VALID' : '• INVALID'}
              </span>
              <span>•</span>
              <span>{formData.nodes.length} Nodes</span>
            </div>
          </div>
        </div>

        {!structuralValidation.valid && (
          <div className="flex-1 px-8 animate-in fade-in slide-in-from-top-1">
            <div className="bg-amber-100 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg px-4 py-2 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-800 dark:text-amber-200/80 font-medium leading-tight line-clamp-1">
                {structuralValidation.message}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button 
            onClick={() => setIsResetConfirmVisible(true)} 
            className="flex items-center gap-2 px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors text-sm font-medium"
            title="Clear all agents and connections"
          >
            <RotateCcw className="w-4 h-4" /> Reset Graph
          </button>
          <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 my-auto mx-1" />
          <button 
            onClick={handleSaveAttempt} 
            disabled={!structuralValidation.valid}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all font-semibold shadow-lg ${
              structuralValidation.valid 
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 cursor-pointer' 
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed grayscale'
            }`}
          >
            <Save className="w-4 h-4" /> Save Workflow
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-[#0c0c0e]/50 flex flex-col">
          <div className="p-6 space-y-8 overflow-y-auto scrollbar-thin">
            <section className="space-y-4">
               <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2">Configuration</h3>
               <div className="space-y-3">
                 <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Workflow Name</label>
                    <input 
                      type="text" placeholder="Enter name..." value={formData.metadata.name}
                      onChange={(e) => {
                          setFormData({ ...formData, metadata: { ...formData.metadata, name: e.target.value }});
                          if (validationErrors.name) setValidationErrors(prev => ({ ...prev, name: undefined }));
                      }}
                      className={`w-full bg-white dark:bg-zinc-900 border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none ${validationErrors.name ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`}
                    />
                    {validationErrors.name && <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>}
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Description</label>
                    <textarea 
                      placeholder="Workflow goal..." rows={2} value={formData.metadata.description}
                       onChange={(e) => {
                          setFormData({ ...formData, metadata: { ...formData.metadata, description: e.target.value }});
                          if (validationErrors.description) setValidationErrors(prev => ({ ...prev, description: undefined }));
                       }}
                      className={`w-full bg-white dark:bg-zinc-900 border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-none ${validationErrors.description ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`}
                    />
                    {validationErrors.description && <p className="text-red-500 text-xs mt-1">{validationErrors.description}</p>}
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Workflow Type</label>
                    <select 
                      value={formData.metadata.type} 
                      onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, type: e.target.value as any }})}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded px-3 py-2 text-sm outline-none"
                    >
                      <option value={WorkflowType.SEQUENTIAL}>Sequential</option>
                      <option value={WorkflowType.PARALLEL}>Parallel</option>
                      <option value={WorkflowType.CIRCULAR}>Circular</option>
                      <option value={WorkflowType.HUMAN_IN_THE_LOOP}>Human in the Loop</option>
                      <option value={WorkflowType.HYBRID}>Hybrid</option>
                    </select>
                 </div>
               </div>

               {showManagerWarning && (
                <div className="flex gap-3 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] leading-relaxed animate-in fade-in zoom-in-95 duration-300">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p><strong>Manager Recommended:</strong> A circular loop is detected. Enable the Manager LLM to control exit conditions and prevent infinite loops.</p>
                </div>
               )}

               <div className="p-4 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="mgr" className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Manager LLM</label>
                    <input 
                      id="mgr" type="checkbox" checked={formData.metadata.useManager} 
                      onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, useManager: e.target.checked }})}
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  {formData.metadata.useManager && (
                    <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Manager Model</label>
                        <select 
                          value={formData.metadata.managerModel} 
                          onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, managerModel: e.target.value }})}
                          className="w-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1.5 text-[10px] text-zinc-800 dark:text-zinc-200"
                        >
                          {models.filter(m => m.is_active && allowedManagerModels.has(m.id)).map(m => 
                            <option key={m.id} value={m.id}>{m.name}</option>
                          )}
                        </select>
                      </div>
                      <ManagerSlider 
                        label="Temperature" min={0} max={1} step={0.05} value={formData.metadata.managerTemperature}
                        onChange={(v) => setFormData({ ...formData, metadata: { ...formData.metadata, managerTemperature: v }})}
                      />
                      <ManagerSlider 
                        label="Top-P" min={0} max={1} step={0.05} value={formData.metadata.managerTopP}
                        onChange={(v) => setFormData({ ...formData, metadata: { ...formData.metadata, managerTopP: v }})}
                      />
                      <ManagerSlider 
                        label="Max Iterations" min={0} max={50} step={1} value={formData.metadata.managerMaxIterations ?? 5}
                        onChange={(v) => setFormData({ ...formData, metadata: { ...formData.metadata, managerMaxIterations: v }})}
                      />
                    </div>
                  )}
               </div>
            </section>

            {showHumanNode && (
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2">Control Nodes</h3>
                <div 
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('nodeType', 'human');
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-teal-500/50 cursor-grab active:cursor-grabbing group transition-all flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/40 rounded flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-teal-600 dark:text-teal-400"/>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">Human Checkpoint</div>
                    <div className="text-[9px] text-zinc-500">Pauses execution for review.</div>
                  </div>
                  <GripVertical className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-700 group-hover:text-zinc-500 ml-auto" />
                </div>
              </section>
            )}

            <section className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2">Agents</h3>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                  <input 
                    type="text" placeholder="Search..." value={agentSearch} onChange={(e) => setAgentSearch(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <select 
                  value={agentDomainFilter} onChange={(e) => setAgentDomainFilter(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-[11px] outline-none"
                >
                  <option value="">All Domains</option>
                  {domains.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                <div className="space-y-2 mt-4 max-h-96 overflow-y-auto scrollbar-thin pr-2">
                  {filteredAgents.map(agent => (
                    <div 
                      key={agent.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('nodeType', 'agent');
                        e.dataTransfer.setData('agentId', agent.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-indigo-500/50 cursor-grab active:cursor-grabbing group transition-all"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">{agent.name}</span>
                        <GripVertical className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-700 group-hover:text-zinc-500" />
                      </div>
                      <div className="text-[9px] text-zinc-500 line-clamp-1">{agent.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>

        <div 
          ref={canvasRef}
          className="flex-1 bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] dark:bg-[radial-gradient(#18181b_1px,transparent_1px)] bg-[size:32px_32px] relative overflow-auto scrollbar-thin"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={(e) => {
            e.preventDefault();
            const nodeType = e.dataTransfer.getData('nodeType') as 'agent' | 'human';
            const agentId = e.dataTransfer.getData('agentId');

            if (nodeType && canvasRef.current) {
              const rect = canvasRef.current.getBoundingClientRect();
              const scrollLeft = canvasRef.current.scrollLeft;
              const scrollTop = canvasRef.current.scrollTop;
              const x = (e.clientX - rect.left + scrollLeft) / zoom - 128;
              const y = (e.clientY - rect.top + scrollTop) / zoom - 80;
              addNodeAt(nodeType, agentId, x, y);
            }
          }}
          onMouseMove={(e) => {
            if (draggingNodeId && canvasRef.current) {
              const rect = canvasRef.current.getBoundingClientRect();
              updateNodePosition(draggingNodeId, (e.clientX - rect.left + canvasRef.current.scrollLeft) / zoom - 128, (e.clientY - rect.top + canvasRef.current.scrollTop) / zoom - 80);
            }
          }}
          onMouseUp={() => setDraggingNodeId(null)}
        >
          <div className="absolute top-4 right-4 z-20 flex gap-1 bg-white/50 dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 backdrop-blur-sm">
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300"><Minus className="w-4 h-4"/></button>
            <span className="p-2 text-xs font-bold w-12 text-center text-zinc-600 dark:text-zinc-300">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300"><Plus className="w-4 h-4"/></button>
          </div>
          
          <div className="absolute top-0 left-0" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', minWidth: '5000px', minHeight: '5000px' }}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <marker id="arrowhead" markerWidth="14" markerHeight="10" refX="13" refY="5" orient="auto"><path d="M0,0 L14,5 L0,10 Z" fill="#4f46e5" /></marker>
                </defs>
                {formData.edges.map(edge => {
                  const data = getLineData(edge.source, edge.target);
                  if (!data) return null;
                  return (<path key={edge.id} d={`M ${data.sx} ${data.sy} C ${data.cp1x} ${data.sy}, ${data.cp2x} ${data.ty}, ${data.tx} ${data.ty}`} stroke="#4f46e5" strokeWidth="2.5" fill="none" markerEnd="url(#arrowhead)" className="opacity-70 transition-all duration-300" />);
                })}
              </svg>
              
              {formData.nodes.map((node, idx) => {
                const agent = node.type === 'agent' ? agents.find(a => a.id === node.agentId) : null;
                const isConnStart = connStartNodeId === node.id;
                
                if (node.type === 'human') {
                  return (
                    <div key={node.id} className={`absolute w-64 bg-white dark:bg-[#121214] border-2 rounded-xl shadow-2xl transition-all group ${isConnStart ? 'border-teal-500 ring-4 ring-teal-500/20 z-20' : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 z-10'}`} style={{ left: node.position.x, top: node.position.y }}>
                      <div className="p-4 cursor-move select-none" onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('button')) setDraggingNodeId(node.id); }}>
                        <div className="flex justify-between items-center mb-3">
                          <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/40 rounded flex items-center justify-center"><UserCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" /></div>
                          <button onClick={() => removeNode(node.id)} className="p-1 text-zinc-500 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mb-1">Human Checkpoint</h4>
                        <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">Pauses the workflow and waits for a user to approve, reject, or modify the output before proceeding.</p>
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => { if (connStartNodeId && connStartNodeId !== node.id) tryConnect(connStartNodeId, node.id); else setConnStartNodeId(node.id); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg ${isConnStart ? 'bg-teal-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700'}`}>{isConnStart ? 'Select Target' : 'Connect'}{!isConnStart && <ArrowRight className="w-3 h-3" />}</button>
                          {isConnStart && (<button onClick={() => setConnStartNodeId(null)} className="px-3 py-2 bg-zinc-600 dark:bg-zinc-700 text-zinc-100 dark:text-zinc-300 rounded-lg text-[10px] font-bold">CANCEL</button>)}
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-zinc-100/50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-[9px] text-zinc-500 dark:text-zinc-600 font-bold uppercase"><span>In: {formData.edges.filter(e => e.target === node.id).length}</span><span>Out: {formData.edges.filter(e => e.source === node.id).length}</span></div>
                    </div>
                  );
                }

                return (
                  <div key={node.id} className={`absolute w-64 bg-white dark:bg-[#121214] border-2 rounded-xl shadow-2xl transition-all group ${isConnStart ? 'border-indigo-500 ring-4 ring-indigo-500/20 z-20' : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 z-10'}`} style={{ left: node.position.x, top: node.position.y }}>
                    <div className="p-4 cursor-move select-none" onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('button')) setDraggingNodeId(node.id); }}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center"><User className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /></div>
                        <div className="flex items-center gap-1"><button onClick={() => agent && onEditAgent(agent)} className="p-1 text-zinc-500 dark:text-zinc-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"><Edit2 className="w-4 h-4" /></button><button onClick={() => removeNode(node.id)} className="p-1 text-zinc-500 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button></div>
                      </div>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mb-1 truncate">{agent?.name}</h4>
                      <p className="text-[10px] text-zinc-500 line-clamp-2 mb-3 leading-relaxed">{agent?.description}</p>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 mb-4"><Cpu className="w-3 h-3 text-indigo-600 dark:text-indigo-500" /><span className="text-[9px] font-medium text-zinc-600 dark:text-zinc-400 truncate">{agent?.config.model}</span></div>
                      <div className="flex gap-2">
                        <button onClick={() => { if (connStartNodeId && connStartNodeId !== node.id) tryConnect(connStartNodeId, node.id); else setConnStartNodeId(node.id); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg ${isConnStart ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700'}`}>{isConnStart ? 'Select Target' : 'Connect'}{!isConnStart && <ArrowRight className="w-3 h-3" />}</button>
                        {isConnStart && (<button onClick={() => setConnStartNodeId(null)} className="px-3 py-2 bg-zinc-600 dark:bg-zinc-700 text-zinc-100 dark:text-zinc-300 rounded-lg text-[10px] font-bold">CANCEL</button>)}
                      </div>
                    </div>
                    <div className="px-4 py-2 bg-zinc-100/50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-[9px] text-zinc-500 dark:text-zinc-600 font-bold uppercase"><span>In: {formData.edges.filter(e => e.target === node.id).length}</span><span>Out: {formData.edges.filter(e => e.source === node.id).length}</span></div>
                  </div>
                );
              })}
          </div>
        </div>
        {isResetConfirmVisible && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-4 text-amber-500 mb-6"><div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-200 dark:border-amber-500/20"><AlertTriangle className="w-6 h-6" /></div><h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Reset Graph?</h3></div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">This will clear all agents and connections from the canvas. This action cannot be undone.</p>
              <div className="flex gap-3"><button onClick={() => setIsResetConfirmVisible(false)} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-200 dark:border-zinc-800">Cancel</button><button onClick={handleConfirmReset} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-red-600/20">Confirm Reset</button></div>
              <button onClick={() => setIsResetConfirmVisible(false)} className="absolute top-4 right-4 text-zinc-500 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};