import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Agent, AgentInput, DBModel, Tool, Engine, AgentVersion, FileExtension, AgentVersionData, User, KnowledgeBase, Guardrail } from '../types';
import { dbService } from '../services/db';
import { geminiService } from '../services/gemini';
import { Save, X, Settings2, Sparkles, MessageSquare, Fingerprint, Hammer, Plus, Trash2, Cpu, ChevronDown, Check, Search, TestTube, GitCommit, GitCompare, AlertCircle, BrainCircuit, Wand2, Loader2, Database, Shield, Edit3 } from 'lucide-react';

interface AgentEditorProps {
  agent: Agent;
  agents: Agent[];
  tools: Tool[];
  knowledgeBases: KnowledgeBase[];
  guardrails: Guardrail[];
  allUsers: User[];
  onSave: (agent: Agent) => void;
  onTest: (agent: Agent) => void;
  onCancel: () => void;
  onSaveAndCompare: (agent: Agent) => void;
  onCreateTool: () => void;
  onCreateKnowledgeBase: () => void;
  onCreateGuardrail: () => void;
  currentUser: User;
  setIsDirty: (isDirty: boolean) => void;
  isClone?: boolean;
  isSharedWithMe?: boolean;
}

const SliderInput: React.FC<{ label: string, value: number, min: number, max: number, step: number, onChange: (val: number) => void }> = ({ label, value, min, max, step, onChange }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-16 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-0.5 text-xs text-indigo-600 dark:text-indigo-400 font-mono focus:outline-none" />
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full h-1.5 bg-zinc-300 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
  </div>
);

export const AgentEditor: React.FC<AgentEditorProps> = ({ agent, agents, tools, knowledgeBases, guardrails, allUsers, onSave, onTest, onCancel, onSaveAndCompare, onCreateTool, onCreateKnowledgeBase, onCreateGuardrail, currentUser, setIsDirty, isClone, isSharedWithMe }) => {
  const [formData, setFormData] = useState<Agent>(agent);
  const [domains, setDomains] = useState<string[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [models, setModels] = useState<DBModel[]>([]);
  const [fileExtensions, setFileExtensions] = useState<FileExtension[]>([]);
  const [toolSearch, setToolSearch] = useState('');
  const [kbSearch, setKbSearch] = useState('');
  const [guardrailSearch, setGuardrailSearch] = useState('');
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const [inputToDelete, setInputToDelete] = useState<number | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<number | null>(null);
  const [renamingVersion, setRenamingVersion] = useState<number | null>(null);
  const [isOtherExtension, setIsOtherExtension] = useState(false);
  const [customExtension, setCustomExtension] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [nameExistsError, setNameExistsError] = useState(false);

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [generatorInput, setGeneratorInput] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState<{ role: string; goal: string; backstory: string; instructions: string[]; expected_output: string; } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorError, setGeneratorError] = useState('');

  const versionDropdownRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);

  const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u.email])), [allUsers]);

  useEffect(() => {
    if (renamingVersion !== null && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingVersion]);

  useEffect(() => {
    if (isInitialMount.current) {
        isInitialMount.current = false;
        if (isClone) setIsDirty(true);
    } else {
        setIsDirty(true);
    }
  }, [formData, setIsDirty, isClone]);
  
  const allVersions = useMemo(() => {
    const getComparableData = (a: Agent): AgentVersionData => ({ name: a.name, description: a.description, role: a.role, domain: a.domain, goal: a.goal, backstory: a.backstory, taskDescription: a.taskDescription, inputs: a.inputs, expectedOutput: a.expectedOutput, outputFileExtension: a.outputFileExtension, config: a.config, toolIds: a.toolIds, knowledgeBaseIds: a.knowledgeBaseIds, guardrailIds: a.guardrailIds, managerCondition: a.managerCondition });
    const currentVersionData = getComparableData(formData);
    const currentVersionEntry: AgentVersion = { version: formData.version, name: formData.versions?.find(v => v.version === formData.version)?.name, data: currentVersionData, createdAt: Date.now(), created_by: currentUser.id };
    return [...(formData.versions || []), currentVersionEntry].sort((a, b) => b.version - a.version);
  }, [formData, currentUser.id]);

  const availableModelsForEngine = useMemo(() => {
    if (!formData.config.aiEngine) return [];
    const selectedEngine = engines.find(e => e.name === formData.config.aiEngine);
    if (!selectedEngine) return [];
    return models.filter(m => m.engine_id === selectedEngine.id && m.is_active && !m.id.includes('embedding'));
  }, [formData.config.aiEngine, engines, models]);

  const handleEngineChange = (engineName: string) => {
    const engine = engines.find(e => e.name === engineName);
    if (engine && engine.is_active) {
      const firstModelForEngine = models.find(m => m.engine_id === engine.id && m.is_active && !m.id.includes('embedding'));
      setFormData(prev => ({
        ...prev,
        config: {
          ...prev.config,
          aiEngine: engine.name,
          model: firstModelForEngine ? firstModelForEngine.id : ''
        }
      }));
    }
  };

  const handleModelChange = (modelId: string) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, model: modelId }
    }));
  };

  const handleBlur = (fieldName: keyof Agent | 'outputFileExtension') => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
  };
  
  const isExtensionValid = useMemo(() => {
    if (!formData.outputFileExtension) return false;
    const regex = /^\.[a-zA-Z0-9]+$/;
    return regex.test(formData.outputFileExtension);
  }, [formData.outputFileExtension]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
        setIsVersionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadLookups = async () => {
      const [d, e, m, fe] = await Promise.all([dbService.getDomains(), dbService.getEngines(), dbService.getModels(), dbService.getFileExtensions()]);
      setDomains(d);
      setEngines(e);
      setModels(m);
      setFileExtensions(fe);
      
      const currentExt = agent.outputFileExtension || '';
      const isPredefined = fe.some(ext => ext.extension === currentExt);
      if (!isPredefined && currentExt) {
        setIsOtherExtension(true);
        setCustomExtension(currentExt);
      }
    };
    loadLookups();
  }, [agent]);
  
  const handleVersionLoad = (versionToLoad: AgentVersion) => {
    const getAgentData = (a: Agent): AgentVersionData => ({ name: a.name, description: a.description, role: a.role, domain: a.domain, goal: a.goal, backstory: a.backstory, taskDescription: a.taskDescription, inputs: a.inputs, expectedOutput: a.expectedOutput, outputFileExtension: a.outputFileExtension, config: a.config, toolIds: a.toolIds, knowledgeBaseIds: a.knowledgeBaseIds, guardrailIds: a.guardrailIds, managerCondition: a.managerCondition });
    
    const oldCurrentData = getAgentData(formData);
    const oldCurrentVersion = formData.version;

    const newHistoryEntry: AgentVersion = {
      ...formData.versions?.find(v => v.version === oldCurrentVersion),
      version: oldCurrentVersion,
      data: oldCurrentData,
      createdAt: Date.now(),
      created_by: currentUser.id
    };
    
    const newHistory = [
      ...(formData.versions || []).filter(v => v.version !== versionToLoad.version && v.version !== oldCurrentVersion),
      newHistoryEntry
    ].sort((a, b) => a.version - b.version);

    const newFormData: Agent = {
        ...formData,
        ...versionToLoad.data,
        version: versionToLoad.version,
        versions: newHistory,
    };

    setFormData(newFormData);
    setIsVersionDropdownOpen(false);
  };
  
  const handleRenameVersion = (versionNumber: number, newName: string) => {
    const newNameTrimmed = newName.trim();
    setFormData(prev => {
      const updatedVersions = (prev.versions || []).map(v => 
        v.version === versionNumber ? { ...v, name: newNameTrimmed } : v
      );
      return { ...prev, versions: updatedVersions };
    });
    setRenamingVersion(null);
  };


  const handleConfirmDeleteVersion = async () => {
    if (versionToDelete === null) return;
    
    const versionData = allVersions.find(v => v.version === versionToDelete);
    const isShared = isSharedWithMe || false;
    const canDeleteVersion = currentUser.role === 'Admin' || currentUser.role === 'Owner' || agent.created_by === currentUser.id || versionData?.created_by === currentUser.id || isShared;


    if (!canDeleteVersion) {
        alert("Permission Denied: You cannot delete this version.");
        setVersionToDelete(null);
        return;
    }
    
    const getAgentData = (a: Agent): AgentVersionData => ({ name: a.name, description: a.description, role: a.role, domain: a.domain, goal: a.goal, backstory: a.backstory, taskDescription: a.taskDescription, inputs: a.inputs, expectedOutput: a.expectedOutput, outputFileExtension: a.outputFileExtension, config: a.config, toolIds: a.toolIds, knowledgeBaseIds: a.knowledgeBaseIds, guardrailIds: a.guardrailIds, managerCondition: a.managerCondition });
    const fullHistory: AgentVersion[] = [...(formData.versions || []), { ...formData.versions?.find(v => v.version === formData.version), version: formData.version, data: getAgentData(formData), createdAt: Date.now(), created_by: currentUser.id }];
    
    const remainingVersions = fullHistory.filter(v => v.version !== versionToDelete).sort((a, b) => a.version - b.version);
    
    if (remainingVersions.length === 0) {
      alert("Cannot delete the only remaining version.");
      setVersionToDelete(null);
      return;
    }
    
    const newCurrentVersion = remainingVersions.pop()!;
    
    const newHistory = remainingVersions.map((v, index) => ({
      ...v,
      version: index + 1
    }));
    
    const newFormData: Agent = {
        ...formData,
        ...newCurrentVersion.data,
        version: newHistory.length + 1,
        versions: newHistory
    };

    setFormData(newFormData);
    setVersionToDelete(null);
  };

  const handleExtensionChange = (value: string) => {
    if (value === 'other') {
      setIsOtherExtension(true);
      setCustomExtension('');
      setFormData(prev => ({...prev, outputFileExtension: ''}));
    } else {
      setIsOtherExtension(false);
      setCustomExtension('');
      setFormData(prev => ({...prev, outputFileExtension: value}));
    }
  };
  
  const handleCustomExtensionChange = (value: string) => {
    setCustomExtension(value);
    const predefined = fileExtensions.find(fe => fe.extension === value);
    if (predefined) {
      handleExtensionChange(predefined.extension);
    } else {
      setFormData(prev => ({...prev, outputFileExtension: value}));
    }
  };

  const addInput = () => setFormData(prev => ({ ...prev, inputs: [...prev.inputs, { description: '', parameter: '' }] }));
  const removeInput = (index: number) => {
    setFormData(prev => ({ ...prev, inputs: prev.inputs.filter((_, i) => i !== index) }));
    setInputToDelete(null);
  };
  const updateInput = (index: number, field: keyof AgentInput, value: string) => {
    setFormData(prev => {
      const newInputs = [...prev.inputs];
      newInputs[index] = { ...newInputs[index], [field]: value };
      return { ...prev, inputs: newInputs };
    });
  };

  const toggleTool = (id: string) => {
    setFormData(prev => {
      const toolIds = prev.toolIds || [];
      const newToolIds = toolIds.includes(id) ? toolIds.filter(tid => tid !== id) : [...toolIds, id];
      return { ...prev, toolIds: newToolIds };
    });
  };

  const toggleKnowledgeBase = (id: string) => {
    setFormData(prev => {
      const kbIds = prev.knowledgeBaseIds || [];
      const newKbIds = kbIds.includes(id) ? kbIds.filter(kid => kid !== id) : [...kbIds, id];
      return { ...prev, knowledgeBaseIds: newKbIds };
    });
  };

  const toggleGuardrail = (id: string) => {
    setFormData(prev => {
      const guardrailIds = prev.guardrailIds || [];
      const newGuardrailIds = guardrailIds.includes(id) ? guardrailIds.filter(gid => gid !== id) : [...guardrailIds, id];
      return { ...prev, guardrailIds: newGuardrailIds };
    });
  };

  const filteredTools = useMemo(() => tools.filter(tool => tool.name.toLowerCase().includes(toolSearch.toLowerCase())), [tools, toolSearch]);
  const filteredKBs = useMemo(() => knowledgeBases.filter(kb => kb.name.toLowerCase().includes(kbSearch.toLowerCase())), [knowledgeBases, kbSearch]);
  const filteredGuardrails = useMemo(() => guardrails.filter(g => g.name.toLowerCase().includes(guardrailSearch.toLowerCase())), [guardrails, guardrailSearch]);
  
  const handleActionAttempt = (action: (agent: Agent) => void) => {
    setNameExistsError(false);
    
    const formIsValid = !!(formData.name && formData.description && formData.role && formData.domain && formData.goal && formData.backstory && formData.taskDescription && formData.expectedOutput && isExtensionValid);
    const nameExists = agents.some(a => a.name.toLowerCase() === formData.name.toLowerCase() && a.id !== formData.id);

    if (!formIsValid || nameExists) {
        const allFields: (keyof Agent | 'outputFileExtension')[] = ['name', 'description', 'role', 'domain', 'goal', 'backstory', 'taskDescription', 'expectedOutput', 'outputFileExtension'];
        const newTouched: Record<string, boolean> = {};
        allFields.forEach(field => newTouched[field] = true);
        setTouched(newTouched);
        
        if (nameExists) {
            setNameExistsError(true);
        }
        return;
    }
    
    action(formData);
  };

  const handleGeneratePrompt = async () => {
      setIsGenerating(true);
      setGeneratorError('');
      setGeneratedPrompt(null);

      const generatorAgent = await dbService.getAgentByName('Agent Prompt Generator');
      if (!generatorAgent) {
          setGeneratorError('The "Agent Prompt Generator" agent could not be found. Please ensure it exists.');
          setIsGenerating(false);
          return;
      }

      try {
          const finalInput = `Based on your configuration, take the following user request and generate the complete agent persona as a JSON object.
    
User Request: "${generatorInput}"`;
          
          const systemInstruction = `IDENTITY: ${generatorAgent.backstory}\nGOAL: ${generatorAgent.goal}\nOUTPUT_REQUIREMENTS: ${generatorAgent.expectedOutput}`;

          const response = await geminiService.generate(
              generatorAgent.config,
              systemInstruction,
              finalInput,
              'application/json'
          );

          if (!response.text) {
              throw new Error('The generator returned an empty response.');
          }

          const cleanedJson = response.text.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(cleanedJson);
          
          if (!parsed.role || !parsed.goal || !parsed.backstory || !Array.isArray(parsed.instructions) || !parsed.expected_output) {
              throw new Error('The generated prompt has an invalid structure.');
          }

          setGeneratedPrompt(parsed);

      } catch (e: any) {
          setGeneratorError(`Failed to generate prompt: ${e.message}`);
      } finally {
          setIsGenerating(false);
      }
  };

  const handleApplyPrompt = () => {
      if (!generatedPrompt) return;
      setFormData(prev => ({
          ...prev,
          role: generatedPrompt.role,
          goal: generatedPrompt.goal,
          backstory: generatedPrompt.backstory,
          taskDescription: generatedPrompt.instructions.join('\n\n'),
          expectedOutput: generatedPrompt.expected_output,
      }));
      closeGenerator();
  };

  const closeGenerator = () => {
      setIsGeneratorOpen(false);
      setGeneratorInput('');
      setGeneratedPrompt(null);
      setGeneratorError('');
      setIsGenerating(false);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-100 dark:bg-[#09090b]">
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#0c0c0e] sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"><X className="w-5 h-5" /></button>
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">{formData.name || "New Agent"}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsGeneratorOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-900/50 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50">
            <BrainCircuit className="w-4 h-4" /> Generate with AI
          </button>
          <div className="relative" ref={versionDropdownRef}>
            <button onClick={() => setIsVersionDropdownOpen(p => !p)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800">
              <GitCommit className="w-3.5 h-3.5" /> Version {formData.version} <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {isVersionDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-2 z-30 animate-in fade-in zoom-in-95">
                <div className="px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase">Versions</div>
                <div className="max-h-80 overflow-y-auto scrollbar-thin pr-1">
                  {allVersions.map(v => {
                    const isShared = isSharedWithMe || false;
                    const canManageVersion = currentUser.role === 'Admin' || currentUser.role === 'Owner' || agent.created_by === currentUser.id || v.created_by === currentUser.id || isShared;
                    const creatorEmail = userMap.get(v.created_by) || 'unknown user';
                    return (
                      <div key={v.version} className="flex items-center justify-between group hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-md pr-1">
                        <button onClick={() => handleVersionLoad(v)} className="flex-1 text-left p-2 rounded-md text-xs">
                          {renamingVersion === v.version ? (
                            <input
                              ref={renameInputRef}
                              type="text"
                              defaultValue={v.name || ''}
                              placeholder={`Version ${v.version}`}
                              onBlur={(e) => handleRenameVersion(v.version, e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameVersion(v.version, e.currentTarget.value); }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-800 rounded px-2 py-1 text-xs outline-none"
                            />
                          ) : (
                            <span className="font-semibold text-zinc-800 dark:text-zinc-300">{v.name || `Version ${v.version}`} {v.version === formData.version && <span className="text-indigo-500 dark:text-indigo-400 font-bold">(Current)</span>}</span>
                          )}
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 whitespace-nowrap overflow-x-auto scrollbar-thin">{creatorEmail} • {new Date(v.createdAt).toLocaleString()}</div>
                        </button>
                         <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => setRenamingVersion(v.version)} disabled={!canManageVersion} className="p-2 text-zinc-500 dark:text-zinc-600 hover:text-indigo-500 dark:hover:text-indigo-400 disabled:opacity-20 disabled:cursor-not-allowed" title={!canManageVersion ? "Permission Denied" : "Rename Version"}><Edit3 className="w-3.5 h-3.5" /></button>
                           {v.version !== formData.version && (
                            <button onClick={() => setVersionToDelete(v.version)} disabled={!canManageVersion} className="p-2 text-zinc-500 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed" title={!canManageVersion ? "Permission Denied" : "Delete Version"}><Trash2 className="w-3.5 h-3.5" /></button>
                           )}
                         </div>
                      </div>
                    );
                  })}
                </div>
                <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-2" />
                <button onClick={() => handleActionAttempt(onSaveAndCompare)} className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700/80 text-xs text-zinc-800 dark:text-zinc-300 disabled:opacity-50"><GitCompare className="w-4 h-4" /> Save & Compare</button>
              </div>
            )}
          </div>
          <button onClick={() => handleActionAttempt(onSave)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"><Save className="w-3.5 h-3.5" /> Save</button>
          <button onClick={() => handleActionAttempt(onTest)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg transition-all text-xs font-bold shadow-lg shadow-indigo-600/20"><TestTube className="w-4 h-4" /> Save & Test</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[380px] border-r border-zinc-200 dark:border-zinc-800 p-6 space-y-8 overflow-y-auto scrollbar-thin">
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Fingerprint className="w-4 h-4" />Identity</h3>
            <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Agent Name</label>
                <input type="text" value={formData.name} onBlur={()=>handleBlur('name')} onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setNameExistsError(false); }} className={`w-full bg-white dark:bg-zinc-900 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${((touched.name && !formData.name) || nameExistsError) ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`} />
                {touched.name && !formData.name && <p className="text-red-500 text-xs mt-1">Agent name is required.</p>}
                {nameExistsError && <p className="text-red-500 text-xs mt-1">Agent name already exists.</p>}
            </div>
            <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Agent Description</label>
                <textarea value={formData.description} onBlur={()=>handleBlur('description')} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} className={`w-full bg-white dark:bg-zinc-900 border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 ${touched.description && !formData.description ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`} />
                {touched.description && !formData.description && <p className="text-red-500 text-xs mt-1">Agent description is required.</p>}
            </div>
            <div className="relative">
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Domain</label>
                <select value={formData.domain} onBlur={()=>handleBlur('domain')} onChange={(e) => setFormData({ ...formData, domain: e.target.value })} className={`w-full bg-white dark:bg-zinc-900 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none ${touched.domain && !formData.domain ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`}><option value="">Select Domain...</option>{domains.map(d => <option key={d} value={d}>{d}</option>)}</select>
                <ChevronDown className="absolute right-3 top-7 w-4 h-4 text-zinc-400 pointer-events-none" />
                {touched.domain && !formData.domain && <p className="text-red-500 text-xs mt-1">Domain is required.</p>}
            </div>
          </section>
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Settings2 className="w-4 h-4" />LLM Configuration</h3>
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">AI Engine</label>
                <select 
                  value={formData.config.aiEngine} 
                  onChange={(e) => handleEngineChange(e.target.value)} 
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none appearance-none pr-8"
                >
                  <option value="" disabled>Select Engine...</option>
                  {engines.map(engine => (
                    <option key={engine.id} value={engine.name} disabled={!engine.is_active} title={!engine.is_active ? "This model is temporarily unavailable." : ""}>
                      {engine.name === 'GoogleAI' ? 'Google AI' : engine.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-7 w-4 h-4 text-zinc-400 pointer-events-none" />
              </div>
              <div className="relative">
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Model</label>
                <select 
                  value={formData.config.model} 
                  onChange={(e) => handleModelChange(e.target.value)}
                  disabled={!formData.config.aiEngine}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed appearance-none pr-8"
                >
                  <option value="" disabled>Select Model...</option>
                  {availableModelsForEngine.map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-7 w-4 h-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-6 pt-2">
              <SliderInput label="Temperature" value={formData.config.temperature} min={0} max={1} step={0.05} onChange={(v) => setFormData({ ...formData, config: { ...formData.config, temperature: v } })} />
              <SliderInput label="Top-P" value={formData.config.topP} min={0} max={1} step={0.05} onChange={(v) => setFormData({ ...formData, config: { ...formData.config, topP: v } })} />
              <SliderInput label="Max Iterations" value={formData.config.maxIterations} min={0} max={100} step={1} onChange={(v) => setFormData({ ...formData, config: { ...formData.config, maxIterations: v } })} />
              <SliderInput label="Max RPM" value={formData.config.maxRPM} min={0} max={1000} step={10} onChange={(v) => setFormData({ ...formData, config: { ...formData.config, maxRPM: v } })} />
              <SliderInput label="Max Execution Time (s)" value={formData.config.maxExecutionTime} min={0} max={600} step={15} onChange={(v) => setFormData({ ...formData, config: { ...formData.config, maxExecutionTime: v } })} />
            </div>
          </section>
        </div>

        <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-6">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><MessageSquare className="w-4 h-4" />Persona & Logic</h3>
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Role</label>
            <textarea value={formData.role} onBlur={()=>handleBlur('role')} onChange={(e) => setFormData({ ...formData, role: e.target.value })} rows={1} placeholder="e.g., Senior Software Architect" className={`w-full bg-white dark:bg-zinc-900 border rounded-lg px-4 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 ${touched.role && !formData.role ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`} />
            {touched.role && !formData.role && <p className="text-red-500 text-xs mt-1">Role is required.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Goal</label>
              <textarea value={formData.goal} onBlur={()=>handleBlur('goal')} onChange={(e) => setFormData({ ...formData, goal: e.target.value })} rows={5} className={`bg-white dark:bg-zinc-900 border rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full ${touched.goal && !formData.goal ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`} />
              {touched.goal && !formData.goal && <p className="text-red-500 text-xs mt-1">Goal is required.</p>}
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Backstory</label>
              <textarea value={formData.backstory} onBlur={()=>handleBlur('backstory')} onChange={(e) => setFormData({ ...formData, backstory: e.target.value })} rows={5} className={`bg-white dark:bg-zinc-900 border rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full ${touched.backstory && !formData.backstory ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`} />
              {touched.backstory && !formData.backstory && <p className="text-red-500 text-xs mt-1">Backstory is required.</p>}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Instructions</label>
            <textarea value={formData.taskDescription} onBlur={()=>handleBlur('taskDescription')} onChange={(e) => setFormData({ ...formData, taskDescription: e.target.value })} rows={16} placeholder="Detailed instructions..." className={`w-full bg-white dark:bg-zinc-900 border rounded-lg p-4 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 mono ${touched.taskDescription && !formData.taskDescription ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`} />
            {touched.taskDescription && !formData.taskDescription && <p className="text-red-500 text-xs mt-1">Instructions are required.</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Execution Inputs</label><button onClick={addInput} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"><Plus className="w-3 h-3 inline-block mr-1" />Add</button></div>
            {formData.inputs.map((input, idx) => (
              <div key={idx} className="flex gap-2 items-center"><textarea value={input.description} onChange={(e) => updateInput(idx, 'description', e.target.value)} rows={1} placeholder="Description" className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none resize-y" /><input type="text" value={input.parameter} onChange={(e) => updateInput(idx, 'parameter', e.target.value.replace(/\s+/g, '_'))} placeholder="param_name" className="w-40 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs mono text-indigo-600 dark:text-indigo-400 focus:ring-1 focus:ring-indigo-500 outline-none" /><button onClick={() => setInputToDelete(idx)} className="p-1 text-zinc-500 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400"><Trash2 className="w-3 h-3" /></button></div>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Expected Output</label>
            <textarea value={formData.expectedOutput} onBlur={()=>handleBlur('expectedOutput')} onChange={(e) => setFormData({ ...formData, expectedOutput: e.target.value })} rows={8} className={`w-full bg-white dark:bg-zinc-900 border rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 ${touched.expectedOutput && !formData.expectedOutput ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`} />
            {touched.expectedOutput && !formData.expectedOutput && <p className="text-red-500 text-xs mt-1">Expected output description is required.</p>}
          </div>
          <div>
              <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Manager LLM Condition (Optional)</label>
                  {formData.managerCondition !== undefined && (
                      <button onClick={() => setFormData(prev => ({ ...prev, managerCondition: undefined }))} className="text-xs text-red-500 dark:text-red-400 hover:underline flex items-center gap-1">
                          <Trash2 className="w-3 h-3"/> Remove Condition
                      </button>
                  )}
              </div>
              {formData.managerCondition === undefined ? (
                  <button onClick={() => setFormData(prev => ({ ...prev, managerCondition: '' }))} className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-100 dark:bg-zinc-900/50 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:border-indigo-500/50 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all">
                      <Plus className="w-4 h-4" /> Add Manager LLM Condition
                  </button>
              ) : (
                  <textarea
                      value={formData.managerCondition}
                      onChange={(e) => setFormData({ ...formData, managerCondition: e.target.value })}
                      rows={4}
                      placeholder="e.g., If the user sentiment is positive, stop the workflow."
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
              )}
              <p className="text-[10px] text-zinc-500 mt-2">If set, the Manager LLM (if enabled on the workflow) will evaluate this agent's output against this condition to decide whether to stop execution.</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Output File Extension</label>
            <div className="flex gap-2">
              <select value={isOtherExtension ? 'other' : formData.outputFileExtension} onBlur={()=>handleBlur('outputFileExtension')} onChange={e => handleExtensionChange(e.target.value)} className={`w-48 bg-white dark:bg-zinc-900 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none ${touched.outputFileExtension && !isExtensionValid ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`}>
                <option value="" disabled>Select...</option>
                {fileExtensions.map(fe => <option key={fe.id} value={fe.extension}>{fe.name} ({fe.extension})</option>)}
                <option value="other">Other...</option>
              </select>
              {isOtherExtension && <input type="text" value={customExtension} onBlur={()=>handleBlur('outputFileExtension')} onChange={e => handleCustomExtensionChange(e.target.value)} placeholder=".custom" className={`flex-1 bg-white dark:bg-zinc-900 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${touched.outputFileExtension && !isExtensionValid ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`} />}
            </div>
            {touched.outputFileExtension && !isExtensionValid && <p className="text-red-500 text-xs mt-1">Invalid extension format. Must start with a dot (e.g., '.py').</p>}
          </div>
        </div>
        
        <div className="w-[380px] border-l border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-[#09090b] overflow-y-auto scrollbar-thin">
            <div className="flex flex-col">
                {/* Knowledge Base Section */}
                <div className="border-b border-zinc-200 dark:border-zinc-800">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Database className="w-4 h-4" /> Knowledge Bases</h3></div>
                    <div className="p-4 shrink-0"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" /><input type="text" value={kbSearch} onChange={(e) => setKbSearch(e.target.value)} placeholder="Search KBs..." className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" /></div></div>
                    <div className="px-4 pb-4 space-y-2 h-auto"><button onClick={onCreateKnowledgeBase} className="w-full text-center py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">+ Create New KB</button>{filteredKBs.map(kb => (<button key={kb.id} onClick={() => toggleKnowledgeBase(kb.id)} className={`w-full p-3 rounded-lg border text-left transition-all relative ${formData.knowledgeBaseIds?.includes(kb.id) ? 'bg-indigo-100/50 dark:bg-indigo-600/10 border-indigo-300 dark:border-indigo-600/40' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}><h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{kb.name}</h4><p className="text-[10px] text-zinc-500 line-clamp-1">{kb.description}</p>{formData.knowledgeBaseIds?.includes(kb.id) && <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}</button>))}</div>
                </div>
                {/* Tools Section */}
                <div className="border-b border-zinc-200 dark:border-zinc-800">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Hammer className="w-4 h-4" /> Tools</h3></div>
                    <div className="p-4 shrink-0"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" /><input type="text" value={toolSearch} onChange={(e) => setToolSearch(e.target.value)} placeholder="Search tools..." className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" /></div></div>
                    <div className="px-4 pb-4 space-y-2 h-auto"><button onClick={onCreateTool} className="w-full text-center py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">+ Create New Tool</button>{filteredTools.map(tool => (<button key={tool.id} onClick={() => toggleTool(tool.id)} className={`w-full p-3 rounded-lg border text-left transition-all relative ${formData.toolIds?.includes(tool.id) ? 'bg-indigo-100/50 dark:bg-indigo-600/10 border-indigo-300 dark:border-indigo-600/40' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}><h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{tool.name}</h4><p className="text-[10px] text-zinc-500 line-clamp-1">{tool.description}</p>{formData.toolIds?.includes(tool.id) && <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}</button>))}</div>
                </div>
                {/* Guardrails Section */}
                <div>
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Shield className="w-4 h-4" /> Guardrails</h3></div>
                    <div className="p-4 shrink-0"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" /><input type="text" value={guardrailSearch} onChange={(e) => setGuardrailSearch(e.target.value)} placeholder="Search guardrails..." className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" /></div></div>
                    <div className="px-4 pb-4 space-y-2 h-auto"><button onClick={onCreateGuardrail} className="w-full text-center py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">+ Create New Guardrail</button>{filteredGuardrails.map(g => (<button key={g.id} onClick={() => toggleGuardrail(g.id)} className={`w-full p-3 rounded-lg border text-left transition-all relative ${formData.guardrailIds?.includes(g.id) ? 'bg-indigo-100/50 dark:bg-indigo-600/10 border-indigo-300 dark:border-indigo-600/40' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}><h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{g.name}</h4><p className="text-[10px] text-zinc-500 line-clamp-1">{g.description}</p>{g.isDefault && <div className="mt-1 px-1.5 py-0.5 text-[8px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 rounded inline-block">Default</div>}{formData.guardrailIds?.includes(g.id) && <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}</button>))}</div>
                </div>
            </div>
        </div>
      </div>
      {inputToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">Confirm Deletion</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6">Are you sure you want to delete the input parameter "{formData.inputs[inputToDelete]?.parameter || 'untitled'}"?</p>
            <div className="flex gap-3"><button onClick={() => setInputToDelete(null)} className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-lg font-bold text-xs border border-zinc-200 dark:border-zinc-800">Cancel</button><button onClick={() => removeInput(inputToDelete)} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs">Delete</button></div>
          </div>
        </div>
      )}
      {versionToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">Confirm Version Deletion</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6">Are you sure you want to permanently delete Version {versionToDelete}? This action cannot be undone.</p>
            <div className="flex gap-3"><button onClick={() => setVersionToDelete(null)} className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-lg font-bold text-xs border border-zinc-200 dark:border-zinc-800">Cancel</button><button onClick={handleConfirmDeleteVersion} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs">Delete</button></div>
          </div>
        </div>
      )}
       {isGeneratorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center"><BrainCircuit className="w-6 h-6 text-indigo-500 dark:text-indigo-400" /></div><div><h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Agent Prompt Generator</h3><p className="text-xs text-zinc-500">Describe your agent's task to generate a complete persona.</p></div></div>
              <button onClick={closeGenerator} className="p-2 text-zinc-500 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            {generatedPrompt ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="overflow-y-auto scrollbar-thin p-1 pr-4 space-y-4">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800"> <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Role</h4> <p className="text-sm text-zinc-800 dark:text-zinc-300">{generatedPrompt.role}</p> </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800"> <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Goal</h4> <p className="text-sm text-zinc-800 dark:text-zinc-300">{generatedPrompt.goal}</p> </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800"> <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Backstory</h4> <p className="text-sm text-zinc-800 dark:text-zinc-300">{generatedPrompt.backstory}</p> </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800"> <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Instructions</h4> <ul className="list-disc list-inside space-y-2 text-sm text-zinc-800 dark:text-zinc-300 marker:text-indigo-400">{generatedPrompt.instructions.map((inst, i) => <li key={i}>{inst}</li>)}</ul> </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800"> <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Expected Output</h4> <p className="text-sm text-zinc-800 dark:text-zinc-300">{generatedPrompt.expected_output}</p> </div>
                </div>
                <div className="flex gap-3 pt-6 mt-auto">
                  <button onClick={() => setGeneratedPrompt(null)} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-xl font-bold text-xs transition-all border border-zinc-200 dark:border-zinc-800">Regenerate</button>
                  <button onClick={handleApplyPrompt} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/20">Apply This Prompt</button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <textarea value={generatorInput} onChange={(e) => setGeneratorInput(e.target.value)} placeholder="e.g., I want to create a SQL to DBT converter agent" rows={4} className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-none" />
                <button onClick={handleGeneratePrompt} disabled={isGenerating || !generatorInput.trim()} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
                {generatorError && <div className="mt-4 p-3 bg-red-100/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {generatorError}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
