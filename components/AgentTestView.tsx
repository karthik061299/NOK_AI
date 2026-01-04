
import React, { useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { Agent, Tool } from '../types';
import { geminiService } from '../services/gemini';
import { ArrowLeft, Play, Download, Loader2, AlertCircle, Cpu, FileText, Upload, X } from 'lucide-react';

interface AgentTestViewProps {
  agent: Agent;
  onBack: () => void;
}

export const AgentTestView: React.FC<AgentTestViewProps> = ({ agent, onBack }) => {
  const [inputs, setInputs] = useState<Record<string, string | File[]>>({});
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, parameter: string) => {
    if (e.target.files) {
      setInputs(prev => ({...prev, [parameter]: Array.from(e.target.files!)}));
    }
  };

  const handleRemoveFile = (parameter: string, fileIndex: number) => {
    setInputs(prev => {
      const currentFiles = prev[parameter] as File[];
      const newFiles = currentFiles.filter((_, i) => i !== fileIndex);
      return {...prev, [parameter]: newFiles.length > 0 ? newFiles : ''};
    });
  };

  const handleRunTest = async () => {
    setIsLoading(true);
    setError('');
    setOutput('');
    
    try {
      let taskWithInputs = agent.taskDescription;
      let paramContext = "";
      
      for (const inputDef of agent.inputs) {
        const key = inputDef.parameter;
        const value = inputs[key];
        let processedValue = '';
        
        if (Array.isArray(value) && value.length > 0) {
          const contents = await Promise.all(value.map(readFileAsText));
          processedValue = contents.join('\n\n--- (File Content Break) ---\n\n');
        } else if (typeof value === 'string') {
          processedValue = value;
        }

        const placeholder = `{${key}}`;
        if (taskWithInputs.includes(placeholder)) {
          taskWithInputs = taskWithInputs.split(placeholder).join(processedValue);
        } else {
          paramContext += `\n- ${key}: ${processedValue}`;
        }
      }

      const finalInput = `CONTEXT_CHAIN: This is a standalone test run.\n\nPARAM_BLOCK:${paramContext || ' None'}\n\nASSIGNED_TASK: ${taskWithInputs}`;

      const response = await geminiService.generate(
        agent.config,
        `IDENTITY: ${agent.backstory}\nGOAL: ${agent.goal}\nOUTPUT_REQUIREMENTS: ${agent.expectedOutput}`,
        finalInput,
        undefined,
        [], // Tools are not supported in test view
        undefined,
        agent.knowledgeBaseIds,
        agent.id
      );

      setOutput(response.text || 'Agent produced no output.');

    } catch (e: any) {
      setError(e.message || 'An unknown error occurred during execution.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent_${agent.name}_v${agent.version}_output${agent.outputFileExtension || '.txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-100 dark:bg-[#09090b]">
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#0c0c0e] sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"><ArrowLeft className="w-5 h-5" /></button>
          <div className="w-px h-6 bg-zinc-200 dark:border-zinc-800" />
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Test Agent: {agent.name} (V{agent.version})</h2>
            <p className="text-xs text-zinc-500">Run an isolated test to validate agent logic and output format.</p>
          </div>
        </div>
        <button onClick={handleRunTest} disabled={isLoading} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition-all font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isLoading ? 'Executing...' : 'Run Test'}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Input Panel */}
        <div className="w-[450px] border-r border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-6 overflow-y-auto scrollbar-thin">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Input Parameters</h3>
          {agent.inputs.length > 0 ? (
            agent.inputs.map(input => (
              <div key={input.parameter} className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-indigo-600 dark:text-indigo-400 font-mono">{input.parameter}</label>
                  <p className="text-xs text-zinc-500">{input.description}</p>
                </div>

                {Array.isArray(inputs[input.parameter]) && (inputs[input.parameter] as File[]).length > 0 ? (
                  <div className="space-y-2">
                    {(inputs[input.parameter] as File[]).map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-xs">
                        <span className="truncate text-zinc-700 dark:text-zinc-300">{file.name}</span>
                        <button onClick={() => handleRemoveFile(input.parameter, index)} className="p-1 text-zinc-500 hover:text-red-500 dark:hover:text-red-400"><X className="w-3 h-3"/></button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={typeof inputs[input.parameter] === 'string' ? (inputs[input.parameter] as string) : ''}
                    onChange={(e) => setInputs(prev => ({...prev, [input.parameter]: e.target.value}))}
                    rows={4}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-sm mono focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                  />
                )}
                 <div>
                  <label htmlFor={`file-upload-${input.parameter}`} className="cursor-pointer flex items-center justify-center gap-2 w-full p-2 bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300/80 dark:border-zinc-700/80 rounded-lg text-xs font-bold text-zinc-500 dark:text-zinc-400 transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Attach Files
                  </label>
                  <input id={`file-upload-${input.parameter}`} type="file" multiple className="hidden" onChange={(e) => handleFileChange(e, input.parameter)} />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-zinc-500 dark:text-zinc-600 text-sm py-20">This agent requires no inputs.</div>
          )}
        </div>

        {/* Output Panel */}
        <div className="flex-1 p-8 flex flex-col overflow-y-auto scrollbar-thin">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Agent Output</h3>
            <button onClick={handleDownload} disabled={!output} className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 disabled:opacity-30">
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
          <div className="flex-1 bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 prose prose-sm prose-invert w-full max-w-none">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                <div className="relative"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /><Cpu className="w-5 h-5 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
                <span>Awaiting response from model...</span>
              </div>
            ) : error ? (
              <div className="text-red-500 dark:text-red-400 flex flex-col items-center justify-center h-full gap-4">
                <AlertCircle className="w-12 h-12" />
                <div className="text-center">
                  <h4 className="font-bold mb-2">Execution Failed</h4>
                  <p className="text-xs">{error}</p>
                </div>
              </div>
            ) : output ? (
              <Markdown>{output}</Markdown>
            ) : (
               <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-700 gap-4">
                <FileText className="w-12 h-12" />
                <span>Output will appear here</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
