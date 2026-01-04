import React, { useState, useMemo } from 'react';
import Markdown from 'markdown-to-jsx';
import { Agent, AgentVersion, User } from '../types';
import { geminiService } from '../services/gemini';
import { ArrowLeft, Play, Loader2, AlertCircle, Cpu, GitCommit, ChevronDown } from 'lucide-react';

interface AgentCompareViewProps {
  agent: Agent;
  allUsers: User[];
  onBack: () => void;
  currentUser: User;
}

const ComparisonPanel: React.FC<{ 
  version: AgentVersion, 
  onRun: (inputs: Record<string, string>) => Promise<{output?: string, error?: string}>
}> = ({ version, onRun }) => {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRun = async () => {
    setIsLoading(true);
    setOutput('');
    setError('');
    const result = await onRun(inputs);
    setOutput(result.output || '');
    setError(result.error || '');
    setIsLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 space-y-2 overflow-y-auto scrollbar-thin border-b border-zinc-200 dark:border-zinc-800" style={{flexBasis: '40%'}}>
        {version.data.inputs.length > 0 ? version.data.inputs.map(input => (
          <div key={input.parameter} className="space-y-1">
            <label className="text-xs font-mono text-indigo-600 dark:text-indigo-400">{input.parameter}</label>
            <textarea value={inputs[input.parameter] || ''} onChange={(e) => setInputs(prev => ({...prev, [input.parameter]: e.target.value}))} rows={4} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md p-2 text-xs mono resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        )) : <div className="text-center text-zinc-500 dark:text-zinc-600 text-xs py-10">No inputs required.</div>}
      </div>
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <button onClick={handleRun} disabled={isLoading} className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-zinc-200 dark:bg-zinc-800 text-xs font-bold rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50">
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Run
        </button>
      </div>
      <div className="flex-1 bg-zinc-100/50 dark:bg-black/30 p-4 overflow-y-auto scrollbar-thin">
        <div className="prose prose-sm prose-invert w-full max-w-none">
          {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mt-10" /> 
            : error ? <div className="text-red-500 dark:text-red-400 text-xs"><AlertCircle className="w-4 h-4 inline-block mr-2"/>{error}</div> 
            : <Markdown>{output || ''}</Markdown>}
        </div>
      </div>
    </div>
  );
};

export const AgentCompareView: React.FC<AgentCompareViewProps> = ({ agent, allUsers, onBack, currentUser }) => {
  const allVersions = useMemo(() => {
    const currentVersionData = { name: agent.name, description: agent.description, role: agent.role, domain: agent.domain, goal: agent.goal, backstory: agent.backstory, taskDescription: agent.taskDescription, inputs: agent.inputs, expectedOutput: agent.expectedOutput, outputFileExtension: agent.outputFileExtension, config: agent.config, toolIds: agent.toolIds, knowledgeBaseIds: agent.knowledgeBaseIds, guardrailIds: agent.guardrailIds, managerCondition: agent.managerCondition };
    const currentVersionEntry: AgentVersion = { version: agent.version, data: currentVersionData, createdAt: agent.updated_at || agent.created_at || Date.now(), created_by: agent.updated_by || agent.created_by || currentUser.id };
    return [...(agent.versions || []), currentVersionEntry].sort((a, b) => b.version - a.version);
  }, [agent, currentUser.id]);
  
  const [leftVersion, setLeftVersion] = useState<AgentVersion | null>(allVersions[1] || null);
  const [rightVersion, setRightVersion] = useState<AgentVersion | null>(allVersions[0] || null);
  
  const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u.email])), [allUsers]);

  const runTestForVersion = async (version: AgentVersion, inputs: Record<string, string>): Promise<{output?: string, error?: string}> => {
    const agentData = version.data;
    try {
      let taskWithInputs = agentData.taskDescription;
      let paramContext = "";
      agentData.inputs.forEach(input => {
        const val = inputs[input.parameter] || "";
        taskWithInputs = taskWithInputs.split(`{${input.parameter}}`).join(val);
        paramContext += `\n- ${input.parameter}: ${val}`;
      });
      const finalInput = `CONTEXT_CHAIN: Standalone test.\n\nPARAM_BLOCK:${paramContext || ' None'}\n\nASSIGNED_TASK: ${taskWithInputs}`;
      const response = await geminiService.generate(
        agentData.config, 
        `IDENTITY: ${agentData.backstory}\nGOAL: ${agentData.goal}\nOUTPUT_REQUIREMENTS: ${agentData.expectedOutput}`, 
        finalInput,
        undefined,
        [],
        undefined,
        agentData.knowledgeBaseIds,
        agent.id
      );
      return { output: response.text || 'No output.' };
    } catch (e: any) {
      return { error: e.message || 'An unknown error occurred.' };
    }
  };

  const renderVersionSelector = (
    current: AgentVersion | null, 
    setter: (v: AgentVersion) => void, 
    disabledVersion: AgentVersion | null
  ) => (
    <div className="relative">
      <select 
        value={current?.version || ''} 
        onChange={(e) => {
          const v = allVersions.find(av => av.version === parseInt(e.target.value));
          if (v) setter(v);
        }}
        className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none appearance-none"
      >
        <option value="" disabled>Select a version</option>
        {allVersions.map(v => (
          <option key={v.version} value={v.version} disabled={v.version === disabledVersion?.version}>
            {v.name ? `${v.name} (V${v.version})` : `Version ${v.version}`}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
    </div>
  );
  
  const formatDateTime = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    }).format(new Date(timestamp));
  };
  
  const VersionInfo: React.FC<{version: AgentVersion | null}> = ({version}) => {
    if (!version) return null;
    return (
      <div className="text-[10px] text-zinc-500 mt-2 space-y-1">
        <div>Created by: {userMap.get(version.created_by) || 'Unknown'}</div>
        <div>Date: {formatDateTime(version.createdAt)}</div>
      </div>
    )
  };

  return (
    <div className="h-full flex flex-col bg-zinc-100 dark:bg-[#09090b]">
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#0c0c0e] sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"><ArrowLeft className="w-5 h-5" /></button>
          <div className="w-px h-6 bg-zinc-200 dark:border-zinc-800" />
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Compare Versions: {agent.name}</h2>
            <p className="text-xs text-zinc-500">Run two versions side-by-side to analyze behavioral changes.</p>
          </div>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="flex-1 flex flex-col border-r border-zinc-200 dark:border-zinc-800">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            {renderVersionSelector(leftVersion, setLeftVersion, rightVersion)}
            <VersionInfo version={leftVersion} />
          </div>
          {leftVersion ? <ComparisonPanel version={leftVersion} onRun={(i) => runTestForVersion(leftVersion, i)} /> : <div className="p-8 text-center text-zinc-500 dark:text-zinc-600">Select a version to begin.</div>}
        </div>
        {/* Right Panel */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            {renderVersionSelector(rightVersion, setRightVersion, leftVersion)}
            <VersionInfo version={rightVersion} />
          </div>
          {rightVersion ? <ComparisonPanel version={rightVersion} onRun={(i) => runTestForVersion(rightVersion, i)} /> : <div className="p-8 text-center text-zinc-500 dark:text-zinc-600">Select a version to begin.</div>}
        </div>
      </div>
    </div>
  );
};