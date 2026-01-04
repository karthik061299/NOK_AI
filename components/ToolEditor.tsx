
import React, { useState, useEffect, useRef } from 'react';
import { Tool } from '../types';
import { Save, X, Hammer, Code, Terminal, Play, Loader2, AlertCircle, Info, Trash2, Plus, ChevronDown, Globe } from 'lucide-react';

interface ToolEditorProps {
  tool: Tool;
  onSave: (tool: Tool) => void;
  onCancel: () => void;
  setIsDirty: (isDirty: boolean) => void;
  isClone?: boolean;
}

const TEMPLATES = {
  javascript: `async ({ owner, repo, path }) => {\n  // Example: Fetch from GitHub\n  const url = \`https://raw.githubusercontent.com/\${owner}/\${repo}/main/\${path}\`;\n  const response = await fetch(url);\n  if (!response.ok) throw new Error('File not found');\n  return await response.text();\n}`,
  python: `def main(args):\n    # This code runs in your target environment\n    owner = args.get('owner')\n    repo = args.get('repo')\n    path = args.get('path')\n    # implementation logic here...\n    return f"Read {path} from {owner}/{repo}"`,
  java: `public class ToolImplementation {\n    public Object execute(Map<String, Object> args) {\n        // implementation logic here...\n        return "Success";\n    }\n}`
};

export const ToolEditor: React.FC<ToolEditorProps> = ({ tool, onSave, onCancel, setIsDirty, isClone }) => {
  const [formData, setFormData] = useState<Tool>(({ ...tool, language: tool.language || 'javascript' }));
  const [isTesting, setIsTesting] = useState(false);
  const [testArgs, setTestArgs] = useState<string>('{\n  "owner": "google",\n  "repo": "gson",\n  "path": "README.md"\n}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
        isInitialMount.current = false;
        if(isClone) setIsDirty(true);
    } else {
        setIsDirty(true);
    }
  }, [formData, setIsDirty, isClone]);

  useEffect(() => {
    if (!formData.code || formData.code.includes('Implementation here')) {
      setFormData(prev => ({ ...prev, code: TEMPLATES[formData.language] }));
    }
  }, [formData.language]);

  const runTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const args = JSON.parse(testArgs);
      
      if (formData.language === 'javascript') {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction('args', formData.code);
        const result = await fn(args);
        setTestResult(result);
      } else {
        await new Promise(resolve => setTimeout(resolve, 800));
        setTestResult({ status: "simulated_output", language: formData.language, environment: "Browser (Local Preview)", notice: "Python/Java execution requires a specialized backend runner.", input_received: args });
      }
    } catch (e: any) { setTestError(e.message); } 
    finally { setIsTesting(false); }
  };

  const handleSave = () => {
    if (!formData.name || !formData.className || !formData.code || !formData.description) {
      alert("Please fill in all required fields (Name, Description, Class Name, and Code).");
      return;
    }
    onSave(formData);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-100 dark:bg-[#09090b]">
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#0c0c0e] sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"><X className="w-5 h-5" /></button>
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20"><Hammer className="w-5 h-5 text-white" /></div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{formData.name || 'New Tool'}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg transition-all text-xs font-bold shadow-lg shadow-indigo-600/20">
            <Save className="w-3.5 h-3.5" /> Save Tool
          </button>
        </div>
      </header>
      
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-8 space-y-6 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Tool Name</label><input type="text" value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
              <div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Class Name</label><input type="text" value={formData.className} onChange={(e) => setFormData(p => ({...p, className: e.target.value}))} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm mono focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
          </div>
          <div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Description</label><textarea value={formData.description} onChange={(e) => setFormData(p => ({...p, description: e.target.value}))} rows={2} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Implementation</label>
            <div className="relative">
              <select value={formData.language} onChange={(e) => setFormData(p => ({...p, language: e.target.value as any, code: TEMPLATES[e.target.value as keyof typeof TEMPLATES] || ''}))} className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-t-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none pr-8">
                <option value="javascript">JavaScript</option><option value="python">Python (Simulated)</option><option value="java">Java (Simulated)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            </div>
            <textarea value={formData.code} onChange={(e) => setFormData(p => ({...p, code: e.target.value}))} className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-b-lg p-4 text-xs mono resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 h-80 scrollbar-thin" />
          </div>

          <div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Parameters (JSON Schema)</label><textarea value={JSON.stringify(formData.parameters, null, 2)} onChange={(e) => { try { setFormData(p => ({...p, parameters: JSON.parse(e.target.value)})) } catch(err){} }} className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-lg p-4 text-xs mono resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 h-40 scrollbar-thin" /></div>
        </div>
        
        <div className="w-[450px] border-l border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-[#0c0c0e]">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest"><Terminal className="w-4 h-4" /> Test Panel</div>
          <div className="p-4 space-y-2 flex-1 flex flex-col">
            <label className="text-xs font-bold text-zinc-500 uppercase">Test Arguments (JSON)</label>
            <textarea value={testArgs} onChange={(e) => setTestArgs(e.target.value)} className="w-full flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-xs mono resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 scrollbar-thin" />
          </div>
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800"><button onClick={runTest} disabled={isTesting} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm disabled:opacity-50"><Play className="w-4 h-4" /> {isTesting ? 'Running...' : 'Run Test'}</button></div>
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex-1 overflow-y-auto scrollbar-thin">
            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Result</h4>
            {isTesting && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
            {testError && <div className="p-3 bg-red-100 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400"><AlertCircle className="w-4 h-4 inline-block mr-2" />{testError}</div>}
            {testResult && <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg overflow-auto"><code>{typeof testResult === 'object' ? JSON.stringify(testResult, null, 2) : String(testResult)}</code></pre>}
          </div>
        </div>
      </main>
    </div>
  );
};
