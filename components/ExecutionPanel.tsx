
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Markdown from 'markdown-to-jsx';
import { Workflow, Agent, ExecutionLog, WorkflowExecution, Tool, WorkflowNode, WorkflowType, DBModel, Engine, AgentConfig, KnowledgeBase, User } from '../types';
import { geminiService } from '../services/gemini';
import { dbService } from '../services/db';
import { 
  Play, Terminal, Loader2, History, Zap, Settings, 
  Search, Clock, Box, Download, ChevronDown, ChevronUp, Layers, FileText, Square, Hammer, AlertCircle, Cpu, Eye, EyeOff, ThumbsUp, ThumbsDown, MessageSquare, GitCommit, Upload, X, PanelLeftClose, PanelRight, Database, User as UserIcon
} from 'lucide-react';

interface ExecutionPanelProps {
  workflows: Workflow[];
  agents: Agent[];
  tools: Tool[];
  currentUser: User;
}

type HumanCheckpoint = {
  logId: string;
  humanNodeId: string;
  upstreamAgent: Agent | null;
  input: string;
  outputVersions: { output: string }[];
  currentOutputVersionIndex: number;
};

type StopSignal = {
  stoppedByManager: true;
  reason: string;
};

// This manager object holds the execution state. Because it's defined at the module level (outside the component),
// its state persists across component re-mounts, solving the disappearing "Terminate" button issue.
const executionManager = {
  active: false,
  currentExecutionId: null as string | null,
  startTime: 0,
  agentIterationCounts: new Map<string, number>(),
  stepCount: 0,
  logs: [] as ExecutionLog[],

  _listeners: new Set<() => void>(),
  subscribe(callback: () => void) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  },
  notify() {
    this._listeners.forEach(cb => cb());
  },
  
  setActive(isActive: boolean) {
    if (this.active !== isActive) {
      this.active = isActive;
      this.notify();
    }
  },

  reset() {
    this.active = false;
    this.currentExecutionId = null;
    this.startTime = 0;
    this.agentIterationCounts = new Map();
    this.stepCount = 0;
    this.logs = [];
    this.notify();
  }
};

const LogEntry: React.FC<{ log: ExecutionLog }> = ({ log }) => {
  const [isHovering, setIsHovering] = useState(false);

  const parseInput = (input: string) => {
    const contextMatch = input.match(/CONTEXT_CHAIN: ([\s\S]*?)\n\nPARAM_BLOCK:/);
    const paramsMatch = input.match(/PARAM_BLOCK:([\s\S]*?)\n\nASSIGNED_TASK:/);
    const taskMatch = input.match(/ASSIGNED_TASK: ([\s\S]*)/);
    return {
      context: contextMatch ? contextMatch[1].trim() : 'N/A',
      params: paramsMatch ? paramsMatch[1].trim() : 'N/A',
      task: taskMatch ? taskMatch[1].trim() : input
    };
  };

  const { context, params, task } = parseInput(log.input);

  return (
    <div 
      className="group relative animate-in fade-in slide-in-from-left-2 duration-300 border-b border-zinc-200 dark:border-zinc-800/40 pb-4 last:border-0 last:pb-0"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex items-start gap-4">
        <span className="text-zinc-500 dark:text-zinc-700 shrink-0 font-bold">[{new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
        
        <div className="flex-1 space-y-2">
          {log.agentName === 'Human Checkpoint' || log.agentName === 'System' || log.agentName === 'Manager LLM' ? (
             <div>
              <span className={`${log.agentName === 'Human Checkpoint' ? 'text-teal-600 dark:text-teal-500' : log.agentName === 'Manager LLM' ? 'text-purple-600 dark:text-purple-500' : 'text-zinc-600 dark:text-zinc-500'} font-bold uppercase tracking-tighter`}>{log.agentName} &gt; </span>
              <span className={'text-zinc-500 dark:text-zinc-400 italic prose prose-sm prose-invert'}><Markdown>{log.output || ''}</Markdown></span>
            </div>
          ) : (
            <>
              <div>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-tighter">{log.agentName} (V{log.version}) &gt; </span>
                <span className="text-zinc-600 dark:text-zinc-500 italic">
                    {
                        log.status === 'running' ? 'Executing task...' :
                        log.status === 'completed' ? `Completed. Output: ${(log.output || '').substring(0, 80)}...` :
                        log.status === 'paused' ? 'Paused, awaiting human input.' :
                        log.status === 'failed' ? `Failed. Error: ${(log.error || '').substring(0, 80)}...` :
                        log.status === 'stopped' ? 'Stopped by user.' : 'Pending.'
                    }
                </span>
              </div>
              
              <div className="max-h-0 overflow-hidden group-hover:max-h-none transition-all duration-500 ease-in-out">
                <div className="pt-3 mt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                  <div className="text-[10px] space-y-1"><h5 className="font-bold text-zinc-600 dark:text-zinc-500 uppercase tracking-widest">Input: Context Chain</h5><div className="prose prose-sm prose-invert italic text-zinc-500 dark:text-zinc-400 p-2 bg-zinc-100 dark:bg-black/20 rounded-md"><Markdown>{context}</Markdown></div></div>
                  {params.trim() !== 'None' && params.trim() !== '' && (<div className="text-[10px] space-y-1"><h5 className="font-bold text-zinc-600 dark:text-zinc-500 uppercase tracking-widest">Input: Workflow Parameters</h5><div className="prose prose-sm prose-invert"><Markdown>{'```\n' + params + '\n```'}</Markdown></div></div>)}
                  <div className="text-[10px] space-y-1"><h5 className="font-bold text-zinc-600 dark:text-zinc-500 uppercase tracking-widest">Input: Assigned Task</h5><div className="prose prose-sm prose-invert text-zinc-800 dark:text-zinc-300 p-2 bg-zinc-100 dark:bg-black/20 rounded-md"><Markdown>{task}</Markdown></div></div>
                  
                  {log.knowledgeBaseInfo && log.knowledgeBaseInfo.retrievedDocs.length > 0 && (
                    <div className="text-[10px] space-y-1">
                      <h5 className="font-bold text-teal-600 dark:text-teal-500 uppercase tracking-widest flex items-center gap-2"><Database className="w-3 h-3"/> Knowledge Base Retrieval</h5>
                      <div className="p-2 bg-zinc-100 dark:bg-black/20 rounded-md text-zinc-600 dark:text-zinc-400">
                        <p className="font-bold mb-1">Used {log.knowledgeBaseInfo.retrievedDocs.length} document(s) for context:</p>
                        <ul className="list-disc list-inside pl-2">
                          {log.knowledgeBaseInfo.retrievedDocs.map((doc, i) => (
                            <li key={i} className="truncate">{doc.file_name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {log.toolCalls?.map((tc: any, i: number) => (<div key={i} className="text-[10px] text-amber-600 dark:text-amber-500 font-bold flex items-center gap-2"><Hammer className="w-3 h-3" /> Invoke Tool: {tc.name}</div>))}
                   <div className="text-[10px] space-y-1 pt-3 border-t border-zinc-200 dark:border-zinc-800/40"><h5 className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Final Output</h5><div className={`prose prose-sm prose-invert ${log.status === 'failed' ? 'text-red-500 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-300'}`}><Markdown>{log.status === 'failed' ? `**Error:** ${log.error || 'Execution halted'}` : log.output || '*(No text output)*'}</Markdown></div></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className={`absolute -left-8 top-1 p-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 transition-all duration-200 opacity-0 group-hover:opacity-100`}>
        {isHovering ? <Eye className="w-3 h-3 text-indigo-500 dark:text-indigo-400" /> : <EyeOff className="w-3 h-3 text-zinc-500 dark:text-zinc-500" />}
      </div>
    </div>
  );
};


export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({ workflows, agents, tools, currentUser }) => {
  const [workflowSearch, setWorkflowSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'workflow' | 'user'>('workflow');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(executionManager.active);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>(executionManager.logs);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [workflowInputs, setWorkflowInputs] = useState<Record<string, { text: string, files: File[] }>>({});
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [allModels, setAllModels] = useState<DBModel[]>([]);
  const [allEngines, setAllEngines] = useState<Omit<Engine, 'api_key'>[]>([]);

  const [isPausedForHumanInput, setIsPausedForHumanInput] = useState(false);
  const [humanCheckpointData, setHumanCheckpointData] = useState<HumanCheckpoint | null>(null);
  const [humanFeedback, setHumanFeedback] = useState('');
  const [isReRunning, setIsReRunning] = useState(false);
  
  const [isBlueprintPanelCollapsed, setIsBlueprintPanelCollapsed] = useState(false);
  const [isHistoryPanelCollapsed, setIsHistoryPanelCollapsed] = useState(false);
  
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = executionManager.subscribe(() => {
      setIsExecuting(executionManager.active);
      setLogs([...executionManager.logs]);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    loadExecutionHistory();
    const loadData = async () => {
        const [m, e] = await Promise.all([dbService.getModels(), dbService.getEngines()]);
        setAllModels(m);
        setAllEngines(e);
    };
    loadData();
  }, []);
  
  useEffect(() => { 
    if (activeExecutionId) { 
      loadLogs(activeExecutionId); 
    } else { 
      executionManager.logs = [];
      executionManager.notify();
    } 
  }, [activeExecutionId]);

  const loadExecutionHistory = async () => setExecutions(await dbService.getWorkflowExecutions());
  const loadLogs = async (sid: string) => {
    const dbLogs = await dbService.getLogsByExecution(sid);
    executionManager.logs = dbLogs;
    executionManager.notify();
  };
  
  const readFileAsText = (file: File): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsText(file); });
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, parameter: string) => e.target.files && setWorkflowInputs(p => ({...p, [parameter]: { ...p[parameter], files: Array.from(e.target.files!) }}));
  const handleRemoveFile = (parameter: string, fileIndex: number) => setWorkflowInputs(p => { const currentFiles = p[parameter]?.files || []; const newFiles = currentFiles.filter((_, i) => i !== fileIndex); return {...p, [parameter]: { ...p[parameter], files: newFiles }}; });

  const filteredWorkflows = useMemo(() => workflows.filter(w => w.metadata.name.toLowerCase().includes(workflowSearch.toLowerCase())), [workflows, workflowSearch]);
  
  const filteredExecutions = useMemo(() => executions.filter(ex => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    if (searchType === 'workflow') {
      return ex.workflow_name?.toLowerCase().includes(query);
    } else { // searchType === 'user'
      return ex.user_email && ex.user_email.toLowerCase().includes(query);
    }
  }), [executions, searchQuery, searchType]);

  const uniqueParams = useMemo(() => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId); if (!workflow) return []; const params = new Map<string, string>();
    workflow.nodes.filter(n => n.type === 'agent').forEach(node => agents.find(a => a.id === node.agentId)?.inputs.forEach(input => { if (input.parameter && !params.has(input.parameter)) params.set(input.parameter, input.description); }));
    return Array.from(params.entries()).map(([parameter, description]) => ({ parameter, description }));
  }, [selectedWorkflowId, workflows, agents]);
  
  useEffect(() => {
    const initialInputs = uniqueParams.reduce((acc, p) => {
        acc[p.parameter] = { text: '', files: [] };
        return acc;
    }, {} as Record<string, { text: string; files: File[] }>);
    setWorkflowInputs(initialInputs);
  }, [selectedWorkflowId]);

  const isInputProvided = useMemo(() => {
    if (uniqueParams.length === 0) return true;
    return uniqueParams.some(p => {
        const input = workflowInputs[p.parameter];
        return (input?.text && input.text.trim() !== '') || (input?.files && input.files.length > 0);
    });
  }, [uniqueParams, workflowInputs]);


  const addLog = async (logData: Omit<ExecutionLog, 'id' | 'timestamp' | 'execution_id'>, duration?: number): Promise<string> => {
    const newLog: ExecutionLog = { ...logData, id: crypto.randomUUID(), execution_id: executionManager.currentExecutionId!, timestamp: Date.now(), duration, user_id: currentUser.id };
    executionManager.logs.push(newLog);
    executionManager.notify();
    setActiveLogId(newLog.id); 
    await dbService.saveLog(selectedWorkflowId, newLog, duration);
    return newLog.id;
  };
  
  const updateLog = async (id: string, updates: Partial<ExecutionLog>) => {
    const logIndex = executionManager.logs.findIndex(l => l.id === id);
    if (logIndex === -1) return;

    const updatedLog = { ...executionManager.logs[logIndex], ...updates };
    executionManager.logs[logIndex] = updatedLog;

    executionManager.notify();
    
    await dbService.saveLog(selectedWorkflowId, updatedLog);
  };
  
  const triggerDownload = (filename: string, content: string) => { const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); };
  
  const downloadAllOutputs = () => { /* ... existing code ... */ };
  const executeTool = async (toolClassName: string, args: any, agentTools: Tool[]) => { /* ... existing code ... */ return "Tool Executed"; };

  const finishExecution = async (status: 'completed' | 'failed' | 'stopped') => {
    if (!executionManager.active && status !== 'stopped') return;
    const duration = Math.floor((Date.now() - executionManager.startTime) / 1000);
    if (status === 'completed') {
       await addLog({ nodeId: 'system', agentName: 'System', status: 'completed', input: 'Teardown', output: `Pipeline finished. Total time: ${formatDuration(duration)}.` }, duration);
    }
    setExecutions(prev => prev.map(ex => ex.id === executionManager.currentExecutionId ? { ...ex, status, duration, user_email: currentUser.email } : ex));
    setIsPausedForHumanInput(false);
    executionManager.setActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    loadExecutionHistory();
  };
  
  const stopExecution = async () => {
    if (!executionManager.active) return;

    // Find the currently running log and mark it as stopped by the user.
    const runningLog = executionManager.logs.find(l => l.status === 'running');
    if (runningLog) {
      await updateLog(runningLog.id, { status: 'stopped', error: 'Execution terminated by user.' });
    }
    
    executionManager.setActive(false);
    await addLog({ nodeId: 'system', agentName: 'System', status: 'stopped', input: 'User action', output: 'Workflow execution terminated by user.' });
    await finishExecution('stopped');
  };

  const processNode = async (node: WorkflowNode, input: string, stopAfterThisNode = false): Promise<string | StopSignal> => {
    if (!executionManager.active) throw new Error("Execution stopped");

    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow) throw new Error("Workflow not found");
    
    // Handle Human Checkpoint Node
    if (node.type === 'human') {
      const logId = await addLog({ nodeId: node.id, agentName: 'Human Checkpoint', status: 'paused', input: input, output: 'Awaiting human review.' });
      const upstreamEdge = workflow.edges.find(e => e.target === node.id);
      const upstreamNode = upstreamEdge ? workflow.nodes.find(n => n.id === upstreamEdge.source) : null;
      const upstreamAgent = upstreamNode ? agents.find(a => a.id === upstreamNode.agentId) : null;

      setIsPausedForHumanInput(true);
      setHumanCheckpointData({
        logId,
        humanNodeId: node.id,
        upstreamAgent,
        input: input,
        outputVersions: [{ output: input }],
        currentOutputVersionIndex: 0,
      });
      return new Promise(() => {}); // Pause execution chain
    }

    // Handle Agent Node
    const agent = agents.find(a => a.id === node.agentId);
    if (!agent) throw new Error(`Agent with ID ${node.agentId} not found`);

    const iterCount = (executionManager.agentIterationCounts.get(agent.id) || 0) + 1;
    executionManager.agentIterationCounts.set(agent.id, iterCount);

    let taskWithInputs = agent.taskDescription;
    let paramContext = "";
    for(const inputDef of agent.inputs) {
        const val = workflowInputs[inputDef.parameter];
        let processedValue = '';
        const textPart = val?.text || '';
        const filesPart = (val?.files && val.files.length > 0) 
            ? await Promise.all(val.files.map(readFileAsText)).then(c => c.join('\n\n--- (File Content Break) ---\n\n')) 
            : '';
        processedValue = `${textPart}\n\n${filesPart}`.trim();

        if (taskWithInputs.includes(`{${inputDef.parameter}}`)) {
            taskWithInputs = taskWithInputs.split(`{${inputDef.parameter}}`).join(processedValue);
        } else {
            paramContext += `\n- ${inputDef.parameter}: ${processedValue}`;
        }
    }

    const finalInput = `CONTEXT_CHAIN: ${input || 'Start of Workflow'}\n\nPARAM_BLOCK:${paramContext || ' None'}\n\nASSIGNED_TASK: ${taskWithInputs}`;
    const logId = await addLog({ nodeId: node.id, agentName: agent.name, status: 'running', input: finalInput, version: iterCount });
    
    let output: string | undefined;
    let successful = false;

    try {
      const systemInstruction = `IDENTITY: ${agent.backstory}\nGOAL: ${agent.goal}\nOUTPUT_REQUIREMENTS: ${agent.expectedOutput}`;
      const response = await geminiService.generate(agent.config, systemInstruction, finalInput, undefined, tools.filter(t => agent.toolIds?.includes(t.id)), undefined, agent.knowledgeBaseIds, agent.id);
      if (!executionManager.active) throw new Error("Execution stopped");

      output = response.text || "Task complete.";
      await updateLog(logId, { status: 'completed', output, knowledgeBaseInfo: response.knowledgeBaseInfo });
      successful = true;
    } catch (err: any) {
      if (!executionManager.active) throw err;
      
      await updateLog(logId, { status: 'failed', error: err.message || 'Critical agent error.' });

      if (workflow.metadata.useManager) {
        const managerLogId = await addLog({ nodeId: 'system', agentName: 'Manager LLM', status: 'running', input: `Intervening due to failure in agent: ${agent.name}. Error: ${err.message}`, version: 0, output: 'Analyzing for recovery...'});

        const logHistory = executionManager.logs
          .filter(l => l.status === 'completed' && l.output && !['System', 'Manager LLM', 'Human Checkpoint'].includes(l.agentName))
          .map(l => `[${l.agentName} (V${l.version})]:\n${l.output}`)
          .join('\n\n---\n\n');

        const managerSystemInstruction = `You are a meticulous AI workflow manager acting as a fallback controller. An agent in the workflow has failed. Your job is to analyze the situation and decide the next step.
You have two options:
1.  **RECOVER**: If you can determine a logical output that the failed agent *should have* produced to meet the workflow's goal, provide that output directly. This will be passed to the next agent in the chain. Do not add any explanatory text, just the raw output.
2.  **STOP**: If the error is unrecoverable or the workflow's goal is now unattainable, respond with only the single word: STOP`;
        
        const managerPrompt = `WORKFLOW GOAL: ${workflow.metadata.description}\n\nEXECUTION HISTORY:\n${logHistory || 'No successful steps yet.'}\n\n---\n\nFAILED AGENT: "${agent.name}"\nAGENT'S ASSIGNED TASK:\n${finalInput}\n\nERROR MESSAGE: "${err.message}"\n\nBased on all the above, provide a recovery output or the word STOP.`;
        
        const modelInfo = allModels.find(m => m.id === workflow.metadata.managerModel);
        const engineInfo = modelInfo ? allEngines.find(e => e.id === modelInfo.engine_id) : null;
        if (!engineInfo) throw new Error(`Manager model's engine not found.`);
        const managerConfig: AgentConfig = {
            aiEngine: engineInfo.name, model: workflow.metadata.managerModel,
            temperature: workflow.metadata.managerTemperature, topP: workflow.metadata.managerTopP, maxRPM: 0, maxExecutionTime: 0, maxIterations: 0
        };

        const managerResponse = await geminiService.generate(managerConfig, managerSystemInstruction, managerPrompt);
        
        if (managerResponse.text && managerResponse.text.trim().toUpperCase() === 'STOP') {
            await updateLog(managerLogId, { status: 'completed', output: `Decision: **STOP**. The workflow could not be recovered from the agent failure.` });
            throw new Error(`Manager stopped workflow after agent '${agent.name}' failed.`);
        } else {
            output = managerResponse.text || `Recovered from ${agent.name} failure.`;
            await updateLog(managerLogId, { status: 'completed', output: `Decision: **RECOVER**. Provided new output to continue workflow.` });
            successful = true;
        }
      } else {
        throw err; // Re-throw if manager is not enabled
      }
    }
    
    if (successful && typeof output === 'string') {
        if (workflow.metadata.useManager) {
            executionManager.stepCount++;
            const maxIter = workflow.metadata.managerMaxIterations;
            if (maxIter && maxIter > 0 && executionManager.stepCount >= maxIter) {
              const reason = `Execution stopped: Maximum iteration limit of ${maxIter} reached.`;
              await addLog({ nodeId: 'system', agentName: 'Manager LLM', status: 'completed', input: 'Iteration Limit Check', output: `Decision: **STOP**. \n\n*Reason: ${reason}*` });
              return { stoppedByManager: true, reason };
            }

            if (agent.managerCondition && agent.managerCondition.trim() !== '') {
                const logHistory = executionManager.logs
                .filter(l => l.status === 'completed' && l.output && !['System', 'Manager LLM', 'Human Checkpoint'].includes(l.agentName))
                .map(l => `[${l.agentName} (V${l.version})]:\n${l.output}`)
                .join('\n\n---\n\n');
        
                if (logHistory) {
                    const managerSystemInstruction = `You are a meticulous AI workflow manager. An agent has a completion condition for you to evaluate. Your goal is to determine if the workflow should stop based on this condition. Review the execution history, the agent's output, and the condition.
    Respond with a JSON object containing two fields:
    1. "decision": either "STOP" or "CONTINUE".
    2. "reason": a brief explanation for your decision.

    If the condition is met based on the agent's output, decide to "STOP". Otherwise, "CONTINUE".`;
                    const managerPrompt = `WORKFLOW GOAL: ${workflow.metadata.description}\n\nEXECUTION HISTORY:\n${logHistory}\n\n---\n\nAGENT'S STOP CONDITION TO EVALUATE:\n"${agent.managerCondition}"\n\nBased on the agent's latest output and the condition above, has the stop condition been met?\n\nRESPONSE (JSON):`;
                    
                    const modelInfo = allModels.find(m => m.id === workflow.metadata.managerModel);
                    const engineInfo = modelInfo ? allEngines.find(e => e.id === modelInfo.engine_id) : null;
                    if (!engineInfo) throw new Error(`Manager model's engine not found.`);
            
                    const managerConfig: AgentConfig = {
                        aiEngine: engineInfo.name,
                        model: workflow.metadata.managerModel,
                        temperature: workflow.metadata.managerTemperature,
                        topP: workflow.metadata.managerTopP, maxRPM: 0, maxExecutionTime: 0, maxIterations: 0
                    };
                    
                    const managerLogId = await addLog({ nodeId: 'system', agentName: 'Manager LLM', status: 'running', input: `Evaluating condition for agent "${agent.name}"...`, version: 0, output: 'Awaiting decision...'});
                    const managerResponse = await geminiService.generate(managerConfig, managerSystemInstruction, managerPrompt, 'application/json');
                    
                    let managerDecision = { decision: 'CONTINUE', reason: 'Defaulting to continue.' };
                    try {
                        if (managerResponse.text) {
                            const cleanedText = managerResponse.text.replace(/```json|```/g, '').trim();
                            managerDecision = JSON.parse(cleanedText);
                        }
                    } catch (e) {
                        console.error("Failed to parse Manager LLM JSON response:", e, managerResponse.text);
                        if (managerResponse.text?.toUpperCase().includes('STOP')) {
                            managerDecision = { decision: 'STOP', reason: 'Objective likely met based on text analysis (response was malformed JSON).' };
                        } else {
                            managerDecision = { decision: 'CONTINUE', reason: 'Response was malformed, continuing as a precaution.' };
                        }
                    }
                    
                    const reasonText = managerDecision.reason || "No reason provided.";
                    if (managerDecision.decision === 'STOP') {
                        await updateLog(managerLogId, { status: 'completed', output: `Decision: **STOP**. \n\n*Reason: ${reasonText}*` });
                        return { stoppedByManager: true, reason: reasonText };
                    } else {
                        await updateLog(managerLogId, { status: 'completed', output: `Decision: **CONTINUE**. \n\n*Reason: ${reasonText}*` });
                    }
                }
            }
        }
        
        if (stopAfterThisNode) return output;
        
        const outgoingEdges = workflow.edges.filter(e => e.source === node.id);
        const downstreamNodes = outgoingEdges.map(edge => workflow.nodes.find(n => n.id === edge.target)).filter((n): n is WorkflowNode => !!n);
        
        if (downstreamNodes.length === 0) return output;
  
        if (downstreamNodes.length > 1) {
          await addLog({ nodeId: 'system', agentName: 'System', status: 'running', input: 'Parallel Execution', output: `Fanning out to ${downstreamNodes.length} branches.` });
          
          const branchPromises = downstreamNodes.map(branchNode => processNode(branchNode, output, true));
          const branchResults = await Promise.all(branchPromises);
  
          const stopResult = branchResults.find((r): r is StopSignal => typeof r === 'object' && 'stoppedByManager' in r && r.stoppedByManager);
          if (stopResult) return stopResult;
          
          const branchOutputs = branchResults as string[];
  
          const successorEdges = workflow.edges.filter(e => downstreamNodes.some(dn => dn.id === e.source));
          const fanInNodeId = successorEdges[0]?.target;
          const allConverge = fanInNodeId && successorEdges.every(e => e.target === fanInNodeId) && successorEdges.length === downstreamNodes.length;
          
          if (fanInNodeId && allConverge) {
            const fanInNode = workflow.nodes.find(n => n.id === fanInNodeId);
            if (fanInNode) {
                const branchAgentNames = downstreamNodes.map(dn => dn.type === 'agent' ? (agents.find(a => a.id === dn.agentId)?.name || 'Agent') : 'Checkpoint');
                const aggregatedInput = branchOutputs.map((out, i) => `--- Output from ${branchAgentNames[i]} ---\n\n${out}`).join('\n\n');
                await addLog({ nodeId: 'system', agentName: 'System', status: 'completed', input: 'Aggregation', output: `Aggregated outputs from: ${branchAgentNames.join(', ')}.` });
                return await processNode(fanInNode, aggregatedInput);
            }
          }
          return branchOutputs.join('\n\n---\n\n');
        } else {
          return await processNode(downstreamNodes[0], output);
        }
    } else {
        throw new Error(`Agent ${agent.name} failed and was not recovered.`);
    }
  };

  const handleHumanApproval = async () => {
    if (!humanCheckpointData) return;
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId)!;
    const approvedOutput = humanCheckpointData.outputVersions[humanCheckpointData.currentOutputVersionIndex].output;
    
    await updateLog(humanCheckpointData.logId, { status: 'completed', output: "Human approved output." });
    
    setIsPausedForHumanInput(false);
    setHumanCheckpointData(null);
    setHumanFeedback('');
    executionManager.setActive(true); // Resume execution state
    
    const outgoingEdges = workflow.edges.filter(e => e.source === humanCheckpointData.humanNodeId);
    const downstreamNodes = outgoingEdges.map(edge => workflow.nodes.find(n => n.id === edge.target)).filter((n): n is WorkflowNode => !!n);

    if (downstreamNodes.length === 0) {
      await finishExecution('completed');
      return;
    }
    
    try {
        if (downstreamNodes.length > 1) {
            await addLog({ nodeId: 'system', agentName: 'System', status: 'running', input: 'Human Approval', output: `Fanning out to ${downstreamNodes.length} parallel branches after human approval.` });
            
            const branchPromises = downstreamNodes.map(branchNode => processNode(branchNode, approvedOutput, true));
            const branchResults = await Promise.all(branchPromises);

            const stopResult = branchResults.find((r): r is StopSignal => typeof r === 'object' && 'stoppedByManager' in r && r.stoppedByManager);
            if (stopResult) {
                await addLog({ nodeId: 'system', agentName: 'System', status: 'completed', input: 'Manager Decision', output: `Workflow halted by Manager LLM. Reason: ${stopResult.reason}` });
                await finishExecution('completed');
                return;
            }
            const branchOutputs = branchResults as string[];

            const successorEdges = workflow.edges.filter(e => downstreamNodes.some(dn => dn.id === e.source));
            const fanInNodeId = successorEdges.length > 0 ? successorEdges[0].target : null;
            const allConverge = fanInNodeId && successorEdges.every(e => e.target === fanInNodeId) && successorEdges.length === downstreamNodes.length;
            
            if (fanInNodeId && allConverge) {
                const fanInNode = workflow.nodes.find(n => n.id === fanInNodeId);
                if (fanInNode) {
                    const branchNames = downstreamNodes.map(dn => dn.type === 'agent' ? (agents.find(a => a.id === dn.agentId)?.name || 'Agent') : 'Checkpoint');
                    const aggregatedInput = branchOutputs.map((out, i) => `--- Output from ${branchNames[i]} ---\n\n${out}`).join('\n\n');
                    await addLog({ nodeId: 'system', agentName: 'System', status: 'completed', input: 'Aggregation', output: `Aggregated outputs from: ${branchNames.join(', ')}.` });
                    await processNode(fanInNode, aggregatedInput);
                }
            }
        } else {
            await processNode(downstreamNodes[0], approvedOutput);
        }
        if (executionManager.active) {
          await finishExecution('completed');
        }
    } catch (err: any) {
        if (err.message !== "Execution stopped") {
            await addLog({ nodeId: 'system', agentName: 'System', status: 'failed', input: 'Orchestration Error', error: err.message });
            await finishExecution('failed');
        }
    }
  };
  
  const handleHumanRejectionAndRerun = async () => {
    if (!humanCheckpointData || !humanFeedback) return;
    setIsReRunning(true);
    const { upstreamAgent, input } = humanCheckpointData;
    if (!upstreamAgent) {
        alert("Cannot re-run; upstream agent not found.");
        setIsReRunning(false);
        return;
    }
    
    try {
      let taskWithInputs = upstreamAgent.taskDescription;
      // Note: This is a simplified re-run and doesn't re-process workflow inputs.
      const finalInput = `CONTEXT_CHAIN: ${input || 'Start of Workflow'}\n\nPARAM_BLOCK: Re-run from human feedback\n\nASSIGNED_TASK: ${taskWithInputs}`;
      
      const systemInstruction = `IDENTITY: ${upstreamAgent.backstory}\nGOAL: ${upstreamAgent.goal}\nOUTPUT_REQUIREMENTS: ${upstreamAgent.expectedOutput}`;
      const response = await geminiService.generate(upstreamAgent.config, systemInstruction, finalInput, undefined, [], humanFeedback, upstreamAgent.knowledgeBaseIds, upstreamAgent.id);
      const newOutput = response.text || "Task complete (re-run).";
      
      setHumanCheckpointData(prev => prev ? ({ ...prev, outputVersions: [...prev.outputVersions, { output: newOutput }], currentOutputVersionIndex: prev.outputVersions.length }) : null);
      setHumanFeedback('');
    } catch (err: any) {
      alert("Failed to re-run agent: " + err.message);
    } finally {
      setIsReRunning(false);
    }
  };
  
  const startExecution = async () => {
    const workflow = workflows.find(w => w.metadata.id === selectedWorkflowId);
    if (!workflow || workflow.nodes.length === 0) return;
    
    const executionId = crypto.randomUUID();
    const startTime = Date.now();
    
    executionManager.reset();
    executionManager.currentExecutionId = executionId;
    executionManager.startTime = startTime;
    executionManager.setActive(true);

    setActiveExecutionId(executionId);
    setElapsedSeconds(0);
    setIsPausedForHumanInput(false);
    setHumanCheckpointData(null);
    
    timerRef.current = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000)), 1000);
    setExecutions(prev => [{ id: executionId, workflow_id: workflow.metadata.id, workflow_name: workflow.metadata.name, status: 'running', timestamp: startTime, user_email: currentUser.email }, ...prev]);
    
    try {
        let startNode = workflow.nodes.find(n => workflow.edges.every(e => e.target !== n.id));
        if (!startNode) {
          if ((workflow.metadata.type === WorkflowType.CIRCULAR || workflow.metadata.type === WorkflowType.HYBRID) && workflow.nodes.length > 0) {
            startNode = workflow.nodes[0];
          } else {
            throw new Error("Could not find a starting node. For non-circular workflows, ensure there is at least one node with no incoming connections.");
          }
        }
        
        const finalOutputOrStopSignal = await processNode(startNode, "");

        if (typeof finalOutputOrStopSignal === 'object' && finalOutputOrStopSignal.stoppedByManager) {
            await addLog({ nodeId: 'system', agentName: 'System', status: 'completed', input: 'Manager Decision', output: `Workflow halted by Manager LLM. Reason: ${finalOutputOrStopSignal.reason}` });
            await finishExecution('completed');
        } else if (executionManager.active) {
            await addLog({ nodeId: 'system', agentName: 'System', status: 'completed', input: 'Final Output', output: finalOutputOrStopSignal as string });
            await finishExecution('completed');
        }
    } catch (err: any) {
        if (err.message !== "Execution stopped") {
            await addLog({ nodeId: 'system', agentName: 'System', status: 'failed', input: 'Orchestration Error', error: err.message });
            await finishExecution('failed');
        } else {
            // This case happens when stopExecution is called by the user
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }
  };
  
  const formatDuration = (seconds?: number) => { if (seconds === undefined || seconds === null) return '0s'; if (seconds < 60) return `${seconds}s`; return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; };
  const activeLog = logs.find(l => l.id === activeLogId);
  const activeExecution = executions.find(ex => ex.id === activeExecutionId);
  const activeWorkflow = workflows.find(w => w.metadata.id === activeExecution?.workflow_id);

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-[#09090b]">
      <header className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4"><div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20"><Play className="w-6 h-6 text-white" /></div><div><h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Workflow Execution</h2><p className="text-sm text-zinc-500 dark:text-zinc-500">Persisted Traceability & Live Intelligence</p></div></div>
        {isExecuting && <button onClick={stopExecution} className="flex items-center gap-2 px-5 py-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-xl text-xs hover:bg-red-200 dark:hover:bg-red-900/40 transition-all font-bold shadow-lg shadow-red-500/10 active:scale-95"><Square className="w-4 h-4 fill-current" /> Terminate Workflow</button>}
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        <div className="flex border-r border-zinc-200 dark:border-zinc-800">
          {isBlueprintPanelCollapsed ? (
            <div className="w-14 border-r border-zinc-200 dark:border-zinc-800 bg-white/30 dark:bg-[#0c0c0e]/30 flex flex-col items-center py-6">
              <button onClick={() => setIsBlueprintPanelCollapsed(false)} className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300 rounded-lg transition-all" title="Expand Blueprint"><PanelRight className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 p-6 flex flex-col bg-white/30 dark:bg-[#0c0c0e]/30 overflow-y-auto gap-8 scrollbar-thin relative">
              <button onClick={() => setIsBlueprintPanelCollapsed(true)} className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md" title="Collapse Blueprint"><PanelLeftClose className="w-4 h-4"/></button>
              <section>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4 flex items-center gap-2"><Box className="w-3.5 h-3.5" /> Target Blueprint</h3>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" /><input type="text" placeholder="Find workflow..." value={workflowSearch} onChange={(e) => setWorkflowSearch(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                    <div className="relative">
                      <select disabled={isExecuting} value={selectedWorkflowId} onChange={(e) => setSelectedWorkflowId(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none pr-8"><option value="" disabled>Select workflow...</option>{filteredWorkflows.map(w => <option key={w.metadata.id} value={w.metadata.id}>{w.metadata.name}</option>)}</select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                  {selectedWorkflowId ? (<><section className="space-y-4 flex-1"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2 flex items-center gap-2"><Settings className="w-3.5 h-3.5" /> Execution Config</h3><div className="space-y-4 overflow-y-auto pr-1">{uniqueParams.map(({ parameter, description }) => (<div key={parameter} className="space-y-2"><label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter mono pl-1">{parameter}</label><textarea disabled={isExecuting} value={workflowInputs[parameter]?.text || ''} onChange={(e) => setWorkflowInputs(prev => ({ ...prev, [parameter]: { ...prev[parameter], text: e.target.value } }))} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-xs text-zinc-800 dark:text-zinc-300 min-h-[60px] resize-y focus:ring-1 focus:ring-indigo-500 outline-none scrollbar-thin" placeholder={description} /><div className="space-y-1">{(workflowInputs[parameter]?.files || []).map((f, i) => (<div key={i} className="flex items-center justify-between text-xs bg-zinc-100 dark:bg-zinc-950 p-2 rounded-md border border-zinc-200 dark:border-zinc-800"><span className="truncate">{f.name}</span><button onClick={()=>handleRemoveFile(parameter,i)} className="p-1"><X className="w-3 h-3"/></button></div>))}{(workflowInputs[parameter]?.files || []).length > 0 && <button onClick={() => setWorkflowInputs(p=>({...p, [parameter]: {...p[parameter], files:[]}}))} className="text-red-500 dark:text-red-400 text-[9px] w-full text-center p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md">Clear Files</button>}</div><label htmlFor={`wf-file-${parameter}`} className="cursor-pointer flex items-center justify-center gap-2 w-full p-1.5 bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300/80 dark:border-zinc-700/80 rounded-lg text-[9px] font-bold text-zinc-500 dark:text-zinc-400 transition-colors"><Upload className="w-3 h-3" /> Attach</label><input id={`wf-file-${parameter}`} type="file" multiple className="hidden" onChange={e=>handleFileChange(e,parameter)}/></div>))}{uniqueParams.length === 0 && <p className="text-[10px] text-zinc-500 dark:text-zinc-600 italic text-center py-4">No runtime params needed.</p>}</div></section><button onClick={startExecution} disabled={isExecuting || !isInputProvided} className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all shadow-xl ${isExecuting || !isInputProvided ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-95'}`}>{isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />} {isExecuting ? 'Workflow Active' : 'Start Execution'}</button></>) : (<div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center py-10 px-4"><History className="w-10 h-10 mb-4 text-zinc-500 dark:text-zinc-600" /><p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Select blueprint to begin</p></div>)}
                </div>
              </section>
            </div>
          )}
          
          {isHistoryPanelCollapsed ? (
            <div className="w-14 bg-zinc-100/10 dark:bg-[#0c0c0e]/10 flex flex-col items-center py-6">
              <button onClick={() => setIsHistoryPanelCollapsed(false)} className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300 rounded-lg transition-all" title="Expand History"><PanelRight className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="w-[260px] flex flex-col bg-zinc-100/10 dark:bg-[#0c0c0e]/10 overflow-hidden relative">
              <button onClick={() => setIsHistoryPanelCollapsed(true)} className="absolute top-2 right-2 p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md z-10" title="Collapse History"><PanelLeftClose className="w-4 h-4"/></button>
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/20 dark:bg-zinc-900/20 shrink-0">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3.5 h-3.5" /> Previous Runs</h3>
              </div>
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/20 dark:bg-zinc-900/20 space-y-3">
                 <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select value={searchType} onChange={e => setSearchType(e.target.value as any)} className="w-full bg-zinc-200/50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-3 pr-8 py-1.5 text-[10px] outline-none appearance-none">
                        <option value="workflow">By Name</option>
                        <option value="user">By User</option>
                      </select>
                       <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 text-zinc-400"/>
                    </div>
                  </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                  <input type="text" placeholder={`Search by ${searchType === 'workflow' ? 'name' : 'user'}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-zinc-200/50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                {filteredExecutions.map(ex => (<button key={ex.id} onClick={() => setActiveExecutionId(ex.id)} className={`w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden group ${activeExecutionId === ex.id ? 'bg-indigo-600/10 border-indigo-600/40 shadow-lg' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'}`}><div className="flex justify-between items-start mb-2"><span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate pr-2">{ex.workflow_name}</span><div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${ex.status === 'completed' ? 'bg-emerald-500' : ex.status === 'paused' ? 'bg-yellow-500' : ex.status === 'stopped' ? 'bg-amber-500' : ex.status === 'running' ? 'bg-indigo-500 animate-pulse' : 'bg-red-500'}`} /></div>
                <div className="flex items-center justify-between text-[9px] text-zinc-500 dark:text-zinc-600">
                  <div className="flex items-center gap-1.5" title={`Executed by ${ex.user_email}`}><UserIcon className="w-2.5 h-2.5" /><span className="truncate">{ex.user_email ? ex.user_email.split('@')[0] : 'System'}</span></div>
                  <div className="flex items-center gap-1.5"><Clock className="w-2.5 h-2.5" /><span>{new Date(ex.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>
                  {ex.duration !== undefined && ex.duration !== null && (<div className="text-indigo-500 dark:text-indigo-400 font-bold">{formatDuration(ex.duration)}</div>)}
                </div>
                </button>))}
                {filteredExecutions.length === 0 && <p className="text-[10px] text-zinc-500 dark:text-zinc-700 text-center py-10 uppercase tracking-widest font-bold">No history available</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col bg-zinc-100 dark:bg-black/40 overflow-hidden relative">
           {activeExecutionId ? (<div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin p-8"><div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
            {isPausedForHumanInput && humanCheckpointData && (
              <section className="bg-yellow-500/10 border-2 border-dashed border-yellow-500/30 p-8 rounded-3xl space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-yellow-600 dark:text-yellow-400 flex items-center gap-3"><ThumbsUp className="w-6 h-6"/> Human Input Required</h3><div className="flex items-center gap-2"><div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{humanCheckpointData.upstreamAgent?.name || 'Upstream'}</div><div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"/></div></div>
                <div className="bg-white/30 dark:bg-black/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 min-h-[200px] max-h-[400px] overflow-y-auto scrollbar-thin space-y-4"><div className="flex justify-between items-center"><div className="text-xs font-bold text-zinc-500 uppercase">Agent Output</div>{humanCheckpointData.outputVersions.length > 1 && (<div className="flex gap-2">{humanCheckpointData.outputVersions.map((_, i) => (<button key={i} onClick={()=>setHumanCheckpointData(p=>p?{...p, currentOutputVersionIndex:i}:null)} className={`px-3 py-1 text-[10px] rounded-md font-bold ${i === humanCheckpointData.currentOutputVersionIndex ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>V{i+1}</button>))}</div>)}</div><div className="prose prose-sm prose-invert"><Markdown>{humanCheckpointData.outputVersions[humanCheckpointData.currentOutputVersionIndex].output}</Markdown></div></div>
                <div className="bg-zinc-100/30 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-300 mb-4">Are you satisfied with this output?</p>
                  <div className="flex gap-4 items-stretch">
                      <div className="flex-1 space-y-3">
                          <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Provide feedback for revision (optional)</label>
                          <textarea value={humanFeedback} onChange={e=>setHumanFeedback(e.target.value)} rows={3} placeholder="e.g., 'Make the tone more professional and add a concluding paragraph.'" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-yellow-500 outline-none resize-y min-h-[100px]"></textarea>
                          <button onClick={handleHumanRejectionAndRerun} disabled={!humanFeedback || isReRunning} className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold text-white text-sm disabled:opacity-50">
                              <MessageSquare className="w-4 h-4"/>
                              {isReRunning ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Re-run with Feedback'}
                          </button>
                      </div>
                      <div className="w-px bg-zinc-300 dark:bg-zinc-700"/>
                      <div className="flex flex-col justify-end">
                        <button onClick={handleHumanApproval} className="px-5 py-3 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all text-sm">
                            <ThumbsUp className="w-4 h-4"/> 
                            <span>Approve & Continue</span>
                        </button>
                      </div>
                  </div>
                </div>
              </section>
            )}
            <section className="space-y-4">
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsLogExpanded(!isLogExpanded)} className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"><Terminal className="w-4 h-4 text-indigo-500" /> Consolidated Log {isLogExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button>
                  {(isExecuting ? elapsedSeconds > 0 : activeExecution?.duration !== undefined) && (<span className="px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-200 dark:border-indigo-500/20">Execution Time: {formatDuration(isExecuting ? elapsedSeconds : activeExecution?.duration)}</span>)}
                </div>
                {!isExecuting && logs.some(l => l.status === 'completed' && l.output) && <button onClick={downloadAllOutputs} className="flex items-center gap-2 text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors" title="Download All Outputs"><Download className="w-3.5 h-3.5" /><span>Download All</span></button>}
              </div>
              {isLogExpanded && (<div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5 dark:ring-white/5 font-mono text-[11px] leading-relaxed animate-in slide-in-from-top-3 duration-300"><div className="bg-zinc-100/50 dark:bg-zinc-900/50 px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between"><span className="text-zinc-500 dark:text-zinc-600 uppercase tracking-widest text-[9px] font-bold">Live System Trace • ID: {activeExecutionId?.slice(0,8)}</span>{(isExecuting || isReRunning) && <span className="flex items-center gap-2 text-indigo-500 text-[9px] font-bold uppercase animate-pulse"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" /> Synchronizing</span>}</div><div className="p-6 space-y-4 min-h-[150px] max-h-[500px] overflow-y-auto scrollbar-thin">{logs.map((log) => <LogEntry key={log.id} log={log} />)}{(isExecuting || isReRunning) && <div className="flex items-center gap-3 text-indigo-500 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest pl-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing next instruction...</div>}</div></div>)}</section>
            <section className="space-y-4 pb-20"><h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Layers className="w-4 h-4" /> Agent Traces</h3><div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">{logs.filter(l => !['System', 'Manager LLM', 'Human Checkpoint'].includes(l.agentName)).map(log => (<button key={log.id} onClick={() => setActiveLogId(log.id)} className={`shrink-0 flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all ${activeLogId === log.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'}`}><div className={`w-2.5 h-2.5 rounded-full ${log.status === 'completed' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : log.status === 'failed' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]' : log.status === 'paused' ? 'bg-yellow-400' : 'bg-indigo-400 animate-pulse'}`} /><span className="text-[11px] font-bold uppercase tracking-wider">{log.agentName} {log.version && `(V${log.version})`}</span></button>))}</div>
            {activeLog && !['System', 'Manager LLM', 'Human Checkpoint'].includes(activeLog.agentName) && (<div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6"><div className="p-10 bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl relative group min-h-[400px]"><div className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-8 flex items-center justify-between"><div className="flex items-center gap-3"><FileText className="w-4 h-4" /><span>Trace: {activeLog.agentName}</span>{activeLog.version && <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-800">V{activeLog.version}</span>}</div><div className="flex items-center gap-4"><button onClick={() => { const node = activeWorkflow?.nodes.find(n => n.id === activeLog.nodeId); const agent = agents.find(a => a.id === node?.agentId); triggerDownload(`${activeLog.agentName}_v${activeLog.version}_output${agent?.outputFileExtension || '.txt'}`, activeLog.output || ''); }} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-[10px] font-bold"><Download className="w-3.5 h-3.5" /> DOWNLOAD</button><div className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase ${activeLog.status === 'failed' ? 'bg-red-100 dark:bg-red-900/10 border-red-500 text-red-600 dark:text-red-400 shadow-lg shadow-red-500/10 dark:shadow-red-900/20' : activeLog.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'bg-indigo-100 dark:bg-indigo-900/10 border-indigo-500 text-indigo-600 dark:text-indigo-400'}`}>Status: {activeLog.status}</div></div></div>{activeLog.status === 'running' ? (<div className="flex flex-col items-center py-32 gap-6 opacity-40"><div className="relative"><Loader2 className="w-16 h-16 animate-spin text-indigo-500" /><Cpu className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div><div className="text-center space-y-1"><p className="text-base font-bold text-zinc-700 dark:text-zinc-300">Agent Thinking</p><p className="text-xs text-zinc-500 italic animate-pulse">Navigating internal logic layers...</p></div></div>) : activeLog.status === 'failed' ? (<div className="animate-in zoom-in-95 duration-300 p-8 border-2 border-red-200 dark:border-red-900/30 bg-red-100/30 dark:bg-red-900/10 rounded-3xl flex flex-col items-center text-center gap-5"><div className="w-16 h-16 bg-red-600/10 dark:bg-red-600/20 rounded-full flex items-center justify-center border border-red-600/20 dark:border-red-600/30"><AlertCircle className="w-8 h-8 text-red-500" /></div><div><h4 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Execution Halted</h4><p className="text-sm text-red-500/80 dark:text-red-200/60 max-w-lg leading-relaxed mb-6">The agent encountered an error during processing. This is typically caused by prompt constraints, model refusal, or connectivity issues.</p><div className="bg-white/40 dark:bg-black/40 border border-red-200 dark:border-red-900/30 p-5 rounded-2xl text-left mono text-xs text-red-600 dark:text-red-400 w-full overflow-auto max-h-[200px] scrollbar-thin"><span className="font-bold text-red-700 dark:text-red-500 block mb-2 uppercase tracking-widest text-[10px]">Error Trace:</span>{activeLog.error || 'The system was unable to capture a specific error reason. Please check the agent backstory and task definition.'}</div></div></div>) : (<div className="prose prose-md prose-invert max-w-none animate-in fade-in duration-500"><Markdown>{activeLog.output || 'No output text returned for this trace segment.'}</Markdown></div>)}</div></div>)}</section>
           </div></div>) : (<div className="flex-1 flex flex-col items-center justify-center opacity-10 select-none grayscale py-40"><Terminal className="w-32 h-32 mb-8 text-zinc-600 dark:text-zinc-800" /><h3 className="text-4xl font-bold uppercase tracking-[0.4em] text-zinc-500 dark:text-zinc-700">Awaiting Signal</h3><p className="mt-4 text-sm font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-800">Select or execute a blueprint to view traces</p></div>)}
        </div>
      </div>
    </div>
  );
};
